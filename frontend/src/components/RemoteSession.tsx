import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, MonitorPlay, MonitorX, RotateCcw, Upload } from "lucide-react";
import { apiFetch } from "../api";
import { WS_BASE } from "../config";
import { setInSession, type Machine } from "../types/Machine";
import "./RemoteSession.css";

type Phase = "connecting" | "live" | "cad" | "restarting";
type Line = { text: string; kind: "in" | "out" | "err" };
type Transfer = { name: string; size: number; path: string };

const DEFAULT_PATH = "C:\\Users\\Public\\Downloads";
const FILE_CHUNK = 256 * 1024;

type FileReply = { type: string; error?: string; path?: string };
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
  const [agent, setAgent] = useState({ online: false, desktop: false });
  const [frame, setFrame] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const relay = useRef<WebSocket | null>(null);
  const lastMove = useRef(0);
  const consoleEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileReply = useRef<((msg: FileReply) => void) | null>(null);

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
    const socket = new WebSocket(`${WS_BASE}/api/v1/remote/${machineId}`);
    socket.binaryType = "blob";
    relay.current = socket;
    let frameUrl: string | null = null;
    const write = (text: string, kind: Line["kind"] = "out") =>
      setLines(current => [...current, ...text.split("\n").map(line => ({ text: line, kind }))]);

    socket.onmessage = event => {
      if (event.data instanceof Blob) {
        if (frameUrl) URL.revokeObjectURL(frameUrl);
        frameUrl = URL.createObjectURL(event.data);
        setFrame(frameUrl);
        return;
      }
      const msg = JSON.parse(event.data);
      if (msg.type.startsWith("file-")) {
        fileReply.current?.(msg);
      } else if (msg.type === "agent") {
        setAgent({ online: msg.online, desktop: msg.desktop });
        if (!msg.desktop) setFrame(null);
        if (!msg.online) {
          setRunning(false);
          fileReply.current?.({ type: "file-error", error: "Agent disconnected." });
        }
      } else if (msg.type === "exec-result") {
        write(msg.output || (msg.exitCode === 0 ? "" : `Exit code ${msg.exitCode}`), msg.exitCode === 0 ? "out" : "err");
        setRunning(false);
      } else if (msg.type === "notice") {
        write(`[agent] ${msg.text}`);
        setActivity(current => [{ at: new Date(), text: msg.text }, ...current]);
      }
    };
    socket.onclose = () => {
      fileReply.current?.({ type: "file-error", error: "Connection to the server lost." });
      setAgent({ online: false, desktop: false });
      setFrame(null);
      setRunning(false);
    };
    return () => {
      socket.close();
      if (frameUrl) URL.revokeObjectURL(frameUrl);
    };
  }, [machineId]);

  const sendRelay = (payload: object) => {
    if (relay.current?.readyState !== WebSocket.OPEN) return false;
    relay.current.send(JSON.stringify(payload));
    return true;
  };

  function pointer(event: MouseEvent<HTMLImageElement>, kind: string) {
    if (kind === "move") {
      if (event.timeStamp - lastMove.current < 40) return;
      lastMove.current = event.timeStamp;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    sendRelay({ type: "input", kind, x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, button: event.button });
  }

  function key(event: KeyboardEvent<HTMLElement>, kind: "keydown" | "keyup") {
    event.preventDefault();
    sendRelay({ type: "input", kind, key: event.keyCode });
  }

  useEffect(() => {
    if (phase !== "live") return;
    const interval = window.setInterval(() => {
      setCursor({ x: 6 + Math.random() * 86, y: 6 + Math.random() * 78 });
      setNow(new Date());
    }, 1600);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => { consoleEnd.current?.scrollIntoView({ block: "nearest" }); }, [lines]);
  useEffect(() => { if (!running) document.getElementById("rs-command")?.focus({ preventScroll: true }); }, [running]);

  function sendCtrlAltDel() {
    if (agent.online) {
      sendRelay({ type: "cad" });
      log("Ctrl+Alt+Del requested");
      return;
    }
    setPhase("cad");
    log("Sent Ctrl+Alt+Del");
  }

  function chooseCad(option: string | null) {
    setPhase("live");
    log(option ? `Secure screen: ${option}` : "Secure screen cancelled");
  }

  function restartAgent() {
    if (agent.online) {
      sendRelay({ type: "restart-agent" });
      log("Support agent restart requested");
      return;
    }
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
    if (!machine || running) return;
    const prompt = `PS C:\\Users\\${accountName(machine.ownerFullName ?? "")}> ${command}`;
    const isClear = /^\s*(clear|cls)\s*$/i.test(command);
    if (agent.online && command.trim() && !isClear) {
      setLines(current => [...current, { text: prompt, kind: "in" }]);
      setRunning(sendRelay({ type: "exec", id: Date.now(), command }));
      setHistory(current => [...current, command]);
      log(`PowerShell: ${command.trim()}`);
      setHistoryIndex(-1);
      setCommand("");
      return;
    }
    const output = runCommand(command, machine, transfers);
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

  // Stop-and-wait: one chunk in flight, the agent acknowledges each before the next is sent
  async function upload(file: File, target: string) {
    const socket = relay.current;
    if (!socket) return;
    const reply = () => new Promise<FileReply>(resolve => { fileReply.current = resolve; });
    setProgress(0);
    let pending = reply();
    sendRelay({ type: "file-start", id: Date.now(), name: file.name, path: target, size: file.size });
    let msg = await pending;
    for (let offset = 0; msg.type === "file-progress" && offset < file.size;) {
      const chunk = await file.slice(offset, offset + FILE_CHUNK).arrayBuffer();
      pending = reply();
      socket.send(chunk);
      offset += chunk.byteLength;
      msg = await pending;
      setProgress(offset / file.size * 100);
    }
    fileReply.current = null;
    if (msg.type === "file-done") {
      setTransfers(list => [...list, { name: file.name, size: file.size, path: target }]);
      log(`Transferred ${file.name} → ${msg.path ?? target}`);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } else {
      setTransferError(msg.error ?? "Transfer failed.");
      log(`Transfer of ${file.name} failed`);
    }
    window.setTimeout(() => setProgress(null), 600);
  }

  function handleTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = path.trim().replace(/\\+$/, "");
    if (!file) return setTransferError("Choose a file.");
    if (!/^[a-z]:\\[^<>:"/|?*]*$/i.test(target)) return setTransferError("Enter an absolute Windows path, e.g. C:\\Users\\Public\\Downloads.");
    setTransferError(null);
    if (agent.online) {
      void upload(file, target);
      return;
    }
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
              <span className={`rs-state is-${agent.online ? "live" : phase}`}>
                {agent.online ? (agent.desktop ? "Agent connected · controlling desktop" : "Agent connected")
                  : phase === "live" ? "Simulated · agent offline" : phase === "cad" ? "Secure screen" : phase === "restarting" ? "Agent restarting" : "Connecting"}
              </span>
            </p>
          )}
        </div>
        <div className="rs-controls">
          {agent.online && (agent.desktop ? (
            <button type="button" onClick={() => { sendRelay({ type: "desktop-stop" }); log("Released desktop control"); }}>
              <MonitorX size={14} /> Release control
            </button>
          ) : (
            <button type="button" onClick={() => { sendRelay({ type: "desktop-start" }); log("Requested desktop control"); }}>
              <MonitorPlay size={14} /> Take control
            </button>
          ))}
          <button type="button" onClick={sendCtrlAltDel} disabled={busy}><KeyRound size={14} /> Ctrl+Alt+Del</button>
          <button type="button" onClick={restartAgent} disabled={busy}><RotateCcw size={14} /> Restart agent</button>
          <button type="button" className="rs-end" onClick={() => navigate(-1)}>End session</button>
        </div>
      </header>

      <div className="rs-grid">
        {frame ? (
          <section
            className="rs-screen is-live"
            aria-label="Remote desktop (click to focus keyboard)"
            tabIndex={0}
            onKeyDown={event => key(event, "keydown")}
            onKeyUp={event => key(event, "keyup")}
          >
            <img
              src={frame}
              alt={`Desktop of ${machine?.hostname ?? "machine"}`}
              draggable={false}
              onMouseMove={event => pointer(event, "move")}
              onMouseDown={event => { event.currentTarget.parentElement?.focus(); pointer(event, "down"); }}
              onMouseUp={event => pointer(event, "up")}
              onContextMenu={event => event.preventDefault()}
              onWheel={event => sendRelay({ type: "input", kind: "wheel", delta: event.deltaY })}
            />
          </section>
        ) : (
        <section className="rs-screen" aria-label="Remote desktop">
          {agent.desktop && <div className="rd-overlay">Waiting for desktop stream…</div>}
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
        )}

        <section className="rs-panel rs-console" aria-label="Remote PowerShell">
          <h2>PowerShell Direct · {agent.online ? "live" : "simulated"}{running ? " · running…" : ""}</h2>
          <div className="rs-terminal" onClick={() => document.getElementById("rs-command")?.focus()}>
            {lines.map((line, index) => <pre key={index} className={line.kind}>{line.text}</pre>)}
            <form onSubmit={handleCommand}>
              <label htmlFor="rs-command">PS&gt;</label>
              <input
                id="rs-command"
                value={command}
                onChange={event => setCommand(event.target.value)}
                onKeyDown={handleHistory}
                disabled={busy || running}
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
