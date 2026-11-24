using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Net;
using System.Net.Sockets;
using System.Net.NetworkInformation;
using System.Net.Http.Json;

namespace sdoc
{
    public class Worker(ILogger<Worker> logger, IConfiguration configuration) : BackgroundService
    {
#if WINDOWS
        private readonly PerformanceCounter cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
        private readonly PerformanceCounter ramCounter = new PerformanceCounter("Memory", "Available MBytes");
#else
        private (long idle, long total) lastCpu;
#endif
        private readonly HttpClient http = new HttpClient();

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {

            int heartbeatCount = 0;

            bool isWindows = OperatingSystem.IsWindows();
            logger.LogInformation("Operating system is Windows: {Windows}", isWindows);

            string commandType = "GetSystemInfo";
            
            if (commandType == "GetSystemInfo") {
                logger.LogInformation("Executing command: {command}", commandType);
                PrintSystemInfo();
            }
            string? apiKey = Environment.GetEnvironmentVariable("WORKER_API_KEY");
            if (string.IsNullOrEmpty(apiKey))
            {
                throw new InvalidOperationException("WORKER_API_KEY must be configured before the worker can send metrics.");
            }
            if (!Uri.TryCreate(configuration["Worker:ServerUrl"], UriKind.Absolute, out Uri? serverUri))
            {
                throw new InvalidOperationException("Worker:ServerUrl must be configured as an absolute URL.");
            }
            int machineId = configuration.GetValue<int>("Worker:MachineId");
            if (machineId <= 0)
            {
                throw new InvalidOperationException("Worker:MachineId must be a positive ID matching a registered machine.");
            }

            http.DefaultRequestHeaders.Add("X-Worker-Key", apiKey);

            while (!stoppingToken.IsCancellationRequested)
            {
                heartbeatCount++;
                logger.LogInformation("Heartbeat {count} at {time}", heartbeatCount, DateTimeOffset.Now);

                Metrics metrics = CollectMetrics();
                logger.LogInformation("CPU: {cpu}%, RAM: {used} / {total} MB, Latency: {ms} ms", metrics.CpuUsage, metrics.RamUsed, metrics.RamTotal, metrics.LatencyMs);
                await SendMetricsAsync(serverUri, machineId, metrics, stoppingToken);

                await Task.Delay(5000, stoppingToken);
            }
        }

        private void PrintSystemInfo()
        {
            SystemInfo info = new SystemInfo(Environment.MachineName, Environment.ProcessorCount, RuntimeInformation.OSDescription, Environment.UserName, GetIpAddress());
            logger.LogInformation("Machine: {name}, CPU {cpu}, OS {os}, User name: {userName}, IpAddress {address}", info.MachineName, info.ProcessorCount, info.OsDescription, info.UserName, info.IpAddress);
        }

        private Metrics CollectMetrics()
        {
            float cpu = GetCpuUsage();
            RamInfo ram = GetRamInfo();
            long? latency = GetLatencyMs();

            return new Metrics(cpu, ram.Used, ram.Total, latency);
        }

        private async Task SendMetricsAsync(Uri serverUri, int machineId, Metrics metrics, CancellationToken stoppingToken)
        {
            string url = $"{serverUri.ToString().TrimEnd('/')}/api/v1/internal/machines/{machineId}/metrics";

            try
            {
                HttpResponseMessage response = await http.PostAsJsonAsync(url, metrics, stoppingToken);
                string body = await response.Content.ReadAsStringAsync(stoppingToken);
                if (response.IsSuccessStatusCode)
                {
                    logger.LogInformation("Server accepted metrics: {status}", (int)response.StatusCode);
                }
                else
                {
                    logger.LogError("Server rejected metrics: {status} {body}", (int)response.StatusCode, body);
                }
            }
            catch (HttpRequestException ex)
            {
                logger.LogWarning("Server unreachable: {message}", ex.Message);
            }
            catch (TaskCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning("Server did not answer in time (timeout)");
            }
        }

        private long? GetLatencyMs()
        {
            Ping ping = new Ping();
            PingReply reply = ping.Send("8.8.8.8", 2000);

            if (reply.Status == IPStatus.Success)
            {
                return reply.RoundtripTime;
            }

            return null;
        }

#if WINDOWS
        private float GetCpuUsage()
        {
            return cpuCounter.NextValue();
        }

        private RamInfo GetRamInfo()
        {
            double total = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1024.0 / 1024.0;
            double free = ramCounter.NextValue();
            double used = total - free;
            return new RamInfo(total, used, used / total * 100);
        }
#else
        private float GetCpuUsage()
        {
            long[] fields = File.ReadLines("/proc/stat").First().Split(' ', StringSplitOptions.RemoveEmptyEntries).Skip(1).Select(long.Parse).ToArray();
            long idle = fields[3] + fields[4];
            long total = fields.Take(8).Sum();
            (long lastIdle, long lastTotal) = lastCpu;
            lastCpu = (idle, total);
            return total == lastTotal ? 0 : (float)Math.Clamp(100.0 * (1 - (double)(idle - lastIdle) / (total - lastTotal)), 0, 100);
        }

        private RamInfo GetRamInfo()
        {
            var info = File.ReadLines("/proc/meminfo").Select(line => line.Split(':')).ToDictionary(parts => parts[0], parts => long.Parse(parts[1].Trim().Split(' ')[0]));
            double total = info["MemTotal"] / 1024.0;
            double used = total - info["MemAvailable"] / 1024.0;
            return new RamInfo(total, used, used / total * 100);
        }
#endif

        private string GetIpAddress()
        {
            NetworkInterface[] cards = NetworkInterface.GetAllNetworkInterfaces();
            foreach (NetworkInterface card in cards)
            {
                if(card.OperationalStatus == OperationalStatus.Up && card.GetIPProperties().GatewayAddresses.Count > 0)
                {
                    foreach (UnicastIPAddressInformation info in card.GetIPProperties().UnicastAddresses)
                    {
                        if (info.Address.AddressFamily == AddressFamily.InterNetwork)
                        {
                            return info.Address.ToString();
                        }
                    }
                }
            }
            return "unknown";
        }
    }
}