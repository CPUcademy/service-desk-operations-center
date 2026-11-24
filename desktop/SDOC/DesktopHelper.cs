using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace sdoc
{
    // Runs inside the signed-in user's session (sdoc.exe --desktop <server> <machineId> <token>):
    // streams the primary screen as JPEG frames and replays the technician's mouse and keyboard.
    // ponytail: JPEG frames over the relay (~5 fps); switch to WebRTC video if bandwidth or latency matter
    public static class DesktopHelper
    {
        private const int MaxWidth = 1600;
        private const int FrameDelayMs = 180;
        private static readonly ImageCodecInfo Jpeg = ImageCodecInfo.GetImageEncoders().First(codec => codec.FormatID == ImageFormat.Jpeg.Guid);

        public static async Task RunAsync(string[] args)
        {
            Native.SetProcessDPIAware();
            Uri server = new(args[1]);
            string machineId = args[2], token = args[3];
            Rectangle bounds = System.Windows.Forms.Screen.PrimaryScreen!.Bounds;

            using var ws = new ClientWebSocket();
            using var stop = new CancellationTokenSource();
            await ws.ConnectAsync(AgentClient.WsUri(server, $"/api/v1/internal/agent/{machineId}?token={token}"), CancellationToken.None);

            var hello = new JsonObject { ["type"] = "desktop", ["width"] = bounds.Width, ["height"] = bounds.Height };
            await ws.SendAsync(Encoding.UTF8.GetBytes(hello.ToJsonString()), WebSocketMessageType.Text, true, CancellationToken.None);
            _ = Task.Run(() => ReceiveInput(ws, bounds, stop));

            using var parameters = new EncoderParameters(1);
            parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 55L);
            try
            {
                while (ws.State == WebSocketState.Open && !stop.IsCancellationRequested)
                {
                    byte[]? frame = Capture(bounds, parameters);
                    if (frame != null) await ws.SendAsync(frame, WebSocketMessageType.Binary, true, stop.Token);
                    await Task.Delay(frame == null ? 1000 : FrameDelayMs, stop.Token);
                }
            }
            catch (Exception ex) when (ex is OperationCanceledException or WebSocketException)
            {
            }
        }

        private static byte[]? Capture(Rectangle bounds, EncoderParameters parameters)
        {
            try
            {
                using var screen = new Bitmap(bounds.Width, bounds.Height);
                using (Graphics g = Graphics.FromImage(screen))
                {
                    g.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
                    var cursor = new Native.CURSORINFO { cbSize = System.Runtime.InteropServices.Marshal.SizeOf<Native.CURSORINFO>() };
                    if (Native.GetCursorInfo(ref cursor) && cursor.flags == 1)
                    {
                        IntPtr hdc = g.GetHdc();
                        Native.DrawIcon(hdc, cursor.x - bounds.X, cursor.y - bounds.Y, cursor.hCursor);
                        g.ReleaseHdc(hdc);
                    }
                }

                Bitmap output = screen;
                if (bounds.Width > MaxWidth)
                {
                    output = new Bitmap(MaxWidth, bounds.Height * MaxWidth / bounds.Width);
                    using Graphics g = Graphics.FromImage(output);
                    g.InterpolationMode = InterpolationMode.Bilinear;
                    g.DrawImage(screen, 0, 0, output.Width, output.Height);
                }

                using var stream = new MemoryStream();
                output.Save(stream, Jpeg, parameters);
                if (output != screen) output.Dispose();
                return stream.ToArray();
            }
            catch (System.ComponentModel.Win32Exception)
            {
                return null; // secure desktop (UAC, lock screen) can't be captured from the user session
            }
        }

        private static async Task ReceiveInput(ClientWebSocket ws, Rectangle bounds, CancellationTokenSource stop)
        {
            var buffer = new byte[8 * 1024];
            using var message = new MemoryStream();
            try
            {
                while (ws.State == WebSocketState.Open)
                {
                    WebSocketReceiveResult result = await ws.ReceiveAsync(buffer, stop.Token);
                    if (result.MessageType == WebSocketMessageType.Close) break;
                    message.Write(buffer, 0, result.Count);
                    if (!result.EndOfMessage) continue;

                    JsonNode? msg;
                    try { msg = JsonNode.Parse(message.ToArray()); } catch (JsonException) { msg = null; }
                    message.SetLength(0);
                    if ((string?)msg?["type"] == "desktop-stop") break;
                    if ((string?)msg?["type"] == "input") Apply(msg!, bounds);
                }
            }
            catch (Exception ex) when (ex is OperationCanceledException or WebSocketException)
            {
            }
            stop.Cancel();
        }

        private static void Apply(JsonNode input, Rectangle bounds)
        {
            string kind = (string?)input["kind"] ?? "";
            if (input["x"] is JsonNode x && input["y"] is JsonNode y)
                Native.SetCursorPos(bounds.X + (int)(Math.Clamp((double)x, 0, 1) * (bounds.Width - 1)), bounds.Y + (int)(Math.Clamp((double)y, 0, 1) * (bounds.Height - 1)));

            int button = (int?)input["button"] ?? 0;
            (uint down, uint up) = button switch { 1 => (0x20u, 0x40u), 2 => (0x08u, 0x10u), _ => (0x02u, 0x04u) };
            switch (kind)
            {
                case "down": Native.mouse_event(down, 0, 0, 0, UIntPtr.Zero); break;
                case "up": Native.mouse_event(up, 0, 0, 0, UIntPtr.Zero); break;
                case "wheel": Native.mouse_event(0x0800, 0, 0, -Math.Sign((int?)input["delta"] ?? 0) * 120, UIntPtr.Zero); break;
                case "keydown":
                case "keyup":
                    int vk = (int?)input["key"] ?? 0;
                    if (vk is <= 0 or > 254) return;
                    bool extended = vk is >= 33 and <= 46 or 91 or 92 or 93;
                    Native.keybd_event((byte)vk, 0, (kind == "keyup" ? 0x2u : 0) | (extended ? 0x1u : 0), UIntPtr.Zero);
                    break;
            }
        }
    }
}
