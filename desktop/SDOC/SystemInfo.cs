using System.Runtime.InteropServices;

namespace sdoc
{
    public class SystemInfo
    {
        public string MachineName { get; set; }
        public int ProcessorCount { get; set; }
        public string OsDescription { get; set; }
        public string UserName { get; set; }
        public string IpAddress { get; set; }


        public SystemInfo(string machineName, int processorCount, string operatingSystem, string userName, string ipAddress)
        {
            MachineName = machineName;
            ProcessorCount = processorCount;
            OsDescription = operatingSystem;
            UserName = userName;
            IpAddress = ipAddress;
        }
    }
}