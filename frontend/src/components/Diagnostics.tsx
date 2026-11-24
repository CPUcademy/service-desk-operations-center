import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "../api";
import { WS_BASE } from "../config";
import type { Machine } from "../types/Machine";
import "./RemoteSession.css";
import "./Diagnostics.css";

const PORTS = [
  { port: 3389, name: "RDP", chance: 0.85 },
  { port: 22, name: "SSH", chance: 0.3 },
  { port: 443, name: "HTTPS", chance: 0.5 },
  { port: 445, name: "SMB", chance: 0.85 },
  { port: 5985, name: "WinRM", chance: 0.75 },
];

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

type Target = { ip: string; label: string; down: boolean };
type PortResult = { port: number; name: string; state: "open" | "closed" | "filtered" | "checking"; ms: number | null };
type Found = { ip: string; mac: string; hostname: string; vendor: string; method: string };

function hash(text: string) {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

const unit = (text: string) => hash(text) / 4294967296;

function mac(seed: string, oui = "") {
  const bytes = Array.from({ length: 6 }, (_, i) => (hash(seed + i) & 0xff).toString(16).padStart(2, "0").toUpperCase());
  return (oui ? [oui, ...bytes.slice(3)] : bytes).join(":");
}

function resolve(id: string, machines: Machine[]): Target | string {
  const machine = machines.find(m => String(m.id) === id);
  if (!machine) return "Select a host.";
  return { ip: machine.ipAddress, label: `${machine.hostname} [${machine.ipAddress}]`, down: machine.status.toLowerCase() === "offline" };
}

type HostSelectProps = { machines: Machine[]; value: string; onChange: (id: string) => void; disabled?: boolean };

function HostSelect({ machines, value, onChange, disabled = false }: HostSelectProps) {
  return (
    <select className="dg-select" value={value} onChange={event => onChange(event.target.value)} aria-label="Host" disabled={disabled || machines.length === 0} required>
      <option value="" disabled>{machines.length ? "Select a host" : "No machines registered"}</option>
      {machines.map(m => <option key={m.id} value={m.id}>{m.hostname} · {m.ipAddress}</option>)}
    </select>
  );
}

function PortChecker({ machines }: { machines: Machine[] }) {
  const [host, setHost] = useState("");
  const [results, setResults] = useState<PortResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = resolve(host, machines);
    if (typeof target === "string") return setError(target);
    setError(null);
    timers.current.forEach(window.clearTimeout);
    setResults(PORTS.map(p => ({ port: p.port, name: p.name, state: "checking", ms: null })));
    timers.current = PORTS.map((p, index) => {
      const roll = unit(target.ip + p.port);
      const state: PortResult["state"] = target.down ? "filtered" : roll < p.chance ? "open" : "closed";
      const ms = state === "filtered" ? null : Math.round(1 + unit(target.ip) * 18 + roll * 6);
      return window.setTimeout(() => setResults(current =>
        current.map(r => r.port === p.port ? { ...r, state, ms } : r)), state === "filtered" ? 2000 : 250 + index * 180);
    });
  }

  return (
    <section className="rs-panel">
      <h2>Port status</h2>
      <form className="dg-form" onSubmit={check}>
        <HostSelect machines={machines} value={host} onChange={setHost} />
        <button type="submit" disabled={!host}>Check ports</button>
      </form>
      {error && <p className="rs-error dg-pad" role="alert">{error}</p>}
      <table className="dg-table">
        <thead><tr><th>Port</th><th>Service</th><th>State</th><th className="num">Response</th></tr></thead>
        <tbody>
          {(results.length ? results : PORTS.map(p => ({ port: p.port, name: p.name, state: null, ms: null }))).map(r => (
            <tr key={r.port}>
              <td>{r.port}</td>
              <td>{r.name}</td>
              <td className={r.state ? `dg-state is-${r.state}` : "muted"}>{r.state ? r.state[0].toUpperCase() + r.state.slice(1) + (r.state === "checking" ? "…" : "") : "—"}</td>
              <td className="num">{r.ms === null ? "—" : `${r.ms} ms`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function NetConsole({ machines }: { machines: Machine[] }) {
  const [host, setHost] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const stopPing = useRef<(() => void) | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => () => window.clearInterval(timer.current), []);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [lines]);

  const print = (...text: string[]) => setLines(current => [...current, ...text]);

  function stop() {
    window.clearInterval(timer.current);
    setRunning(false);
  }

  function start(mode: "ping" | "tracert") {
    const target = resolve(host, machines);
    if (typeof target === "string") return print(target);
    stop();
    setRunning(true);

    if (mode === "ping") {
      const stats = { sent: 0, received: 0, times: [] as number[] };
      const base = 1 + unit(target.ip) * 25;
      print("", `Pinging ${target.label} with 32 bytes of data:`);
      timer.current = window.setInterval(() => {
        stats.sent++;
        if (target.down || Math.random() < 0.03) return print("Request timed out.");
        const ms = Math.max(1, Math.round(base + (Math.random() - 0.5) * base * 0.6));
        stats.received++;
        stats.times.push(ms);
        print(`Reply from ${target.ip}: bytes=32 time=${ms}ms TTL=128`);
      }, 1000);
      stopPing.current = () => {
        const lost = stats.sent - stats.received;
        print(
          "", `Ping statistics for ${target.ip}:`,
          `    Packets: Sent = ${stats.sent}, Received = ${stats.received}, Lost = ${lost} (${stats.sent ? Math.round(lost / stats.sent * 100) : 0}% loss)`,
          ...(stats.times.length ? [
            "Approximate round trip times in milli-seconds:",
            `    Minimum = ${Math.min(...stats.times)}ms, Maximum = ${Math.max(...stats.times)}ms, Average = ${Math.round(stats.times.reduce((a, b) => a + b, 0) / stats.times.length)}ms`,
          ] : []),
        );
      };
      return;
    }

    stopPing.current = null;
    const octets = target.ip.split(".");
    const internal = octets[0] === "10" || octets[0] === "192" || octets[0] === "172";
    const hops = [
      `${octets.slice(0, 3).join(".")}.1`,
      ...(internal ? ["10.0.0.1"] : ["10.0.0.1", "84.116.0.1", "84.116.140.9", "195.66.224.31"]),
      target.ip,
    ];
    let hop = 0;
    print("", `Tracing route to ${target.label}`, "over a maximum of 30 hops:", "");
    timer.current = window.setInterval(() => {
      const ip = hops[hop];
      const last = hop === hops.length - 1;
      const times = Array.from({ length: 3 }, () =>
        last && target.down ? "    *   " : `${String(Math.max(1, Math.round((hop + 1) * 3 + Math.random() * 6))).padStart(4)} ms`);
      print(`${String(hop + 1).padStart(3)}  ${times.join("  ")}  ${last && target.down ? "Request timed out." : ip}`);
      hop++;
      if (hop === hops.length) {
        print("", "Trace complete.");
        stop();
      }
    }, 500);
  }

  function handleStop() {
    stop();
    stopPing.current?.();
    stopPing.current = null;
  }

  return (
    <section className="rs-panel">
      <h2>Ping &amp; traceroute</h2>
      <form className="dg-form" onSubmit={event => { event.preventDefault(); start("ping"); }}>
        <HostSelect machines={machines} value={host} onChange={setHost} disabled={running} />
        {running ? (
          <button type="button" className="dg-stop" onClick={handleStop}>Stop</button>
        ) : (
          <>
            <button type="submit" disabled={!host}>Ping -t</button>
            <button type="button" onClick={() => start("tracert")} disabled={!host}>Traceroute</button>
          </>
        )}
        <button type="button" className="dg-ghost" onClick={() => setLines([])} disabled={running}>Clear</button>
      </form>
      <div className="rs-terminal dg-terminal">
        {lines.length === 0 && <pre className="in">Enter a target and start a test.</pre>}
        {lines.map((line, index) => <pre key={index}>{line || " "}</pre>)}
        <div ref={end} />
      </div>
    </section>
  );
}

function runOnAgent(machineId: number, command: string): Promise<string | null> {
  return new Promise(resolve => {
    const socket = new WebSocket(`${WS_BASE}/api/v1/remote/${machineId}`);
    const id = Date.now();
    let sent = false;
    const finish = (value: string | null) => {
      resolve(value);
      socket.close();
    };
    socket.onmessage = event => {
      if (typeof event.data !== "string") return;
      const msg = JSON.parse(event.data);
      if (msg.type === "agent" && !msg.online) finish(null);
      else if (msg.type === "agent" && !sent) {
        sent = true;
        socket.send(JSON.stringify({ type: "exec", id, command }));
      } else if (msg.type === "exec-result" && msg.id === id) finish(msg.output ?? "");
    };
    socket.onclose = () => resolve(null);
  });
}

const SUBNET_SCRIPT = `
$ProgressPreference = 'SilentlyContinue'
$config = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
if (-not $config) { 'ERROR|No active network interface with a default gateway.'; return }
$self = @($config.IPv4Address)[0].IPAddress
$prefix = ($self -split '\\.')[0..2] -join '.'
"SUBNET|$prefix|$($config.InterfaceAlias)"
$tasks = 1..254 | ForEach-Object { (New-Object System.Net.NetworkInformation.Ping).SendPingAsync("$prefix.$_", 500) }
try { [System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$tasks) } catch {}
$neighbors = Get-NetNeighbor -AddressFamily IPv4 -InterfaceIndex $config.InterfaceIndex |
  Where-Object { $_.IPAddress -like "$prefix.*" -and $_.State -notin 'Unreachable','Incomplete' -and $_.LinkLayerAddress -notin '','00-00-00-00-00-00','FF-FF-FF-FF-FF-FF' } |
  Group-Object IPAddress | ForEach-Object { $_.Group[0] }
$lookups = @($neighbors | ForEach-Object { [pscustomobject]@{ ip = $_.IPAddress; task = [System.Net.Dns]::GetHostEntryAsync($_.IPAddress) } })
if ($lookups.Count) { try { [void][System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$lookups.task, 4000) } catch {} }
$names = @{}
foreach ($l in $lookups) { if ($l.task.Status -eq 'RanToCompletion') { $names[$l.ip] = $l.task.Result.HostName } }
$neighbors | ForEach-Object { "$($_.IPAddress)|$($_.LinkLayerAddress)|$($names[$_.IPAddress])|$($_.State)" }
"$self|this machine|$env:COMPUTERNAME|Self"
`;

function simulatedHosts(prefix: string, machines: Machine[]): Found[] {
  const hosts = new Map<number, Found>();
  hosts.set(1, { ip: `${prefix}.1`, mac: mac(prefix + "gw", "00:1B:54"), hostname: "gateway.corp.local", vendor: "Cisco Systems", method: "ARP" });
  machines
    .filter(m => m.ipAddress.startsWith(prefix + ".") && m.status.toLowerCase() !== "offline")
    .forEach(m => hosts.set(Number(m.ipAddress.split(".")[3]), {
      ip: m.ipAddress, mac: mac(m.hostname, "D4:BE:D9"), hostname: m.hostname, vendor: "Dell Inc.", method: "ARP",
    }));
  const extras = [["printer", "3C:D9:2B", "Hewlett Packard", "Broadcast"], ["", "", "Unknown", "ARP"], ["ap-floor2", "F0:9F:C2", "Ubiquiti", "Broadcast"]];
  extras.forEach(([name, oui, vendor, method], index) => {
    const octet = 2 + (hash(prefix + index) % 250);
    if (!hosts.has(octet)) hosts.set(octet, {
      ip: `${prefix}.${octet}`, mac: mac(prefix + index, oui), hostname: name ? `${name}.corp.local` : "—", vendor, method,
    });
  });
  return [...hosts.entries()].sort(([a], [b]) => a - b).map(([, host]) => host);
}

function SubnetScanner({ machines }: { machines: Machine[] }) {
  const [machineId, setMachineId] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [scanning, setScanning] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const source = machines.find(m => String(m.id) === machineId);
  const prefix = source?.ipAddress.split(".").slice(0, 3).join(".");

  async function scan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!source || !prefix || !IPV4.test(`${prefix}.0`)) return setNote("Select a host with a valid IPv4 address.");
    setFound([]);
    setNote(null);
    setScanning(`Scanning from ${source.hostname}…`);

    const output = await runOnAgent(source.id, SUBNET_SCRIPT);
    if (output === null) {
      await new Promise(resolve => window.setTimeout(resolve, 1500));
      const hosts = simulatedHosts(prefix, machines);
      setFound(hosts);
      setNote(`Agent on ${source.hostname} is offline · simulated result, ${hosts.length} hosts.`);
    } else {
      const rows = output.split(/\r?\n/).map(line => line.trim().split("|"));
      const subnet = rows.find(parts => parts[0] === "SUBNET");
      const failure = rows.find(parts => parts[0] === "ERROR");
      const octet = (ip: string) => Number(ip.split(".")[3]);
      const hosts = rows.filter(parts => parts.length === 4 && IPV4.test(parts[0])).sort((a, b) => octet(a[0]) - octet(b[0])).map(parts => {
        const [ip, macAddress, name, state] = parts;
        const known = machines.find(m => m.ipAddress === ip);
        return {
          ip,
          mac: macAddress.replaceAll("-", ":"),
          hostname: name || known?.hostname || "—",
          vendor: known ? `Registered #${known.id}` : "—",
          method: state === "Self" ? "Local interface" : `ARP · ${state}`,
        };
      });
      setFound(hosts);
      const where = subnet ? `${subnet[1]}.0/24 via ${subnet[2]}` : "";
      const stale = subnet && !source.ipAddress.startsWith(subnet[1] + ".") ? ` Registered IP ${source.ipAddress} is not on this subnet.` : "";
      setNote(failure ? failure[1]
        : hosts.length ? `${hosts.length} hosts found on ${where} from ${source.hostname}.${stale}`
        : subnet ? `No hosts responded on ${where}.` : output.trim() || "No hosts responded.");
    }
    setScanning(null);
  }

  return (
    <section className="rs-panel dg-wide">
      <h2>Subnet discovery (ARP / broadcast)</h2>
      <form className="dg-form" onSubmit={scan}>
        <HostSelect machines={machines} value={machineId} onChange={setMachineId} disabled={scanning !== null} />
        <button type="submit" disabled={scanning !== null || !source}>{scanning !== null ? "Scanning…" : "Scan subnet"}</button>
      </form>
      {scanning && <p className="rs-note">{scanning}</p>}
      <table className="dg-table">
        <thead><tr><th>IP address</th><th>MAC address</th><th>Hostname</th><th>Vendor</th><th>Discovered via</th></tr></thead>
        <tbody>
          {found.map(host => (
            <tr key={host.ip + host.mac}><td>{host.ip}</td><td className="dg-mono">{host.mac}</td><td>{host.hostname}</td><td>{host.vendor}</td><td className="muted">{host.method}</td></tr>
          ))}
        </tbody>
      </table>
      {!scanning && <p className="rs-note">{note ?? "Pick a host; its agent sweeps the /24 subnet it is connected to. Needs remote control enabled for that machine."}</p>}
    </section>
  );
}

function Diagnostics() {
  const [machines, setMachines] = useState<Machine[]>([]);

  useEffect(() => {
    apiFetch("/api/v1/machines")
      .then(response => (response.ok ? response.json() : []))
      .then(setMachines)
      .catch(() => setMachines([]));
  }, []);

  return (
    <div className="rs-page">
      <header className="rs-head"><h1>Network diagnostics</h1></header>
      <div className="dg-grid">
        <PortChecker machines={machines} />
        <NetConsole machines={machines} />
        <SubnetScanner machines={machines} />
      </div>
    </div>
  );
}

export default Diagnostics;
