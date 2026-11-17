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

            <section aria-label="Machine metrics">
                <h3>Metrics</h3>
                {machine.metrics ? (
                    <>
                        <p>CPU: {machine.metrics.cpuUsage.toFixed(1)}%</p>
                        <p>
                            RAM: {machine.metrics.ramUsed.toFixed(1)} / {machine.metrics.ramTotal.toFixed(1)} MB
                        </p>
                        <p>
                            Latency: {machine.metrics.latencyMs === null
                                ? "Unavailable"
                                : `${machine.metrics.latencyMs.toFixed(0)} ms`}
                        </p>
                        <p>Reported: {new Date(machine.metrics.reportedAt).toLocaleString()}</p>
                    </>
                ) : (
                    <p>Waiting for metrics...</p>
                )}
            </section>

            <button>Attend</button>
        </div>
    );
}

export default MachineCard;