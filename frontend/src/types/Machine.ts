export interface Machine {
    id: number;
    type: string;
    department: string;
    status: string;
    hostname: string;
    ipAddress: string;
    metrics: MachineMetrics | null;
    ownerId: number;
    ownerFullName: string;
    remoteControl: boolean;
    agentRemoteControl?: boolean | null;
}

export interface MachineMetrics {
    cpuUsage: number;
    ramUsed: number;
    ramTotal: number;
    latencyMs: number | null;
    reportedAt: string;
}

export const DEPARTMENTS = ["Finance", "Sales", "IT", "HR", "Management"];
export const MACHINE_TYPES = ["Workstation", "Laptop", "Server"];

export type MachineState = "online" | "insession" | "alert" | "maintenance" | "offline";

export const MACHINE_STATE_LABEL: Record<MachineState, string> = {
    online: "Online",
    insession: "In Session",
    alert: "Resource Alert",
    maintenance: "Maintenance",
    offline: "Offline",
};

export function getMachineState(machine: Machine): MachineState {
    const status = machine.status.toLowerCase();
    if (status === "maintenance") return "maintenance";
    if (!["online", "active", "available"].includes(status)) return "offline";
    if (sessionIds().includes(machine.id)) return "insession";
    const m = machine.metrics;
    return m && (m.cpuUsage >= 90 || m.ramUsed / m.ramTotal >= 0.9) ? "alert" : "online";
}

const SESSIONS_KEY = "machines.inSession";

function sessionIds(): number[] {
    try {
        return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? "[]");
    } catch {
        return [];
    }
}

export function setInSession(id: number, active: boolean) {
    const ids = sessionIds().filter(other => other !== id);
    try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(active ? [...ids, id] : ids));
    } catch {
    }
}
