import type { Machine } from "../types/Machine";

interface MachineCardProps {
    machine: Machine;
}

function MachineCard({ machine }: MachineCardProps) {
    return (
        <div>
            <h2>id: {machine.id}</h2>
            <h2>type: {machine.type}</h2>
            <h3>department: {machine.department}</h3>
            <h2>status: {machine.status}</h2>
            <h2>hostname: {machine.hostname}</h2>
            <h2>ip: {machine.ipAddress}</h2>

            <button>Attend</button>
        </div>
    );
}

export default MachineCard;