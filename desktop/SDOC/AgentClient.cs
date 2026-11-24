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
    // Live channel to the server: runs remote commands, restarts the agent, sends Ctrl+Alt+Del and starts desktop streaming.
    public class AgentClient(ILogger<AgentClient> logger, IConfiguration configuration) : BackgroundService
    {
        public const string ServiceName = "SDOCAgent";
        private const int MaxOutput = 32 * 1024;
        private static readonly TimeSpan CommandTimeout = TimeSpan.FromSeconds(60);

        private ClientWebSocket? socket;
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
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var ws = new ClientWebSocket();
                    ws.Options.SetRequestHeader("X-Worker-Key", apiKey);
                    ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
                    await ws.ConnectAsync(endpoint, stoppingToken);
                    socket = ws;
                    logger.LogInformation("Agent channel connected");
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

                string text = Encoding.UTF8.GetString(message.ToArray());
                message.SetLength(0);
                JsonNode? msg;
                try { msg = JsonNode.Parse(text); } catch (JsonException) { continue; }

                switch ((string?)msg?["type"])
                {
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
                }
            }
        }

        private async Task Exec(JsonNode? id, string command, CancellationToken token)
        {
            logger.LogInformation("Remote command: {command}", command);
            string output;
            int exitCode;
            try
            {
                string script = "& {\n" + command + "\n} 2>&1 | Out-String -Width 160";
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
                    output = (await stdout + await stderr).TrimEnd();
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

        private string RestartSelf()
        {
            if (!WindowsServiceHelpers.IsWindowsService())
                return "Agent is not running as a Windows service; restart it manually.";
            // The child survives the service stopping and starts it again
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
                // 1 = services may generate the secure attention sequence
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
