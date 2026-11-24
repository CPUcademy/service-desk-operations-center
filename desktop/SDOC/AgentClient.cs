using System.Diagnostics;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Hosting.WindowsServices;
using Microsoft.Win32;

namespace sdoc
{
    public class AgentClient(ILogger<AgentClient> logger, IConfiguration configuration) : BackgroundService
    {
        public const string ServiceName = "SDOCAgent";
        private const int MaxOutput = 32 * 1024;
        private const long MaxUpload = 500L * 1024 * 1024;
        private static readonly TimeSpan CommandTimeout = TimeSpan.FromSeconds(60);

        private ClientWebSocket? socket;
        private bool localAllows;
        private volatile bool serverAllows;
        private bool RemoteAllowed => localAllows && serverAllows;
        private Upload? upload;
        private readonly SemaphoreSlim sendLock = new(1, 1);

        public static Uri WsUri(Uri server, string path) =>
            new UriBuilder(server) { Scheme = server.Scheme == "https" ? "wss" : "ws", Path = path.Split('?')[0], Query = path.Contains('?') ? path.Split('?')[1] : "" }.Uri;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            string? apiKey = Environment.GetEnvironmentVariable("WORKER_API_KEY");
            int machineId = configuration.GetValue<int>("Agent:MachineId");
            if (string.IsNullOrEmpty(apiKey) || machineId <= 0 || !Uri.TryCreate(configuration["Agent:ServerUrl"], UriKind.Absolute, out Uri? server))
                return;

