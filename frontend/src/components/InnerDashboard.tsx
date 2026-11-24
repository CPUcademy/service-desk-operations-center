import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MonitorPlay, MoreHorizontal, Search } from "lucide-react";
import { DEPARTMENTS, MACHINE_TYPES, canControl, getMachineState, MACHINE_STATE_LABEL, type Machine, type MachineState } from "../types/Machine";
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
    if (!canControl(machine)) return null;
    const label = state === "insession" ? "Resume" : "Connect";
    return (
        <Link className="session-link is-compact" to={`/session/${machine.id}`} title={`${label}: remote session to ${machine.hostname}`}>
            <MonitorPlay size={14} aria-hidden="true" />
            <span className="visually-hidden">{label}</span>
        </Link>
    );
}

async function setRemoteControl(machine: Machine, enabled: boolean, confirmHostname = ""): Promise<Machine> {
    const response = await apiFetch(`/api/v1/machines/${machine.id}/remote-control`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, confirmHostname }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message ?? "Failed to update remote control.");
    return body;
}

type Owner = { id: number; fullName: string; email: string };

function EditMachine({ machine, onSaved, onClose }: { machine: Machine; onSaved: (machine: Machine) => void; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [form, setForm] = useState({
        hostname: machine.hostname,
        ipAddress: machine.ipAddress,
        type: machine.type,
        department: machine.department,
        ownerId: String(machine.ownerId),
    });
    const [owners, setOwners] = useState<Owner[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { dialog.current?.showModal(); }, []);

    useEffect(() => {
        apiFetch("/api/v1/users")
            .then(response => (response.ok ? response.json() : []))
            .then(setOwners)
            .catch(() => setOwners([]));
    }, []);

    const update = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(current => ({ ...current, [field]: event.target.value }));

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const response = await apiFetch(`/api/v1/machines/${machine.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, hostname: form.hostname.trim(), ipAddress: form.ipAddress.trim(), ownerId: Number(form.ownerId) }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error(body?.message ?? "Failed to save the machine.");
            onSaved(body);
            dialog.current?.close();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save the machine.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <dialog ref={dialog} className="rc-dialog" onClose={onClose}>
            <form onSubmit={submit}>
                <h2>Edit machine #{machine.id}</h2>
                <div className="edit-grid">
                    <label>
                        Hostname
                        <input value={form.hostname} onChange={update("hostname")} maxLength={253} required spellCheck={false} />
                    </label>
                    <label>
                        IP address
                        <input
                            value={form.ipAddress}
                            onChange={update("ipAddress")}
                            inputMode="decimal"
                            pattern="(\d{1,3}\.){3}\d{1,3}"
                            title="IPv4 address, e.g. 192.168.1.20"
                            required
                        />
                    </label>
                    <label>
                        Type
                        <select value={form.type} onChange={update("type")}>
                            {MACHINE_TYPES.map(type => <option key={type}>{type}</option>)}
                        </select>
                    </label>
                    <label>
                        Department
                        <select value={form.department} onChange={update("department")}>
                            {DEPARTMENTS.map(name => <option key={name}>{name}</option>)}
                        </select>
                    </label>
                    <label className="edit-wide">
                        Owner
                        <select value={form.ownerId} onChange={update("ownerId")} required>
                            {owners.length === 0 && <option value={machine.ownerId}>{machine.ownerFullName}</option>}
                            {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.fullName} ({owner.email})</option>)}
                        </select>
                    </label>
                </div>
                {error && <p className="rc-error" role="alert">{error}</p>}
                <div className="rc-dialog-actions">
                    <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
                    <button type="submit" className="is-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                </div>
            </form>
        </dialog>
    );
}

function RemoveMachine({ machine, onRemoved, onClose }: { machine: Machine; onRemoved: () => void; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const matches = typed.trim().toLowerCase() === machine.hostname.toLowerCase();

    useEffect(() => { dialog.current?.showModal(); }, []);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!matches) return;
        setBusy(true);
        setError(null);
        try {
            const response = await apiFetch(`/api/v1/machines/${machine.id}?confirmHostname=${encodeURIComponent(typed.trim())}`, { method: "DELETE" });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.message ?? "Failed to remove the machine.");
            }
            dialog.current?.close();
            onRemoved();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to remove the machine.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <dialog ref={dialog} className="rc-dialog" onClose={onClose}>
            <form onSubmit={submit}>
                <h2>Remove machine #{machine.id}</h2>
                <p>
                    This permanently deletes the machine and all its tickets. Its worker is disconnected and can't reconnect.
                    Type <strong>{machine.hostname}</strong> to confirm.
                </p>
                <input value={typed} onChange={event => setTyped(event.target.value)} aria-label="Hostname" autoComplete="off" spellCheck={false} />
                {error && <p className="rc-error" role="alert">{error}</p>}
                <div className="rc-dialog-actions">
                    <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
                    <button type="submit" className="is-danger" disabled={busy || !matches}>{busy ? "Removing…" : "Remove"}</button>
                </div>
            </form>
        </dialog>
    );
}

function RowMenu({ machine, onChange, onRemoved }: { machine: Machine; onChange: (machine: Machine) => void; onRemoved: () => void }) {
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [editing, setEditing] = useState(false);
    const [removing, setRemoving] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const matches = typed.trim().toLowerCase() === machine.hostname.toLowerCase();

    async function apply(enabled: boolean) {
        setBusy(true);
        setError(null);
        try {
            onChange(await setRemoteControl(machine, enabled, typed.trim()));
            dialog.current?.close();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update remote control.");
        } finally {
            setBusy(false);
        }
    }

    function choose() {
        setOpen(false);
        if (machine.remoteControl) return void apply(false);
        setTyped("");
        setError(null);
        setConfirming(true);
        dialog.current?.showModal();
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (matches) void apply(true);
    }

    return (
        <div className="row-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
            <button
                type="button"
                className="row-menu-button"
                aria-label={`Actions for ${machine.hostname}`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(current => !current)}
                disabled={busy}
            >
                <MoreHorizontal size={16} aria-hidden="true" />
            </button>
            {open && (
                <div className="row-menu-list" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setOpen(false); setEditing(true); }}>
                        Edit machine
                    </button>
                    <button type="button" role="menuitem" className="is-danger" onClick={() => { setOpen(false); setRemoving(true); }}>
                        Remove machine
                    </button>
                    {machine.remoteControl || machine.agentRemoteControl ? (
                        <button type="button" role="menuitem" className={machine.remoteControl ? "" : "is-danger"} onClick={choose}>
                            {machine.remoteControl ? "Disable remote control" : "Enable remote control"}
                        </button>
                    ) : (
                        <span className="row-menu-note">
                            {machine.agentRemoteControl === false
                                ? "Remote control is blocked on this machine by its worker settings"
                                : machine.agentRemoteControl === undefined
                                    ? "Remote control status unknown. Deploy the latest backend."
                                    : getMachineState(machine) === "offline"
                                        ? "The worker is offline"
                                        : "This worker doesn't support remote control. Reinstall it with the latest version."}
                        </span>
                    )}
                </div>
            )}
            {error && !confirming && <span className="row-menu-error" role="alert">{error}</span>}
            {editing && <EditMachine machine={machine} onSaved={onChange} onClose={() => setEditing(false)} />}
            {removing && <RemoveMachine machine={machine} onRemoved={onRemoved} onClose={() => setRemoving(false)} />}

            <dialog ref={dialog} className="rc-dialog" onClose={() => { setConfirming(false); setTyped(""); }}>
                <form onSubmit={submit}>
                    <h2>Enable remote control</h2>
                    <p>Allows commands, file transfer and screen control on this machine. Type <strong>{machine.hostname}</strong> to confirm.</p>
                    <input value={typed} onChange={event => setTyped(event.target.value)} aria-label="Hostname" autoComplete="off" spellCheck={false} />
                    {error && <p className="rc-error" role="alert">{error}</p>}
                    <div className="rc-dialog-actions">
                        <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
                        <button type="submit" className="is-danger" disabled={busy || !matches}>{busy ? "Enabling…" : "Enable"}</button>
                    </div>
                </form>
            </dialog>
        </div>
    );
}

function InnerDashboard() {
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
                    </div>
                </div>

                {error && <p className="hosts-error" role="alert">{error}. Showing last known data.</p>}

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
                            <th><span className="visually-hidden">Actions</span></th>
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
                                        <td className="session-cell">
                                            <SessionLink machine={machine} />
                                            <RowMenu
                                                machine={machine}
                                                onChange={updated => setMachines(current => current.map(m => (m.id === updated.id ? updated : m)))}
                                                onRemoved={() => setMachines(current => current.filter(m => m.id !== machine.id))}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>

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
