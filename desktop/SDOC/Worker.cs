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
        private readonly PerformanceCounter cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
        private readonly PerformanceCounter ramCounter = new PerformanceCounter("Memory", "Available MBytes");
        private readonly HttpClient http = new HttpClient();

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {

            int heartbeatCount = 0;

            bool isWindows = OperatingSystem.IsWindows();
            logger.LogInformation("Operating system is Windows: {Windows}", isWindows);

            String commandType = "GetSystemInfo";
            
            if (commandType == "GetSystemInfo") {
                logger.LogInformation("Executing command: {command}", commandType);
                PrintSystemInfo();
            }
            string? apiKey = Environment.GetEnvironmentVariable("WORKER_API_KEY");
            if (string.IsNullOrEmpty(apiKey))
            {
                logger.LogError("Missing WORKER_API_KEY - the server will reject the data");
            }
            http.DefaultRequestHeaders.Add("X-Worker-Key", apiKey);

            while (!stoppingToken.IsCancellationRequested)
            {
                heartbeatCount++;
                if (logger.IsEnabled(LogLevel.Information))
                {
                    logger.LogInformation("Heartbeat {count} at {time}" ,heartbeatCount, DateTimeOffset.Now);

                    Metrics metrics = CollectMetrics();
                    logger.LogInformation("CPU: {cpu}%, RAM: {used} / {total} MB, Latency: {ms} ms", metrics.CpuUsage, metrics.RamUsed, metrics.RamTotal, metrics.LatencyMs);
                    await SendMetricsAsync(metrics, stoppingToken);
                }

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

        private async Task SendMetricsAsync(Metrics metrics, CancellationToken stoppingToken)
        {
            string? serverUrl = configuration["Agent:ServerUrl"];
            int machineId = configuration.GetValue<int>("Agent:MachineId");
            string url = $"{serverUrl}/api/v1/internal/machines/{machineId}/metrics";

            try
            {
                HttpResponseMessage response = await http.PostAsJsonAsync(url, metrics, stoppingToken);
                string body = await response.Content.ReadAsStringAsync(stoppingToken);
                logger.LogInformation("Server answered: {status} {body}", (int)response.StatusCode, body);
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

        private float GetCpuUsage()
        {
            return cpuCounter.NextValue();
        }

        private RamInfo GetRamInfo()
        {
            double total = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1024.0 / 1024.0;
            double free = ramCounter.NextValue();
            double used = total - free;
            double percent = used / total * 100;

            return new RamInfo(total, used, percent);

        }

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