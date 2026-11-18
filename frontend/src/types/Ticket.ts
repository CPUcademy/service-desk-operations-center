export interface Ticket {
    id: number;
    adminId: number | null;
    userId: number;
    machineId: number;
    description: string;
    priority: number;
    isFixed: boolean;
    adminFullName: string | null;
    userFullName: string;
    machineHostname: string;
}

export const PRIORITIES = [
    { value: 1, label: "Critical" },
    { value: 2, label: "High" },
    { value: 3, label: "Medium" },
] as const;

export const COOKED_LABELS: Record<number, string> = {
    1: "Burnt",
    2: "Well done",
    3: "Medium rare",
};

export function priorityLabel(priority: number, cooked = false) {
    if (cooked && COOKED_LABELS[priority]) return COOKED_LABELS[priority];
    return PRIORITIES.find(p => p.value === priority)?.label ?? `P${priority}`;
}
