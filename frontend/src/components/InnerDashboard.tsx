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
            label: "Total machines",
            value: String(machines.length),
            detail: "Registered devices",
        },
        {
            label: "Online",
            value: String(onlineCount),
            detail: "Available machines",
        },
        {
            label: "Reporting",
            value: `${reportingMetrics.length} / ${machines.length}`,
            detail: "Sending metrics",
        },
        {
            label: "Average CPU",
            value: averageCpu === null ? "—" : `${averageCpu.toFixed(1)}%`,
            detail: "Across reporting machines",
        },
        {
            label: "Memory in use",
            value: ramTotal ? `${(ramUsed / 1024).toFixed(1)} GB` : "—",
            detail: ramTotal ? `of ${(ramTotal / 1024).toFixed(1)} GB total` : "No reports yet",
        },
        {
            label: "Average latency",
            value: averageLatency === null ? "—" : `${averageLatency.toFixed(0)} ms`,
            detail: `${latencies.length} responding ${latencies.length === 1 ? "machine" : "machines"}`,
        },
    ];

    if (loading) {
        return <p className="dashboard-message">Loading machines...</p>;
    }

    if (error && machines.length === 0) {
        return <p className="dashboard-message dashboard-error" role="alert">{error}</p>;
    }

    return (
        <main className="machine-dashboard">
            <header className="machine-dashboard-header">
                <div>
                    <p className="dashboard-eyebrow">Operations center</p>
                    <h1>Machine dashboard</h1>
                    <p className="dashboard-subtitle">Monitor device status and live system health.</p>
                </div>
            </header>
            {error && <p className="dashboard-error" role="alert">{error} — retrying…</p>}
            <section className="dashboard-stats" aria-label="Fleet statistics">
                {dashboardStats.map(stat => (
                    <article className="dashboard-stat" key={stat.label}>
                        <span className="dashboard-stat-label">{stat.label}</span>
                        <strong>{stat.value}</strong>
                        <span className="dashboard-stat-detail">{stat.detail}</span>
                    </article>
                ))}
            </section>
            {machines.length > 0 ? (
                <section className="machine-grid" aria-label="Machines">
                    {machines.map(machine => <MachineCard key={machine.id} machine={machine} />)}
                </section>
            ) : (
                <section className="dashboard-empty">
                    <h2>No machines registered</h2>
                    <p>Machines will appear here once they have been added to the service desk.</p>
                </section>
            )}
        </main>
    );
}
export default InnerDashboard;
