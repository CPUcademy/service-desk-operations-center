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

export type MachineState = "online" | "alert" | "maintenance" | "offline";

export const MACHINE_STATE_LABEL: Record<MachineState, string> = {
    online: "Online",
    alert: "Resource Alert",
    maintenance: "Maintenance",
    offline: "Offline",
};

export function getMachineState(machine: Machine): MachineState {
    const status = machine.status.toLowerCase();
    if (status === "maintenance") return "maintenance";
    if (!["online", "active", "available"].includes(status)) return "offline";
    const m = machine.metrics;
    return m && (m.cpuUsage >= 90 || m.ramUsed / m.ramTotal >= 0.9) ? "alert" : "online";
}
