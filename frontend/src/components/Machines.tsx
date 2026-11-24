import { useEffect, useState, type SubmitEvent } from "react";
import { apiFetch } from "../api";
import { API_URL } from "../config";
import { DEPARTMENTS, MACHINE_TYPES } from "../types/Machine";
import "./Tickets.css";

const API_BASE = API_URL || window.location.origin;
const DEFENDER_COMMAND = `Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\CI\\Policy" -Name VerifiedAndReputablePolicyState -Value 0 -Type DWord; CiTool.exe -r`;
const INSTALL_COMMAND = `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm ${API_BASE}/api/v1/worker/install.ps1 | iex"`;
const LINUX_INSTALL_COMMAND = `sudo bash -c "$(curl -fsSL ${API_BASE}/api/v1/worker/install.sh)"`;

const EMPTY = { hostname: "", ipAddress: "", type: MACHINE_TYPES[0], department: DEPARTMENTS[0], ownerId: "" };

interface Owner {
  id: number;
  fullName: string;
  email: string;
}

function WorkerKey() {
  const [key, setKey] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  function reveal() {
    setShown(true);
    if (key !== null) return;
    setProblem(null);
    apiFetch("/api/v1/worker/key")
      .then(async response => {
        if (response.ok) return setKey((await response.json()).key);
        setProblem(`couldn't load the key (HTTP ${response.status}), hover again to retry`);
      })
      .catch(() => setProblem("server unreachable, hover again to retry"));
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
      {shown ? key ?? problem ?? "loading…" : "•••••••••••• hover to reveal"}
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
  const [os, setOs] = useState<"windows" | "linux">("windows");
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
        <div className="install-head">
          <h2 id="install-title">Install the worker</h2>
          <div className="os-toggle" role="group" aria-label="Operating system">
            {(["windows", "linux"] as const).map(value => (
              <button key={value} type="button" aria-pressed={os === value} onClick={() => setOs(value)}>
                {value === "windows" ? "Windows" : "Linux"}
              </button>
            ))}
          </div>
        </div>
        <ol>
          <li>Add the machine in the form above and note its ID (the #number, also shown on the Dashboard).</li>
          {os === "windows" ? (
            <li>
              On that machine, open PowerShell as Administrator. Antivirus software often flags remote support tools,
              so first allow the worker's folders. With Microsoft Defender run:
              <CopyCommand command={DEFENDER_COMMAND} />
              With other antivirus software, add the same two folders as exclusions in its settings.
            </li>
          ) : (
            <li>On that server, open a terminal as a user with sudo rights. It needs <code>curl</code>, systemd and OpenSSL.</li>
          )}
          <li>
            {os === "windows" ? "In the same PowerShell window run:" : "Run:"}
            <CopyCommand command={os === "windows" ? INSTALL_COMMAND : LINUX_INSTALL_COMMAND} />
          </li>
          <li>
            Answer the three prompts: the machine ID, the worker API key (<WorkerKey />), and whether to allow remote control on that machine.
          </li>
        </ol>
        {os === "windows" ? (
          <p className="install-note">
            Running the same command again updates the worker. Without PowerShell internet access, <a href={`${API_BASE}/api/v1/worker/download`}>download the worker package</a>,
            extract it and run <code>install-service.ps1</code> as Administrator.
          </p>
        ) : (
          <p className="install-note">
            Linux servers have no desktop, so remote control there means the shell and file transfer. Running the same command again updates the worker.
            To install by hand, <a href={`${API_BASE}/api/v1/worker/download?os=linux`}>download the Linux package</a>, extract it and run <code>sudo ./install-worker.sh</code>.
            Logs: <code>journalctl -u sdoc-worker -f</code>.
          </p>
        )}
      </section>
    </div>
  );
}

export default Machines;
