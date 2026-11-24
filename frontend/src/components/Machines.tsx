import { useEffect, useState, type SubmitEvent } from "react";
import { apiFetch } from "../api";
import { DEPARTMENTS, MACHINE_TYPES, type Machine } from "../types/Machine";
import "./Tickets.css";
import "./Machines.css";

const EMPTY = { hostname: "", ipAddress: "", type: MACHINE_TYPES[0], department: DEPARTMENTS[0], ownerId: "" };

interface Owner {
  id: number;
  fullName: string;
  email: string;
}

// Enabling needs the hostname typed back (checked again by the server); disabling is one click
function RemoteControl({ machine, onChange }: { machine: Machine; onChange: (machine: Machine) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/v1/machines/${machine.id}/remote-control`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, confirmHostname: typed.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? "Failed to update remote control.");
      onChange(body);
      setConfirming(false);
      setTyped("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update remote control.");
    } finally {
      setBusy(false);
    }
  }

  if (machine.remoteControl) {
    return (
      <div className="rc-cell">
        <span className="rc-on">Enabled</span>
        <button type="button" className="rc-off-button" onClick={() => void apply(false)} disabled={busy}>
          {busy ? "Disabling…" : "Disable"}
        </button>
        {error && <p className="rc-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (!confirming) {
    return (
      <div className="rc-cell">
        <span className="muted">Disabled</span>
        <button type="button" onClick={() => setConfirming(true)}>Enable…</button>
      </div>
    );
  }

  const matches = typed.trim().toLowerCase() === machine.hostname.toLowerCase();
  return (
    <form className="rc-confirm" onSubmit={event => { event.preventDefault(); if (matches) void apply(true); }}>
      <label htmlFor={`rc-${machine.id}`}>
        Allows commands, file transfer and screen control on this machine. Type <strong>{machine.hostname}</strong> to confirm.
      </label>
      <div>
        <input id={`rc-${machine.id}`} value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" spellCheck={false} autoFocus />
        <button type="submit" className="rc-enable" disabled={busy || !matches}>{busy ? "Enabling…" : "Enable"}</button>
        <button type="button" onClick={() => { setConfirming(false); setTyped(""); setError(null); }}>Cancel</button>
      </div>
      {error && <p className="rc-error" role="alert">{error}</p>}
    </form>
  );
}

function Machines() {
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [machines, setMachines] = useState<Machine[] | null>(null);

  function loadMachines() {
    apiFetch("/api/v1/machines")
      .then(response => (response.ok ? response.json() : []))
      .then(setMachines)
      .catch(() => setMachines([]));
  }

  useEffect(loadMachines, []);

  useEffect(() => {
    apiFetch("/api/v1/users")
      .then(response => (response.ok ? response.json() : []))
      .then(setOwners)
      .catch(() => setOwners([]));
  }, []);

  function update(field: keyof typeof EMPTY, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const response = await apiFetch("/api/v1/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          hostname: form.hostname.trim(),
          ipAddress: form.ipAddress.trim(),
          ownerId: Number(form.ownerId),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? "Failed to add machine.");
      setForm(EMPTY);
      loadMachines();
      setMessage({ text: `Machine #${body.id} added. Set MachineId to ${body.id} in the worker configuration.`, error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Failed to add machine.", error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tickets-page">
      <h1>Machines</h1>
      <form className="ticket-form" onSubmit={handleSubmit}>
        <h2>Add machine</h2>
        <div className="ticket-form-row">
          <div className="ticket-field">
            <label htmlFor="hostname">HOSTNAME</label>
            <input
              id="hostname"
              value={form.hostname}
              onChange={event => update("hostname", event.target.value)}
              placeholder="DESKTOP-FIN01"
              maxLength={253}
              required
            />
          </div>
          <div className="ticket-field">
            <label htmlFor="ipAddress">IP ADDRESS</label>
            <input
              id="ipAddress"
              value={form.ipAddress}
              onChange={event => update("ipAddress", event.target.value)}
              placeholder="192.168.1.20"
              inputMode="decimal"
              pattern="(\d{1,3}\.){3}\d{1,3}"
              title="IPv4 address, e.g. 192.168.1.20"
              required
            />
          </div>
        </div>

        <div className="ticket-form-row">
          <div className="ticket-field">
            <label htmlFor="type">TYPE</label>
            <select id="type" value={form.type} onChange={event => update("type", event.target.value)}>
              {MACHINE_TYPES.map(type => <option key={type}>{type}</option>)}
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="department">DEPARTMENT</label>
            <select id="department" value={form.department} onChange={event => update("department", event.target.value)}>
              {DEPARTMENTS.map(name => <option key={name}>{name}</option>)}
            </select>
          </div>
        </div>

        <div className="ticket-field">
          <label htmlFor="owner">OWNER</label>
          <select id="owner" value={form.ownerId} onChange={event => update("ownerId", event.target.value)} required>
            <option value="" disabled>Select a user</option>
            {owners.map(owner => (
              <option key={owner.id} value={owner.id}>{owner.fullName} ({owner.email})</option>
            ))}
          </select>
        </div>

        <div className="ticket-form-footer">
          {message && (
            <p className={`ticket-message ${message.error ? "error" : ""}`} role={message.error ? "alert" : "status"}>
              {message.text}
            </p>
          )}
          <button type="submit" className="ticket-submit" disabled={saving}>
            {saving ? "Adding…" : "Add machine"}
          </button>
        </div>
      </form>

      <section className="machines-list" aria-label="Registered machines">
        <h2>Registered machines</h2>
        {machines === null ? (
          <div className="skeleton ticket-skeleton" />
        ) : machines.length === 0 ? (
          <p className="ticket-empty">No machines registered yet.</p>
        ) : (
          <table className="machines-table">
            <thead>
              <tr><th>Host</th><th>Department</th><th>IP address</th><th>Owner</th><th>Remote control</th></tr>
            </thead>
            <tbody>
              {machines.map(machine => (
                <tr key={machine.id}>
                  <td><strong>{machine.hostname}</strong><span>#{machine.id} · {machine.type}</span></td>
                  <td>{machine.department}</td>
                  <td>{machine.ipAddress}</td>
                  <td>{machine.ownerFullName}</td>
                  <td>
                    <RemoteControl
                      machine={machine}
                      onChange={updated => setMachines(current => current?.map(m => (m.id === updated.id ? updated : m)) ?? null)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default Machines;
