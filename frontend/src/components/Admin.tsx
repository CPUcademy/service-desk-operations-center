import { useState, type SubmitEvent } from "react";
import { apiFetch } from "../api";
import { DEPARTMENTS, MACHINE_TYPES } from "../types/Machine";
import "./Profile.css";

const EMPTY = { hostname: "", ipAddress: "", type: MACHINE_TYPES[0], department: DEPARTMENTS[0] };

function Admin() {
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field: keyof typeof EMPTY, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const response = await apiFetch("/api/v1/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, hostname: form.hostname.trim(), ipAddress: form.ipAddress.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? "Failed to add machine.");
      setForm(EMPTY);
      setMessage(`Machine #${body.id} added. Set MachineId to ${body.id} in the worker on that computer.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add machine.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page">
      <h1>Add machine</h1>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="password-fields">
          <div className="profile-field">
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
          <div className="profile-field">
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

        <div className="password-fields">
          <div className="profile-field">
            <label htmlFor="type">TYPE</label>
            <select id="type" value={form.type} onChange={event => update("type", event.target.value)}>
              {MACHINE_TYPES.map(type => <option key={type}>{type}</option>)}
            </select>
          </div>
          <div className="profile-field">
            <label htmlFor="department">DEPARTMENT</label>
            <select id="department" value={form.department} onChange={event => update("department", event.target.value)}>
              {DEPARTMENTS.map(name => <option key={name}>{name}</option>)}
            </select>
          </div>
        </div>

        {message && <p className="profile-message" role="status">{message}</p>}

        <div className="profile-actions">
          <button type="submit" className="profile-save-button" disabled={saving}>
            {saving ? "Adding…" : "Add machine"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Admin;
