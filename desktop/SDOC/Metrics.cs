namespace sdoc
{
    public class Metrics
    {
        public double CpuUsage { get; set; }
        public double RamUsed { get; set; }
        public double RamTotal { get; set; }
        public long? LatencyMs { get; set; }

        public Metrics(double cpuUsage, double ramUsed, double ramTotal, long? latencyMs)
        {
            CpuUsage = cpuUsage;
            RamUsed = ramUsed;
            RamTotal = ramTotal;
            LatencyMs = latencyMs;
        }
    }
}