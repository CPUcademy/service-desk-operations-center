using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace sdoc
{
    internal static class Native
    {
        [DllImport("sas.dll")]
        public static extern void SendSAS(bool asUser);

        [DllImport("user32.dll")]
        public static extern bool SetProcessDPIAware();

        [DllImport("user32.dll")]
        public static extern bool SetCursorPos(int x, int y);

        [DllImport("user32.dll")]
        public static extern void mouse_event(uint flags, int dx, int dy, int data, UIntPtr extra);

        [DllImport("user32.dll")]
        public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

        [DllImport("user32.dll")]
        public static extern bool GetCursorInfo(ref CURSORINFO info);

        [DllImport("user32.dll")]
        public static extern bool DrawIcon(IntPtr hdc, int x, int y, IntPtr icon);

        [StructLayout(LayoutKind.Sequential)]
        public struct CURSORINFO
        {
            public int cbSize;
            public int flags;
            public IntPtr hCursor;
            public int x;
            public int y;
        }

        [DllImport("kernel32.dll")]
        private static extern uint WTSGetActiveConsoleSessionId();

        [DllImport("wtsapi32.dll", SetLastError = true)]
        private static extern bool WTSQueryUserToken(uint sessionId, out IntPtr token);

        [DllImport("userenv.dll", SetLastError = true)]
        private static extern bool CreateEnvironmentBlock(out IntPtr environment, IntPtr token, bool inherit);

        [DllImport("userenv.dll")]
        private static extern bool DestroyEnvironmentBlock(IntPtr environment);

        [DllImport("kernel32.dll")]
        private static extern bool CloseHandle(IntPtr handle);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern bool CreateProcessAsUser(IntPtr token, string? application, StringBuilder commandLine, IntPtr processAttributes,
            IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string? directory, ref STARTUPINFO startupInfo, out PROCESS_INFORMATION processInfo);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct STARTUPINFO
        {
            public int cb;
            public string? lpReserved;
            public string? lpDesktop;
            public string? lpTitle;
            public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
            public short wShowWindow, cbReserved2;
            public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct PROCESS_INFORMATION
        {
            public IntPtr hProcess, hThread;
            public int dwProcessId, dwThreadId;
        }

        private const uint CreateUnicodeEnvironment = 0x400;
        private const uint CreateNoWindow = 0x08000000;

        // Starts a process on the desktop of the user signed in at the console. Requires LocalSystem.
        public static void StartInActiveSession(string exe, string args)
        {
            uint sessionId = WTSGetActiveConsoleSessionId();
            if (sessionId == 0xFFFFFFFF || !WTSQueryUserToken(sessionId, out IntPtr token))
                throw new InvalidOperationException("No user is signed in at the console.");

            IntPtr environment = IntPtr.Zero;
            try
            {
                CreateEnvironmentBlock(out environment, token, false);
                var startup = new STARTUPINFO { cb = Marshal.SizeOf<STARTUPINFO>(), lpDesktop = @"winsta0\default" };
                var commandLine = new StringBuilder($"\"{exe}\" {args}");
                if (!CreateProcessAsUser(token, exe, commandLine, IntPtr.Zero, IntPtr.Zero, false, CreateUnicodeEnvironment | CreateNoWindow,
                        environment, Path.GetDirectoryName(exe), ref startup, out PROCESS_INFORMATION process))
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                CloseHandle(process.hThread);
                CloseHandle(process.hProcess);
            }
            finally
            {
                if (environment != IntPtr.Zero) DestroyEnvironmentBlock(environment);
                CloseHandle(token);
            }
        }
    }
}
