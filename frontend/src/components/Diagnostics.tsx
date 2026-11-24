import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "../api";
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
const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

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

function resolve(input: string, machines: Machine[]): Target | string {
  const value = input.trim();
  const known = machines.find(m => m.hostname.toLowerCase() === value.toLowerCase() || m.ipAddress === value);
  if (known) return { ip: known.ipAddress, label: `${known.hostname} [${known.ipAddress}]`, down: known.status.toLowerCase() === "offline" };
  if (IPV4.test(value)) return { ip: value, label: value, down: unit(value) < 0.15 };
  if (!HOSTNAME.test(value)) return "Enter a valid IPv4 address or hostname.";
  const h = hash(value);
  const ip = `10.${20 + (h & 7)}.${(h >> 8) & 255}.${1 + ((h >> 16) % 254)}`;
  return { ip, label: `${value} [${ip}]`, down: false };
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
        <input value={host} onChange={event => setHost(event.target.value)} placeholder="Hostname or IP" aria-label="Host" list="dg-hosts" required />
        <button type="submit">Check ports</button>
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
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [lines]);

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
        <input value={host} onChange={event => setHost(event.target.value)} placeholder="Hostname or IP" aria-label="Target" list="dg-hosts" required disabled={running} />
        {running ? (
          <button type="button" className="dg-stop" onClick={handleStop}>Stop</button>
        ) : (
          <>
            <button type="submit">Ping -t</button>
            <button type="button" onClick={() => host.trim() && start("tracert")}>Traceroute</button>
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

function SubnetScanner({ machines }: { machines: Machine[] }) {
  const [subnet, setSubnet] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const defaultSubnet = machines[0] ? `${machines[0].ipAddress.split(".").slice(0, 3).join(".")}.0/24` : "192.168.1.0/24";

  useEffect(() => () => window.clearInterval(timer.current), []);

  function scan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = (subnet.trim() || defaultSubnet);
    // ponytail: /24 only; add CIDR math if larger ranges are needed
    const match = value.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.0\/24$/);
    if (!match || !IPV4.test(`${match[1]}.0`)) return setError("Use a /24 subnet, e.g. 192.168.1.0/24.");
    const prefix = match[1];
    setError(null);
    setFound([]);

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

    let next = 1;
    window.clearInterval(timer.current);
    setProgress(0);
    timer.current = window.setInterval(() => {
      const batch: Found[] = [];
      for (const limit = Math.min(255, next + 12); next < limit; next++) {
        const host = hosts.get(next);
        if (host) batch.push(host);
      }
      if (batch.length) setFound(current => [...current, ...batch]);
      setProgress(Math.round((next - 1) / 254 * 100));
      if (next >= 255) {
        window.clearInterval(timer.current);
        setProgress(null);
      }
    }, 60);
  }

  return (
    <section className="rs-panel dg-wide">
      <h2>Subnet discovery (ARP / broadcast)</h2>
      <form className="dg-form" onSubmit={scan}>
        <input value={subnet} onChange={event => setSubnet(event.target.value)} placeholder={defaultSubnet} aria-label="Subnet" disabled={progress !== null} />
        <button type="submit" disabled={progress !== null}>{progress === null ? "Scan subnet" : `Scanning… ${progress}%`}</button>
      </form>
      {progress !== null && <progress className="dg-progress" max={100} value={progress} />}
      {error && <p className="rs-error dg-pad" role="alert">{error}</p>}
      <table className="dg-table">
        <thead><tr><th>IP address</th><th>MAC address</th><th>Hostname</th><th>Vendor</th><th>Discovered via</th></tr></thead>
        <tbody>
          {found.map(host => (
            <tr key={host.ip}><td>{host.ip}</td><td className="dg-mono">{host.mac}</td><td>{host.hostname}</td><td>{host.vendor}</td><td className="muted">{host.method}</td></tr>
          ))}
        </tbody>
      </table>
      {found.length === 0 && progress === null && <p className="rs-note">No scan run yet.</p>}
      {found.length > 0 && progress === null && <p className="rs-note">{found.length} hosts responded.</p>}
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
      <datalist id="dg-hosts">
        {machines.map(m => <option key={m.id} value={m.hostname}>{m.ipAddress}</option>)}
      </datalist>
      <div className="dg-grid">
        <PortChecker machines={machines} />
        <NetConsole machines={machines} />
        <SubnetScanner machines={machines} />
      </div>
    </div>
  );
}

export default Diagnostics;
