import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, RotateCcw, Send, Upload } from "lucide-react";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useChat } from "../chat/ChatContext";
import { setInSession, type Machine } from "../types/Machine";
import "./RemoteSession.css";

type Phase = "connecting" | "live" | "cad" | "restarting";
type Line = { text: string; kind: "in" | "out" | "err" };
type Transfer = { name: string; size: number; path: string };

const DEFAULT_PATH = "C:\\Users\\Public\\Downloads";
const CAD_OPTIONS = ["Lock", "Switch user", "Sign out", "Change a password", "Task Manager"];

const SERVICES: Record<string, string> = {
  Spooler: "Print Spooler",
  wuauserv: "Windows Update",
  Dnscache: "DNS Client",
  WinRM: "Windows Remote Management (WS-Management)",
  LanmanWorkstation: "Workstation",
  SDOCAgent: "SDOC Remote Support Agent",
};

const PROCESSES = [
  ["explorer", 2312, 84.2], ["ERPClient", 6120, 312.7], ["chrome", 7744, 455.1], ["OUTLOOK", 5408, 198.3],
  ["Teams", 8016, 266.9], ["svchost", 1044, 41.6], ["SDOCAgent", 3388, 12.4], ["System", 4, 0.9],
] as const;

const LEDGER = [
  ["4010", "Sales revenue – EU", "128,440.00"],
  ["5020", "Cost of goods sold", "-71,215.40"],
  ["6110", "Payroll", "-38,900.00"],
  ["6300", "Office rent", "-6,250.00"],
  ["6420", "Software licences", "-3,180.75"],
  ["7100", "Bank interest", "412.18"],
];

const INVOICES = [
  ["INV-20931", "Northwind Supplies", "Pending"],
  ["INV-20930", "Contoso Logistics", "Approved"],
  ["INV-20927", "Fabrikam Office", "Overdue"],
  ["INV-20925", "Tailspin Freight", "Approved"],
];

const HELP = [
  "Available commands:",
  "  ipconfig                  Show network configuration",
  "  get-process               List running processes",
  "  get-service               List monitored services",
  "  restart-service <name>    Restart a Windows service",
  "  hostname | whoami         Show host or signed-in user",
  "  dir [path]                List a directory",
  "  clear | cls               Clear the console",
];

function accountName(fullName: string) {
  const [first = "user", ...rest] = fullName.toLowerCase().split(/\s+/);
  return (first[0] + (rest.at(-1) ?? first)).replace(/[^a-z0-9]/g, "");
}

function runCommand(raw: string, machine: Machine, transfers: Transfer[]): string[] | null {
  const [name = "", ...args] = raw.trim().split(/\s+/);
  const user = accountName(machine.ownerFullName ?? "");
  const prefix = machine.ipAddress.split(".").slice(0, 3).join(".");

  switch (name.toLowerCase()) {
    case "":
      return [];
    case "help":
      return HELP;
    case "clear":
    case "cls":
      return null;
    case "hostname":
      return [machine.hostname];
    case "whoami":
      return [`corp\\${user}`];
    case "ipconfig":
      return [
        "Windows IP Configuration", "",
        "Ethernet adapter Ethernet0:", "",
        "   Connection-specific DNS Suffix  . : corp.local",
        `   IPv4 Address. . . . . . . . . . . : ${machine.ipAddress}`,
        "   Subnet Mask . . . . . . . . . . . : 255.255.255.0",
        `   Default Gateway . . . . . . . . . : ${prefix}.1`,
      ];
    case "get-process":
      return [
        "Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id ProcessName",
        "-------  ------    -----      -----     ------     -- -----------",
        ...PROCESSES.map(([proc, id, cpu]) =>
          `${String(Math.round(cpu * 7 + 180)).padStart(7)}  ${String(Math.round(cpu / 9 + 8)).padStart(6)}  ${String(Math.round(cpu * 410)).padStart(7)}  ${String(Math.round(cpu * 520)).padStart(9)}  ${(cpu * (0.9 + Math.random() * 0.2)).toFixed(2).padStart(9)}  ${String(id).padStart(5)} ${proc}`),
      ];
    case "get-service":
      return [
        "Status   Name               DisplayName",
        "------   ----               -----------",
        ...Object.entries(SERVICES).map(([svc, display]) => `Running  ${svc.padEnd(18)} ${display}`),
      ];
    case "restart-service": {
      const target = args.find(arg => !arg.startsWith("-"));
      if (!target) return ["restart-service : Missing an argument for parameter 'Name'."];
      const svc = Object.keys(SERVICES).find(key => key.toLowerCase() === target.toLowerCase());
      if (!svc) return [`restart-service : Cannot find any service with service name '${target}'.`];
      return [
        `WARNING: Waiting for service '${SERVICES[svc]} (${svc})' to stop...`,
        `WARNING: Waiting for service '${SERVICES[svc]} (${svc})' to start...`,
        `Service ${svc} restarted.`,
      ];
    }
    case "dir":
    case "ls": {
      const path = args.join(" ") || `C:\\Users\\${user}`;
      const files = transfers.filter(file => file.path.toLowerCase() === path.toLowerCase());
      const entries = path.toLowerCase() === `c:\\users\\${user}`
        ? ["d-r---  Desktop", "d-r---  Documents", "d-r---  Downloads", "d-r---  Pictures"]
        : files.map(file => `-a----  ${String(file.size).padStart(10)} ${file.name}`);
      return [`    Directory: ${path}`, "", "Mode    Length     Name", "----    ------     ----", ...entries];
    }
    default:
      return [`${name} : The term '${name}' is not recognized as the name of a cmdlet. Type 'help' for available commands.`];
  }
}

function RemoteSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const machineId = Number(id);
  const { user } = useAuth();
  const chat = useChat();

  const [machine, setMachine] = useState<Machine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [cursor, setCursor] = useState({ x: 48, y: 40 });
  const [now, setNow] = useState(() => new Date());
  const [lines, setLines] = useState<Line[]>([{ text: "Remote PowerShell Direct. Type 'help' for commands.", kind: "out" }]);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [path, setPath] = useState(DEFAULT_PATH);
  const [progress, setProgress] = useState<number | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [activity, setActivity] = useState<{ at: Date; text: string }[]>([]);
  const [text, setText] = useState("");

  const consoleEnd = useRef<HTMLDivElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const chatStarted = useRef(false);

  const log = (entry: string) => setActivity(current => [{ at: new Date(), text: entry }, ...current]);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/v1/machines/${machineId}`)
      .then(async response => {
        if (!response.ok) throw new Error("Machine not found.");
        const data: Machine = await response.json();
        if (!active) return;
        setMachine(data);
        setInSession(data.id, true);
        window.setTimeout(() => active && setPhase("live"), 1200);
      })
      .catch(err => active && setError(err instanceof Error ? err.message : "Failed to load machine."));
    return () => {
      active = false;
      setInSession(machineId, false);
    };
  }, [machineId]);

  useEffect(() => {
    if (phase !== "live") return;
    const interval = window.setInterval(() => {
      setCursor({ x: 6 + Math.random() * 86, y: 6 + Math.random() * 78 });
      setNow(new Date());
    }, 1600);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => consoleEnd.current?.scrollIntoView({ block: "nearest" }), [lines]);
  useEffect(() => chatEnd.current?.scrollIntoView({ block: "nearest" }), [chat.messages]);

  const ownerId = machine?.ownerId ?? null;
  const canChat = ownerId !== null && ownerId !== user?.id;
  const chatLive = chat.peerId === ownerId && (chat.status === "connected" || chat.status === "connecting");

  useEffect(() => {
    if (!canChat || chatStarted.current || !chat.signalReady || ownerId === null) return;
    chatStarted.current = true;
    if (!chatLive) void chat.connect(ownerId);
  }, [canChat, chat, chatLive, ownerId]);

  function sendCtrlAltDel() {
    setPhase("cad");
    log("Sent Ctrl+Alt+Del");
  }

  function chooseCad(option: string | null) {
    setPhase("live");
    log(option ? `Secure screen: ${option}` : "Secure screen cancelled");
  }

  function restartAgent() {
    setPhase("restarting");
    log("Support agent restart requested");
    setLines(current => [...current, { text: "[agent] SDOCAgent stopping… reconnecting", kind: "out" }]);
    window.setTimeout(() => {
      setPhase("live");
      log("Support agent back online");
      setLines(current => [...current, { text: "[agent] SDOCAgent running", kind: "out" }]);
    }, 3000);
  }

  function handleCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!machine) return;
    const output = runCommand(command, machine, transfers);
    const prompt = `PS C:\\Users\\${accountName(machine.ownerFullName ?? "")}> ${command}`;
    if (output === null) setLines([]);
    else setLines(current => [...current, { text: prompt, kind: "in" }, ...output.map(text => ({ text, kind: "out" as const }))]);
    if (command.trim()) {
      setHistory(current => [...current, command]);
      log(`PowerShell: ${command.trim()}`);
    }
    setHistoryIndex(-1);
    setCommand("");
  }

  function handleHistory(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const next = event.key === "ArrowUp"
      ? (historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1))
      : (historyIndex === -1 ? -1 : historyIndex + 1);
    const inRange = next >= 0 && next < history.length;
    setHistoryIndex(inRange ? next : -1);
    setCommand(inRange ? history[next] : "");
  }

  function handleTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = path.trim().replace(/\\+$/, "");
    if (!file) return setTransferError("Choose a file.");
    if (!/^[a-z]:\\[^<>:"/|?*]*$/i.test(target)) return setTransferError("Enter an absolute Windows path, e.g. C:\\Users\\Public\\Downloads.");
    setTransferError(null);
    let done = 0;
    setProgress(0);
    const interval = window.setInterval(() => {
      done = Math.min(100, done + 8 + Math.random() * 12);
      setProgress(done);
      if (done < 100) return;
      window.clearInterval(interval);
      setTransfers(list => [...list, { name: file.name, size: file.size, path: target }]);
      log(`Transferred ${file.name} → ${target}`);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      window.setTimeout(() => setProgress(null), 600);
    }, 150);
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim() && chat.send(text.trim())) setText("");
  }

  if (error) {
    return (
      <div className="rs-page">
        <Link className="rs-back" to="/dashboard"><ArrowLeft size={14} /> Dashboard</Link>
        <p className="rs-error" role="alert">{error}</p>
      </div>
    );
  }

  const busy = phase !== "live";

  return (
    <div className="rs-page">
      <header className="rs-head">
        <div>
          <Link className="rs-back" to="/dashboard"><ArrowLeft size={14} /> Dashboard</Link>
          <h1>{machine?.hostname ?? "Connecting…"}</h1>
          {machine && (
            <p className="rs-sub">
              #{machine.id} · {machine.ipAddress} · {machine.department} · {machine.ownerFullName}
              <span className={`rs-state is-${phase}`}>
                {phase === "live" ? "Session live" : phase === "cad" ? "Secure screen" : phase === "restarting" ? "Agent restarting" : "Connecting"}
              </span>
            </p>
          )}
        </div>
        <div className="rs-controls">
          <button type="button" onClick={sendCtrlAltDel} disabled={busy}><KeyRound size={14} /> Ctrl+Alt+Del</button>
          <button type="button" onClick={restartAgent} disabled={busy}><RotateCcw size={14} /> Restart agent</button>
          <button type="button" className="rs-end" onClick={() => navigate(-1)}>End session</button>
        </div>
      </header>

      <div className="rs-grid">
        <section className="rs-screen" aria-label="Remote desktop">
          <div className="rd-window rd-ledger">
            <div className="rd-title">FinERP — General Ledger · FY2026</div>
            <table>
              <thead><tr><th>Account</th><th>Description</th><th>Balance (EUR)</th></tr></thead>
              <tbody>
                {LEDGER.map(([account, description, balance]) => (
                  <tr key={account}><td>{account}</td><td>{description}</td><td className={balance.startsWith("-") ? "neg" : ""}>{balance}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rd-window rd-invoices">
            <div className="rd-title">FinERP — Accounts Payable</div>
            <ul>
              {INVOICES.map(([number, vendor, state]) => (
                <li key={number}><span>{number}</span><span>{vendor}</span><em className={`is-${state.toLowerCase()}`}>{state}</em></li>
              ))}
            </ul>
          </div>
          <div className="rd-taskbar">
            <div className="rd-apps">
              <span className="rd-start" /><span /><span className="rd-erp" /><span />
            </div>
            <time>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}<br />{now.toLocaleDateString()}</time>
          </div>
          <svg className="rd-cursor" style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }} width="16" height="22" viewBox="0 0 16 22" aria-hidden="true">
            <path d="M1 1v17l4.5-4.2L8.6 21l3-1.3-3.1-7H14z" fill="#fff" stroke="#000" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>

          {phase === "connecting" && <div className="rd-overlay">Establishing remote session…</div>}
          {phase === "restarting" && <div className="rd-overlay">Remote support agent restarting…</div>}
          {phase === "cad" && (
            <div className="rd-overlay rd-cad">
              {CAD_OPTIONS.map(option => <button key={option} type="button" onClick={() => chooseCad(option)}>{option}</button>)}
              <button type="button" className="rd-cancel" onClick={() => chooseCad(null)}>Cancel</button>
            </div>
          )}
        </section>

        <aside className="rs-panel rs-chat" aria-label="Chat with user">
          <h2>Chat · {machine?.ownerFullName ?? "user"}</h2>
          {!canChat ? (
            <p className="rs-note">{machine ? "You are the owner of this machine." : "Loading…"}</p>
          ) : (
            <>
              <div className="rs-chat-status">
                {chat.peerId !== ownerId ? "Not connected" : chat.status === "connected" ? "Connected" : chat.status === "connecting" ? "Connecting…" : "User unavailable"}
                {chat.peerId === ownerId && (chat.status === "unavailable" || chat.status === "disconnected") && (
                  <button type="button" onClick={() => void chat.connect(ownerId)}>Retry</button>
                )}
              </div>
              <div className="rs-messages">
                {chat.peerId === ownerId && chat.messages.map(message => (
                  <div key={message.id} className={`rs-message ${message.fromMe ? "mine" : ""}`}>{message.text}</div>
                ))}
                <div ref={chatEnd} />
              </div>
              <form className="rs-chat-input" onSubmit={handleSend}>
                <input value={text} onChange={event => setText(event.target.value)} placeholder="Message the user…" disabled={chat.peerId !== ownerId || chat.status !== "connected"} />
                <button type="submit" aria-label="Send" disabled={chat.peerId !== ownerId || chat.status !== "connected" || !text.trim()}><Send size={14} /></button>
              </form>
            </>
          )}
        </aside>

        <section className="rs-panel rs-console" aria-label="Remote PowerShell">
          <h2>PowerShell Direct</h2>
          <div className="rs-terminal" onClick={() => document.getElementById("rs-command")?.focus()}>
            {lines.map((line, index) => <pre key={index} className={line.kind}>{line.text}</pre>)}
            <form onSubmit={handleCommand}>
              <label htmlFor="rs-command">PS&gt;</label>
              <input
                id="rs-command"
                value={command}
                onChange={event => setCommand(event.target.value)}
                onKeyDown={handleHistory}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
              />
            </form>
            <div ref={consoleEnd} />
          </div>
        </section>

        <div className="rs-side">
          <form className="rs-panel rs-transfer" onSubmit={handleTransfer}>
            <h2>File transfer</h2>
            <input ref={fileInput} type="file" onChange={event => setFile(event.target.files?.[0] ?? null)} disabled={progress !== null} />
            <label htmlFor="rs-path">Destination</label>
            <input id="rs-path" value={path} onChange={event => setPath(event.target.value)} disabled={progress !== null} />
            {progress !== null && <progress max={100} value={progress} />}
            {transferError && <p className="rs-error" role="alert">{transferError}</p>}
            <button type="submit" disabled={busy || progress !== null}><Upload size={14} /> Send file</button>
          </form>

          <section className="rs-panel rs-activity" aria-label="Session activity">
            <h2>Activity</h2>
            {activity.length === 0 ? <p className="rs-note">No actions yet.</p> : (
              <ol>
                {activity.map((entry, index) => (
                  <li key={index}><time>{entry.at.toLocaleTimeString()}</time>{entry.text}</li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default RemoteSession;