            Uri endpoint = WsUri(server, $"/api/v1/internal/agent/{machineId}");
            // Local opt-in; the server can't override it
            localAllows = configuration.GetValue<bool>("Agent:AllowRemoteControl");
            logger.LogInformation("Remote control allowed locally: {allowed}", localAllows);
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var ws = new ClientWebSocket();
                    ws.Options.SetRequestHeader("X-Worker-Key", apiKey);
                    ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
                    await ws.ConnectAsync(endpoint, stoppingToken);
                    socket = ws;
                    serverAllows = false;
                    logger.LogInformation("Agent channel connected");
                    await Send(new JsonObject { ["type"] = "hello", ["remoteControl"] = localAllows }, stoppingToken);
                    await ReceiveLoop(ws, server, machineId, stoppingToken);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    logger.LogWarning("Agent channel down: {message}", ex.Message);
                }
                socket = null;
                await Task.Delay(5000, stoppingToken);
            }
        }

        private async Task ReceiveLoop(ClientWebSocket ws, Uri server, int machineId, CancellationToken token)
        {
            var buffer = new byte[16 * 1024];
            using var message = new MemoryStream();
            while (ws.State == WebSocketState.Open)
            {
                WebSocketReceiveResult result = await ws.ReceiveAsync(buffer, token);
                if (result.MessageType == WebSocketMessageType.Close) return;
                message.Write(buffer, 0, result.Count);
                if (!result.EndOfMessage) continue;

                if (result.MessageType == WebSocketMessageType.Binary)
                {
                    if (RemoteAllowed) await WriteChunk(message.ToArray(), token);
                    message.SetLength(0);
                    continue;
                }

                string text = Encoding.UTF8.GetString(message.ToArray());
                message.SetLength(0);
                JsonNode? msg;
                try { msg = JsonNode.Parse(text); } catch (JsonException) { continue; }

                string? type = (string?)msg?["type"];
                if (type is "exec" or "cad" or "desktop-start" or "file-start" && !RemoteAllowed)
                {
                    string reason = localAllows ? "Remote control is disabled for this machine." : "Remote control is not allowed on this machine (local agent setting).";
                    logger.LogWarning("Refused remote {type}: remote control not allowed", type);
                    JsonObject reply = type switch
                    {
                        "exec" => new JsonObject { ["type"] = "exec-result", ["id"] = msg!["id"]?.DeepClone(), ["output"] = reason, ["exitCode"] = -1 },
                        "file-start" => new JsonObject { ["type"] = "file-error", ["error"] = reason },
                        _ => new JsonObject { ["type"] = "notice", ["text"] = reason },
                    };
                    await Send(reply, token);
                    continue;
                }

                switch (type)
                {
                    case "policy":
                        serverAllows = (bool?)msg!["remoteControl"] ?? false;
                        logger.LogWarning("Server set remote control: {allowed}", serverAllows);
                        if (!serverAllows) CloseUpload(delete: true);
                        break;
                    case "exec":
                        JsonNode? id = msg!["id"]?.DeepClone();
                        string command = (string?)msg["command"] ?? "";
                        _ = Task.Run(() => Exec(id, command, token), token);
                        break;
                    case "restart-agent":
                        await Notice(RestartSelf(), token);
                        break;
                    case "cad":
                        await Notice(SendCtrlAltDel(), token);
                        break;
                    case "desktop-start":
                        await Notice(await StartDesktop(server, machineId, token), token);
                        break;
                    case "file-start":
                        await StartFile(msg!, token);
                        break;
                }
            }
            CloseUpload(delete: true);
        }

        private async Task StartFile(JsonNode msg, CancellationToken token)
        {
            CloseUpload(delete: true);
            string folder = (string?)msg["path"] ?? "";
            string name = Path.GetFileName((string?)msg["name"] ?? "");
            long size = (long?)msg["size"] ?? -1;
            try
            {
                if (!Path.IsPathFullyQualified(folder)) throw new IOException("Destination must be an absolute path.");
                if (name.Length == 0) throw new IOException("Missing file name.");
                if (size is < 0 or > MaxUpload) throw new IOException($"Files up to {MaxUpload / 1024 / 1024} MB are supported.");
                Directory.CreateDirectory(folder);
                string target = Path.Combine(folder, name);
                upload = new Upload(new FileStream(target, FileMode.Create, FileAccess.Write), target, size);
                logger.LogInformation("Receiving file {target} ({size} bytes)", target, size);
                await FileProgress(token);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException)
            {
                CloseUpload(delete: true);
                await Send(new JsonObject { ["type"] = "file-error", ["error"] = ex.Message }, token);
            }
        }

        private async Task WriteChunk(byte[] chunk, CancellationToken token)
        {
            if (upload == null) return;
            try
            {
                if (upload.Received + chunk.Length > upload.Size) throw new IOException("Received more data than announced.");
                await upload.Stream.WriteAsync(chunk, token);
                upload.Received += chunk.Length;
                await FileProgress(token);
            }
            catch (IOException ex)
            {
                CloseUpload(delete: true);
                await Send(new JsonObject { ["type"] = "file-error", ["error"] = ex.Message }, token);
            }
        }

        private async Task FileProgress(CancellationToken token)
        {
            if (upload!.Received < upload.Size)
            {
                await Send(new JsonObject { ["type"] = "file-progress", ["received"] = upload.Received }, token);
                return;
            }
            string target = upload.Path;
            CloseUpload(delete: false);
            await Send(new JsonObject { ["type"] = "file-done", ["path"] = target }, token);
        }

        private void CloseUpload(bool delete)
        {
            if (upload == null) return;
            upload.Stream.Dispose();
            if (delete) File.Delete(upload.Path);
            upload = null;
        }

        private sealed class Upload(FileStream stream, string path, long size)
        {
            public FileStream Stream { get; } = stream;
            public string Path { get; } = path;
            public long Size { get; } = size;
            public long Received { get; set; }
        }

        private async Task Exec(JsonNode? id, string command, CancellationToken token)
        {
            logger.LogInformation("Remote command: {command}", command);
            string output;
            int exitCode;
            try
            {
                string script = "$ProgressPreference = 'SilentlyContinue'\n& {\n" + command + "\n} 2>&1 | Out-String -Width 160";
                var psi = new ProcessStartInfo("powershell.exe",
                    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Convert.ToBase64String(Encoding.Unicode.GetBytes(script))])
                {
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                using Process process = Process.Start(psi)!;
                Task<string> stdout = process.StandardOutput.ReadToEndAsync(token);
                Task<string> stderr = process.StandardError.ReadToEndAsync(token);
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
                timeout.CancelAfter(CommandTimeout);
                try
                {
                    await process.WaitForExitAsync(timeout.Token);
                    output = (await stdout + CleanStderr(await stderr)).TrimEnd();
                    exitCode = process.ExitCode;
                }
                catch (OperationCanceledException) when (!token.IsCancellationRequested)
                {
                    process.Kill(entireProcessTree: true);
                    output = $"Command timed out after {CommandTimeout.TotalSeconds:0} s and was stopped.";
                    exitCode = -1;
                }
            }
            catch (Exception ex) when (!token.IsCancellationRequested)
            {
                output = ex.Message;
                exitCode = -1;
            }

            if (output.Length > MaxOutput) output = output[..MaxOutput] + "\n… output truncated";
            await Send(new JsonObject { ["type"] = "exec-result", ["id"] = id, ["output"] = output, ["exitCode"] = exitCode }, token);
        }

        private static string CleanStderr(string stderr)
        {
            if (!stderr.StartsWith("#< CLIXML")) return stderr;
            return string.Concat(System.Text.RegularExpressions.Regex.Matches(stderr, "<S S=\"Error\">(.*?)</S>")
                .Select(match => System.Net.WebUtility.HtmlDecode(match.Groups[1].Value).Replace("_x000D__x000A_", "\n")));
        }

        private string RestartSelf()
        {
            if (!WindowsServiceHelpers.IsWindowsService())
                return "Agent is not running as a Windows service. Restart it manually.";
            // The child outlives the service stop
            Process.Start(new ProcessStartInfo("cmd.exe", $"/c net stop {ServiceName} & net start {ServiceName}") { CreateNoWindow = true, UseShellExecute = false });
            logger.LogWarning("Agent restart requested remotely");
            return "Agent restarting…";
        }

        private string SendCtrlAltDel()
        {
            if (!WindowsServiceHelpers.IsWindowsService())
                return "Ctrl+Alt+Del needs the agent running as a Windows service.";
            using (RegistryKey key = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"))
            {
                // 1 = services may send SAS
                if (key.GetValue("SoftwareSASGeneration") is not int value || (value & 1) == 0)
                    key.SetValue("SoftwareSASGeneration", 1, RegistryValueKind.DWord);
            }
            Native.SendSAS(false);
            return "Ctrl+Alt+Del sent.";
        }

        private async Task<string> StartDesktop(Uri server, int machineId, CancellationToken token)
        {
            string desktopToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
            await Send(new JsonObject { ["type"] = "desktop-token", ["token"] = desktopToken }, token);

            string exe = Environment.ProcessPath!;
            string args = $"--desktop \"{server}\" {machineId} {desktopToken}";
            try
            {
                if (WindowsServiceHelpers.IsWindowsService()) Native.StartInActiveSession(exe, args);
                else Process.Start(exe, args);
                return "Desktop stream starting…";
            }
            catch (Exception ex)
            {
                logger.LogWarning("Desktop helper failed to start: {message}", ex.Message);
                return $"Desktop unavailable: {ex.Message}";
            }
        }

        private Task Notice(string text, CancellationToken token) =>
            Send(new JsonObject { ["type"] = "notice", ["text"] = text }, token);

        private async Task Send(JsonNode payload, CancellationToken token)
        {
            ClientWebSocket? ws = socket;
            if (ws?.State != WebSocketState.Open) return;
            byte[] bytes = Encoding.UTF8.GetBytes(payload.ToJsonString());
            await sendLock.WaitAsync(token);
            try { await ws.SendAsync(bytes, WebSocketMessageType.Text, true, token); }
            finally { sendLock.Release(); }
        }
    }
}
