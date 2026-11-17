import { useEffect, useState } from "react";
import MachineCard from "./MachineCard";
import type { Machine } from "../types/Machine";
import { API_URL } from "../config";
import "./InnerDashboard.css";

function InnerDashboard() {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        let timeoutId: number;

        async function fetchMachines() {
            try {
                const response = await fetch(
                    `${API_URL}/api/v1/machines`,
                    {
                        method: 'GET',
                        credentials: 'include'
                    }
                );

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
        ["online", "active", "available"].includes(machine.status.toLowerCase())
    ).length;
    const averageCpu = reportingMetrics.length
        ? reportingMetrics.reduce((sum, metrics) => sum + metrics.cpuUsage, 0) / reportingMetrics.length
        : null;
    const latencies = reportingMetrics.flatMap(metrics =>
        metrics.latencyMs === null ? [] : [metrics.latencyMs]
    );
    const averageLatency = latencies.length
        ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
        : null;
    const ramUsed = reportingMetrics.reduce((sum, metrics) => sum + metrics.ramUsed, 0);
    const ramTotal = reportingMetrics.reduce((sum, metrics) => sum + metrics.ramTotal, 0);
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
            label: "Memory in use",
            value: ramTotal ? `${(ramUsed / 1024).toFixed(1)} GB` : "—",
            detail: ramTotal
                    ? `of ${(ramTotal / 1024).toFixed(1)} GB total (${((ramUsed / ramTotal) * 100).toFixed(0)}%)`
                    : "No reports yet",
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
                        {!loading && "detail" in stat && stat.detail && <span className="dashboard-stat-detail">{stat.detail}</span>}
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
            <section className="machine-stat-grid" aria-label="Statistics for each machine">
                {loading
                    ? [0, 1, 2].map(i => <div key={i} className="skeleton machine-card-skeleton" />)
                    : machines.map(machine => (
                        <MachineCard key={machine.id} machine={machine} />
                    ))}
                {!loading && !error && machines.length === 0 && (
                    <p className="machine-grid-empty">No machines registered yet.</p>
                )}
            </section>
        </main>
    );
}
export default InnerDashboard;
