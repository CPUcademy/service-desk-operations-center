export interface Machine {
    id: number;
    type: string;
    department: string;   // must match the JSON field name from the API
    status: string;
    hostname: string;
    ipAddress: string;
}