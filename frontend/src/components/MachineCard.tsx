import type { Machine } from "../types/Machine";
import "./MachineCard.css";

interface MachineCardProps {
    machine: Machine;
}

function MachineCard({ machine }: MachineCardProps) {
    const status = machine.status.toLowerCase();
    const statusClass = ["online", "active", "available"].includes(status)
        ? "is-online"
        : status === "maintenance"
            ? "is-maintenance"
            : "is-offline";
    const metrics = machine.metrics;
    const ramPercent = metrics
        ? Math.min(100, (metrics.ramUsed / metrics.ramTotal) * 100)
        : 0;

    return (
        <article className="machine-card">
            <header className="machine-card-header">
                <div className="machine-card-heading">
                    <span className="machine-card-id">Machine #{machine.id}</span>
                    <h2>{machine.type}</h2>
                </div>
                <span className={`machine-status ${statusClass}`}>
                    <span className="machine-status-dot" aria-hidden="true" />
                    {machine.status}
                </span>
            </header>

            <dl className="machine-details">
                <div>
                    <dt>Hostname</dt>
                    <dd>{machine.hostname}</dd>
                </div>
                <div>
                    <dt>IP address</dt>
                    <dd>{machine.ipAddress}</dd>
                </div>
                <div>
                    <dt>Department</dt>
                    <dd>{machine.department}</dd>
                </div>
            </dl>

            <section className="machine-metrics" aria-label="Machine metrics">
                <div className="machine-metrics-heading">
                    <h3>Live metrics</h3>
                    {metrics && <span>Updated {new Date(metrics.reportedAt).toLocaleTimeString()}</span>}
                </div>
                {metrics ? (
                    <div className="metric-grid">
                        <div className="metric-tile">
                            <div className="metric-label">CPU usage</div>
                            <div className="metric-value">{metrics.cpuUsage.toFixed(1)}<small>%</small></div>
                            <div className="metric-track" aria-hidden="true">
                                <span style={{ width: `${metrics.cpuUsage}%` }} />
                            </div>
                        </div>
                        <div className="metric-tile">
                            <div className="metric-label">Memory</div>
                            <div className="metric-value">{ramPercent.toFixed(0)}<small>%</small></div>
                            <div className="metric-caption">
                                {metrics.ramUsed.toFixed(0)} / {metrics.ramTotal.toFixed(0)} MB
                            </div>
                            <div className="metric-track" aria-hidden="true">
                                <span style={{ width: `${ramPercent}%` }} />
                            </div>
                        </div>
                        <div className="metric-tile">
                            <div className="metric-label">Network latency</div>
                            <div className="metric-value">
                                {metrics.latencyMs === null ? "—" : metrics.latencyMs.toFixed(0)}
                                {metrics.latencyMs !== null && <small> ms</small>}
                            </div>
                            <div className="metric-caption">
                                {metrics.latencyMs === null ? "Unavailable" : "Round trip"}
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="machine-metrics-empty">Waiting for the worker’s first report.</p>
                )}
            </section>

            <footer className="machine-card-footer">
                <span>{machine.type} · {machine.department}</span>
                <button type="button" className="machine-attend-button">Attend</button>
            </footer>
        </article>
    );
}

export default MachineCard;
