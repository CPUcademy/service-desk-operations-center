export interface Machine {
    id: number;
    type: string;
    department: string;
    status: string;
    hostname: string;
    ipAddress: string;
    metrics: MachineMetrics | null;
}

export interface MachineMetrics {
    cpuUsage: number;
    ramUsed: number;
    ramTotal: number;
    latencyMs: number | null;
    reportedAt: string;
}