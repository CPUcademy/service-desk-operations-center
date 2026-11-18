import { useEffect, useState } from "react";
import MachineCard from "./MachineCard";
import { DEPARTMENTS, getMachineState, MACHINE_STATE_LABEL, type Machine, type MachineState } from "../types/Machine";
import { apiFetch } from "../api";
import "./InnerDashboard.css";

function InnerDashboard() {
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState("");
    const [state, setState] = useState<MachineState | "">("");
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
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

    const reportingMetrics = machines.flatMap(machine =>
        machine.metrics ? [machine.metrics] : []
    );
    const onlineCount = machines.filter(machine =>
        ["online", "alert"].includes(getMachineState(machine))
    ).length;
    const query = search.trim().toLowerCase();
    const visibleMachines = machines.filter(machine =>
        (!department || machine.department.toLowerCase() === department.toLowerCase())
        && (!state || getMachineState(machine) === state)
        && (!query || [String(machine.id), machine.hostname, machine.ipAddress]
            .some(value => value.toLowerCase().includes(query)))
    );
    const averageCpu = reportingMetrics.length
        ? reportingMetrics.reduce((sum, metrics) => sum + metrics.cpuUsage, 0) / reportingMetrics.length
        : null;
    const latencies = reportingMetrics.flatMap(metrics =>
        metrics.latencyMs === null ? [] : [metrics.latencyMs]
    );
    const averageLatency = latencies.length
        ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
        : null;
    const averageRam = reportingMetrics.length
        ? reportingMetrics.reduce((sum, metrics) => sum + metrics.ramUsed / metrics.ramTotal, 0) / reportingMetrics.length * 100
        : null;
    const dashboardStats = [
        {
            label: "Machines online",
            value: `${onlineCount} / ${machines.length}`,
        },
        {
            label: "Average CPU",
            value: averageCpu === null ? "—" : `${averageCpu.toFixed(1)}%`,
        },
        {
            label: "Average memory",
            value: averageRam === null ? "—" : `${averageRam.toFixed(1)}%`,
        },
        {
            label: "Average latency",
            value: averageLatency === null ? "—" : `${averageLatency.toFixed(0)} ms`,
        },
    ];

    return (
        <main className="machine-dashboard">
            <section className="dashboard-stats" aria-label="Fleet statistics">
                {dashboardStats.map(stat => (
                    <article className="dashboard-stat" key={stat.label}>
                        <span className="dashboard-stat-label">{stat.label}</span>
                        {loading
                            ? <span className="skeleton dashboard-stat-skeleton" />
                            : <strong>{stat.value}</strong>}
                    </article>
                ))}
                {error && (
                    <article className="dashboard-stat dashboard-stat-error" role="alert">
                        <span className="dashboard-stat-label">Data connection</span>
                        <strong>Error</strong>
                        <span className="dashboard-stat-detail">{error} · retrying</span>
                    </article>
                )}
            </section>
            <section className="machine-filters" aria-label="Filter machines">
                <input
                    type="search"
                    className="machine-search"
                    placeholder="Search by ID, hostname or IP"
                    aria-label="Search machines"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                />
                <select
                    className="machine-filter"
                    aria-label="Department"
                    value={department}
                    onChange={event => setDepartment(event.target.value)}
                >
                    <option value="">All departments</option>
                    {DEPARTMENTS.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <select
                    className="machine-filter"
                    aria-label="Status"
                    value={state}
                    onChange={event => setState(event.target.value as MachineState | "")}
                >
                    <option value="">All statuses</option>
                    {(Object.keys(MACHINE_STATE_LABEL) as MachineState[]).map(key => (
                        <option key={key} value={key}>{MACHINE_STATE_LABEL[key]}</option>
                    ))}
                </select>
            </section>
            <section className="machine-stat-grid" aria-label="Statistics for each machine">
                {loading
                    ? [0, 1, 2].map(i => <div key={i} className="skeleton machine-card-skeleton" />)
                    : visibleMachines.map(machine => (
                        <MachineCard key={machine.id} machine={machine} />
                    ))}
                {!loading && !error && visibleMachines.length === 0 && (
                    <p className="machine-grid-empty">
                        {machines.length ? "No machines match your filters." : "No machines registered yet."}
                    </p>
                )}
            </section>
        </main>
    );
}
export default InnerDashboard;
