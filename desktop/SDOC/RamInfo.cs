namespace sdoc
{
    public class RamInfo
    {
        public double Total { get; set; }
        public double Used { get; set; }
        public double Percent { get; set; }

        public RamInfo(double total, double used, double percent)
        {
            Total = total;
            Used = used;
            Percent = percent;
        }
    }
}