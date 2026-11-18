import { getMachineState, MACHINE_STATE_LABEL, type Machine } from "../types/Machine";
import "./MachineCard.css";

interface MachineCardProps {
    machine: Machine;
}

function MachineCard({ machine }: MachineCardProps) {
    const state = getMachineState(machine);
    const metrics = machine.metrics;
    const ramPercent = metrics
        ? Math.min(100, (metrics.ramUsed / metrics.ramTotal) * 100)
        : 0;

    const loadStyle = (percent: number) => ({
        width: `${percent}%`,
        "--load-color": percent >= 90 ? "#d92d20" : percent >= 70 ? "#dc8a00" : "#3768d4",
    } as React.CSSProperties);

    return (
        <article className="machine-card">
            <header className="machine-card-header">
                <div className="machine-card-heading">
                    <span className="machine-card-id">Machine #{machine.id}</span>
                    <h2>{machine.hostname}</h2>
                    <span className="machine-card-type">{machine.type} · {machine.department} · {machine.ipAddress}</span>
                </div>
                <span className={`machine-status is-${state}`}>
                    <span className="machine-status-dot" aria-hidden="true" />
                    {MACHINE_STATE_LABEL[state]}
                </span>
            </header>

            <section className="machine-metrics" aria-label="Machine metrics">
                <div className="machine-metrics-heading">
                    <h3>Machine statistics</h3>
                    {metrics && <span>Updated {new Date(metrics.reportedAt).toLocaleTimeString()}</span>}
                </div>
                {metrics ? (
                    <div className="metric-grid">
                        <div className="metric-tile">
                            <div className="metric-label">CPU usage</div>
                            <div className="metric-value">{metrics.cpuUsage.toFixed(1)}<small>%</small></div>
                            <div className="metric-track" aria-hidden="true">
                                <span style={loadStyle(metrics.cpuUsage)} />
                            </div>
                        </div>
                        <div className="metric-tile">
                            <div className="metric-label">Memory</div>
                            <div className="metric-value">{ramPercent.toFixed(0)}<small>%</small></div>
                            <div className="metric-caption">
                                {(metrics.ramUsed / 1024).toFixed(1)} / {(metrics.ramTotal / 1024).toFixed(1)} GB
                            </div>
                            <div className="metric-track" aria-hidden="true">
                                <span style={loadStyle(ramPercent)} />
                            </div>
                        </div>
                        <div className="metric-tile">
                            <div className="metric-label">Latency</div>
                            <div className="metric-value">
                                {metrics.latencyMs === null ? "—" : metrics.latencyMs.toFixed(0)}
                                {metrics.latencyMs !== null && <small> ms</small>}
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="machine-metrics-empty">Offline</p>
                )}
            </section>
        </article>
    );
}

export default MachineCard;
