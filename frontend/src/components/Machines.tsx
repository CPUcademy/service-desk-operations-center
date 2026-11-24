import { useEffect, useState, type SubmitEvent } from "react";
import { apiFetch } from "../api";
import { API_URL } from "../config";
import { DEPARTMENTS, MACHINE_TYPES } from "../types/Machine";
import "./Tickets.css";

const API_BASE = API_URL || window.location.origin;
const DEFENDER_COMMAND = `Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\CI\\Policy" -Name VerifiedAndReputablePolicyState -Value 0 -Type DWord; CiTool.exe -r`;
const INSTALL_COMMAND = `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm ${API_BASE}/api/v1/agent/install.ps1 | iex"`;

const EMPTY = { hostname: "", ipAddress: "", type: MACHINE_TYPES[0], department: DEPARTMENTS[0], ownerId: "" };

interface Owner {
  id: number;
  fullName: string;
  email: string;
}

function WorkerKey() {
  const [key, setKey] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  function reveal() {
    setShown(true);
    if (key !== null) return;
    apiFetch("/api/v1/agent/key")
      .then(async response => {
        if (response.ok) return setKey((await response.json()).key);
        setKey(response.status === 404 ? "not available: deploy the latest backend"
          : response.status === 401 || response.status === 403 ? "admins only: sign in again"
          : `server error ${response.status}`);
      })
      .catch(() => setKey("server unreachable"));
  }

  return (
    <code
      className="worker-key"
      tabIndex={0}
      title="Hover to reveal"
      onMouseEnter={reveal}
      onMouseLeave={() => setShown(false)}
      onFocus={reveal}
      onBlur={() => setShown(false)}
    >
      {shown ? key ?? "loading…" : "•••••••••••• hover to reveal"}
    </code>
  );
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="install-command">
      <code>{command}</code>
      <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

function Machines() {
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);
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
      setMessage({ text: `Machine #${body.id} added.`, error: false });
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
            <label htmlFor="hostname">HOSTNAME (CAN BE EMPTY)</label>
            <input
              id="hostname"
              value={form.hostname}
              onChange={event => update("hostname", event.target.value)}
              placeholder="Default: MACHINE-<id>"
              maxLength={253}
            />
          </div>
          <div className="ticket-field">
            <label htmlFor="ipAddress">IP ADDRESS (CAN BE EMPTY)</label>
            <input
              id="ipAddress"
              value={form.ipAddress}
              onChange={event => update("ipAddress", event.target.value)}
              placeholder="Default: 0.0.0.0"
              inputMode="decimal"
              pattern="(\d{1,3}\.){3}\d{1,3}"
              title="IPv4 address, e.g. 192.168.1.20"
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

      <section className="ticket-form install-guide" aria-labelledby="install-title">
        <h2 id="install-title">Install the agent on a computer</h2>
        <ol>
          <li>Add the machine in the form above and note its ID (the #number, also shown on the Dashboard).</li>
          <li>
            On that machine, open PowerShell as Administrator. Antivirus software often flags remote support tools,
            so first allow the workers's folders. With Microsoft Defender run:
            <CopyCommand command={DEFENDER_COMMAND} />
            With other antivirus software, add the same two folders as exclusions in its settings.
          </li>
          <li>
            In the same PowerShell window run:
            <CopyCommand command={INSTALL_COMMAND} />
          </li>
          <li>
            Answer the three prompts: the machine ID, the worker API key (<WorkerKey />), and whether to allow remote control on that computer.
          </li>
        </ol>
        <p className="install-note">
          Running the same command again updates the agent. Without PowerShell internet access, <a href={`${API_BASE}/api/v1/agent/download`}>download the agent package</a>,
          extract it and run <code>install-service.ps1</code> as Administrator.
        </p>
      </section>
    </div>
  );
}

export default Machines;
