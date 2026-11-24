import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, MonitorPlay, MonitorX, RotateCcw, Upload } from "lucide-react";
import { apiFetch } from "../api";
import { WS_BASE } from "../config";
import { setInSession, type Machine } from "../types/Machine";
import "./RemoteSession.css";

type Line = { text: string; kind: "in" | "out" | "err" };
type Agent = { online: boolean; desktop: boolean; remoteControl: boolean; agentAllows: boolean };
type FileReply = { type: string; error?: string; path?: string };

const DEFAULT_PATH = "C:\\Users\\Public\\Downloads";
const FILE_CHUNK = 256 * 1024;
const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

const OFFLINE: Agent ={ online: false, desktop: false, remoteControl: false, agentAllows: false };

function RemoteSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const machineId = Number(id);

  const [machine, setMachine] = useState<Machine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [path, setPath] = useState(DEFAULT_PATH);
  const [progress, setProgress] = useState<number | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [activity, setActivity] = useState<{ at: Date; text: string }[]>([]);

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
        setAgent({ online: msg.online, desktop: msg.desktop, remoteControl: msg.remoteControl, agentAllows: msg.agentAllows });
        if (!msg.desktop) setFrame(null);
        if (!msg.online) {
          setRunning(false);
          fileReply.current?.({ type: "file-error", error: "Agent disconnected." });
        }
      } else if (msg.type === "exec-result") {
        write(msg.output || (msg.exitCode === 0 ? "" : `Exit code ${msg.exitCode}`), msg.exitCode === 0 ? "out" : "err");
        setRunning(false);
      } else if (msg.type === "notice") {
        log(msg.text);
      }
    };
    socket.onclose = () => {
      fileReply.current?.({ type: "file-error", error: "Connection to the server lost." });
      setAgent(OFFLINE);
      setFrame(null);
      setRunning(false);
    };
    return () => {
      socket.close();
      if (frameUrl) URL.revokeObjectURL(frameUrl);
    };
  }, [machineId]);

  useEffect(() => { consoleEnd.current?.scrollIntoView({ block: "nearest" }); }, [lines]);
  useEffect(() => { if (!running) document.getElementById("rs-command")?.focus({ preventScroll: true }); }, [running]);

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

  function action(type: string, entry: string) {
    if (sendRelay({ type })) log(entry);
  }

  function handleCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!machine || running || !command.trim()) return;
    if (/^\s*(clear|cls)\s*$/i.test(command)) {
      setLines([]);
    } else {
      setLines(current => [...current, { text: `PS ${machine.hostname}> ${command}`, kind: "in" }]);
      setRunning(sendRelay({ type: "exec", id: Date.now(), command }));
      log(`PowerShell: ${command.trim()}`);
    }
    setHistory(current => [...current, command]);
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
    void upload(file, target);
  }

  if (error) {
    return (
      <div className="rs-page">
        <Link className="rs-back" to="/dashboard"><ArrowLeft size={14} /> Dashboard</Link>
        <p className="rs-error" role="alert">{error}</p>
      </div>
    );
  }

  const online = agent?.online ?? false;
  const controllable = online && agent!.remoteControl && agent!.agentAllows;
  const screenMessage = agent === null ? "Connecting to the agent…"
    : !online ? "The agent on this machine is offline. A session can't be started."
    : !agent.remoteControl ? "Remote control is disabled for this machine. Enable it from the ⋯ menu on the machine's row in the Dashboard."
    : !agent.agentAllows ? "This machine's agent was installed without remote control permission."
    : agent.desktop ? "Waiting for the desktop stream…"
    : "Screen session hasn't been started. Use Take control to view and control the desktop.";

  return (
    <div className="rs-page">
      <header className="rs-head">
        <div>
          <Link className="rs-back" to="/dashboard"><ArrowLeft size={14} /> Dashboard</Link>
          <h1>{machine?.hostname ?? "Loading…"}</h1>
          {machine && (
            <p className="rs-sub">
              #{machine.id} · {machine.ipAddress} · {machine.department} · {machine.ownerFullName}
              <span className={`rs-state ${online ? "is-live" : ""}`}>
                {agent === null ? "Connecting" : !online ? "Agent offline" : agent.desktop ? "Agent connected · controlling desktop" : "Agent connected"}
              </span>
            </p>
          )}
        </div>
        <div className="rs-controls">
          {controllable && (agent!.desktop ? (
            <button type="button" onClick={() => action("desktop-stop", "Released desktop control")}><MonitorX size={14} /> Release control</button>
          ) : (
            <button type="button" onClick={() => action("desktop-start", "Requested desktop control")}><MonitorPlay size={14} /> Take control</button>
          ))}
          {controllable && <button type="button" onClick={() => action("cad", "Ctrl+Alt+Del requested")}><KeyRound size={14} /> Ctrl+Alt+Del</button>}
          {online && <button type="button" onClick={() => action("restart-agent", "Support agent restart requested")}><RotateCcw size={14} /> Restart agent</button>}
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
            <p>{screenMessage}</p>
          </section>
        )}

        {controllable && (
          <section className="rs-panel rs-console" aria-label="Remote PowerShell">
            <h2>PowerShell Direct{running ? " · running…" : ""}</h2>
            <div className="rs-terminal" onClick={() => document.getElementById("rs-command")?.focus()}>
              {lines.map((line, index) => <pre key={index} className={line.kind}>{line.text}</pre>)}
              <form onSubmit={handleCommand}>
                <label htmlFor="rs-command">PS&gt;</label>
                <input
                  id="rs-command"
                  value={command}
                  onChange={event => setCommand(event.target.value)}
                  onKeyDown={handleHistory}
                  disabled={running}
                  autoComplete="off"
                  spellCheck={false}
                />
              </form>
              <div ref={consoleEnd} />
            </div>
          </section>
        )}

        <div className={controllable ? "rs-side" : "rs-side rs-wide"}>
          {controllable && (
            <form className="rs-panel rs-transfer" onSubmit={handleTransfer}>
              <h2>File transfer</h2>
              <div className="rs-field">
                <span className="rs-label">File</span>
                <div className="rs-file">
                  <input id="rs-file" ref={fileInput} type="file" className="rs-file-input" onChange={event => setFile(event.target.files?.[0] ?? null)} disabled={progress !== null} />
                  <label htmlFor="rs-file" className="rs-file-button">Choose file</label>
                  <span className="rs-file-name" title={file?.name}>{file ? `${file.name} · ${formatSize(file.size)}` : "No file selected"}</span>
                </div>
              </div>
              <div className="rs-field">
                <label htmlFor="rs-path" className="rs-label">Destination folder</label>
                <input id="rs-path" className="rs-path" value={path} onChange={event => setPath(event.target.value)} disabled={progress !== null} spellCheck={false} />
              </div>
              {progress !== null && <progress max={100} value={progress} />}
              {transferError && <p className="rs-error" role="alert">{transferError}</p>}
              <button type="submit" disabled={progress !== null}><Upload size={14} /> Send file</button>
            </form>
          )}

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
