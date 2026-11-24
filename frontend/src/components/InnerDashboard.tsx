import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MonitorPlay, Search } from "lucide-react";
import { DEPARTMENTS, getMachineState, MACHINE_STATE_LABEL, type Machine, type MachineState } from "../types/Machine";
import { apiFetch } from "../api";
import "./InnerDashboard.css";

const STATES = Object.keys(MACHINE_STATE_LABEL) as MachineState[];

const loadTone = (percent: number) => Math.round(percent) >= 90 ? "is-bad" : Math.round(percent) >= 70 ? "is-warn" : "";

function Meter({ percent }: { percent: number }) {
    return (
        <span className={`meter ${loadTone(percent)}`} aria-hidden="true">
            <span style={{ width: `${Math.min(100, percent)}%` }} />
        </span>
    );
}

function SessionLink({ machine }: { machine: Machine }) {
    const state = getMachineState(machine);
    if (state === "offline") return null;
    return (
        <Link className="session-link" to={`/session/${machine.id}`} title={`Remote session to ${machine.hostname}`}>
            <MonitorPlay size={14} aria-hidden="true" />
            {state === "insession" ? "Resume" : "Connect"}
        </Link>
    );
}

function InnerDashboard() {
    const [view, setView] = useState<"table" | "cards">("table");
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState("");
    const [state, setState] = useState<MachineState | "">("");
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    useEffect(() => {
        let active = true;
        let timeoutId: number;

        async function fetchMachines() {
            try {
                const response = await apiFetch('/api/v1/machines');

                if (!response.ok) {
                    throw new Error('Failed to fetch machines');
                }

                const data: Machine[] = await response.json();

                if (active) {
                    setMachines(data);
                    setError(null);
                    setUpdatedAt(new Date());
                }
            } catch (err) {
                if (active) {
                    setError(err instanceof Error ? err.message : 'Unknown error');
                }
            } finally {
                if (active) {
                    setLoading(false);
                    timeoutId = window.setTimeout(() => void fetchMachines(), 5000);
                }
            }
        }

        void fetchMachines();
        return () => {
            active = false;
            window.clearTimeout(timeoutId);
        };
    }, []);

    const stateCounts = Object.fromEntries(STATES.map(key => [key, 0])) as Record<MachineState, number>;
    machines.forEach(machine => stateCounts[getMachineState(machine)]++);
    const onlineCount = stateCounts.online + stateCounts.insession + stateCounts.alert;

    const reportingMetrics = machines.flatMap(machine =>
        machine.metrics ? [machine.metrics] : []
    );
    const average = (values: number[]) =>
        values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const averageCpu = average(reportingMetrics.map(metrics => metrics.cpuUsage));
    const averageRam = average(reportingMetrics.map(metrics => metrics.ramUsed / metrics.ramTotal * 100));
    const averageLatency = average(reportingMetrics.flatMap(metrics =>
        metrics.latencyMs === null ? [] : [metrics.latencyMs]
    ));

    const query = search.trim().toLowerCase();
    const visibleMachines = machines.filter(machine =>
        (!department || machine.department.toLowerCase() === department.toLowerCase())
        && (!state || getMachineState(machine) === state)
        && (!query || (query.startsWith("#")
            ? Number(query.slice(1)) === machine.id
            : [String(machine.id), machine.hostname, machine.ipAddress, machine.ownerFullName ?? ""]
                .some(value => value.toLowerCase().includes(query))))
    );

    const value = (content: React.ReactNode) =>
        loading ? <span className="skeleton summary-skeleton" /> : content;

    return (
        <main className="machine-dashboard">
            <header className="dashboard-head">
                <h1>Dashboard</h1>
                <span className={error ? "dashboard-feed is-down" : "dashboard-feed"}>
                    {error ? "Connection lost · retrying" : updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Connecting…"}
                </span>
            </header>

            <section className="summary" aria-label="Fleet statistics">
                <div className="summary-stats">
                    <div className="stat">
                        <span className="stat-label">Online</span>
                        {value(<strong>{onlineCount}<small>/{machines.length}</small></strong>)}
                    </div>
                    <div className="stat">
                        <span className="stat-label">Avg. CPU</span>
                        {value(<strong className={loadTone(averageCpu ?? 0)}>{averageCpu === null ? "—" : averageCpu.toFixed(1)}<small>%</small></strong>)}
                    </div>
                    <div className="stat">
                        <span className="stat-label">Avg. memory</span>
                        {value(<strong className={loadTone(averageRam ?? 0)}>{averageRam === null ? "—" : averageRam.toFixed(1)}<small>%</small></strong>)}
                    </div>
                    <div className="stat">
                        <span className="stat-label">Avg. latency</span>
                        {value(<strong>{averageLatency === null ? "—" : averageLatency.toFixed(0)}<small>ms</small></strong>)}
                    </div>
                </div>
            </section>

            <section className="hosts" aria-label="Machines">
                <div className="hosts-toolbar">
                    <div className="state-tabs" role="tablist" aria-label="Status">
                        {(["", ...STATES] as const).map(key => (
                            <button
                                key={key}
                                role="tab"
                                aria-selected={state === key}
                                className="state-tab"
                                onClick={() => setState(key)}
                            >
                                {key ? MACHINE_STATE_LABEL[key] : "All"}
                                <span>{key ? stateCounts[key] : machines.length}</span>
                            </button>
                        ))}
                    </div>
                    <div className="hosts-filters">
                        <label className="machine-search">
                            <Search size={14} aria-hidden="true" />
                            <input
                                type="search"
                                placeholder="#ID, hostname, IP or user"
                                aria-label="Search machines"
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                            />
                        </label>
                        <select
                            className="machine-filter"
                            aria-label="Department"
                            value={department}
                            onChange={event => setDepartment(event.target.value)}
                        >
                            <option value="">All departments</option>
                            {DEPARTMENTS.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <div className="view-toggle" role="group" aria-label="View">
                            {(["table", "cards"] as const).map(key => (
                                <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>
                                    {key === "table" ? "Table" : "Cards"}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {error && <p className="hosts-error" role="alert">{error}. Showing last known data.</p>}

                {view === "cards" && !loading && (
                    <div className="host-cards">
                        {visibleMachines.map(machine => {
                            const machineState = getMachineState(machine);
                            const metrics = machine.metrics;
                            const ramPercent = metrics ? metrics.ramUsed / metrics.ramTotal * 100 : 0;
                            return (
                                <article key={machine.id} className={`host-card is-${machineState}`}>
                                    <header>
                                        <div className="host-cell">
                                            <strong>{machine.hostname}</strong>
                                            <span>#{machine.id} · {machine.type} · {machine.department}</span>
                                        </div>
                                        <span className={`status is-${machineState}`}>{MACHINE_STATE_LABEL[machineState]}</span>
                                    </header>
                                    <dl>
                                        <div><dt>IP</dt><dd>{machine.ipAddress}</dd></div>
                                        <div><dt>User</dt><dd>{machine.ownerFullName ?? "—"}</dd></div>
                                    </dl>
                                    <div className="host-card-metrics">
                                        <div className="metric-cell">
                                            <span className="stat-label">CPU</span>
                                            {metrics ? <><Meter percent={metrics.cpuUsage} /><span className={loadTone(metrics.cpuUsage)}>{metrics.cpuUsage.toFixed(0)}%</span></> : <span className="muted">—</span>}
                                        </div>
                                        <div className="metric-cell">
                                            <span className="stat-label">Memory</span>
                                            {metrics ? <><Meter percent={ramPercent} /><span className={loadTone(ramPercent)}>{ramPercent.toFixed(0)}%</span></> : <span className="muted">—</span>}
                                        </div>
                                        <div className="metric-cell">
                                            <span className="stat-label">Latency</span>
                                            <span>{metrics?.latencyMs == null ? "—" : `${metrics.latencyMs.toFixed(0)} ms`}</span>
                                        </div>
                                    </div>
                                    <footer>
                                        <span className="muted">
                                            {metrics ? `Reported ${new Date(metrics.reportedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No telemetry"}
                                        </span>
                                        <SessionLink machine={machine} />
                                    </footer>
                                </article>
                            );
                        })}
                    </div>
                )}

                {(view === "table" || loading) && (
                <table className="host-table">
                    <thead>
                        <tr>
                            <th>Host</th>
                            <th>Status</th>
                            <th>Department</th>
                            <th>IP address</th>
                            <th className="num">CPU</th>
                            <th className="num">Memory</th>
                            <th className="num">Latency</th>
                            <th className="num">Reported</th>
                            <th><span className="visually-hidden">Session</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading
                            ? [0, 1, 2, 3].map(i => (
                                <tr key={i}><td colSpan={9}><span className="skeleton row-skeleton" /></td></tr>
                            ))
                            : visibleMachines.map(machine => {
                                const machineState = getMachineState(machine);
                                const metrics = machine.metrics;
                                const ramPercent = metrics ? metrics.ramUsed / metrics.ramTotal * 100 : 0;
                                return (
                                    <tr key={machine.id} className={`is-${machineState}`}>
                                        <td className="host-cell">
                                            <strong>{machine.hostname}</strong>
                                            <span>#{machine.id} · {machine.type}{machine.ownerFullName ? ` · ${machine.ownerFullName}` : ""}</span>
                                        </td>
                                        <td className="status-cell">
                                            <span className={`status is-${machineState}`}>{MACHINE_STATE_LABEL[machineState]}</span>
                                        </td>
                                        <td className="dept-cell">{machine.department}</td>
                                        <td className="ip-cell">{machine.ipAddress}</td>
                                        <td className="num metric-cell" data-label="CPU">
                                            {metrics ? <><Meter percent={metrics.cpuUsage} /><span className={loadTone(metrics.cpuUsage)}>{metrics.cpuUsage.toFixed(0)}%</span></> : <span className="muted">—</span>}
                                        </td>
                                        <td className="num metric-cell" data-label="Memory" title={metrics ? `${(metrics.ramUsed / 1024).toFixed(1)} / ${(metrics.ramTotal / 1024).toFixed(1)} GB` : undefined}>
                                            {metrics ? <><Meter percent={ramPercent} /><span className={loadTone(ramPercent)}>{ramPercent.toFixed(0)}%</span></> : <span className="muted">—</span>}
                                        </td>
                                        <td className="num" data-label="Latency">
                                            {metrics?.latencyMs == null ? <span className="muted">—</span> : `${metrics.latencyMs.toFixed(0)} ms`}
                                        </td>
                                        <td className="num muted" data-label="Reported">
                                            {metrics ? new Date(metrics.reportedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                                        </td>
                                        <td className="session-cell"><SessionLink machine={machine} /></td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
                )}

                {!loading && visibleMachines.length === 0 && (
                    <p className="hosts-empty">
                        {machines.length ? "No machines match these filters." : "No machines registered yet."}
                    </p>
                )}
            </section>
        </main>
    );
}
export default InnerDashboard;
