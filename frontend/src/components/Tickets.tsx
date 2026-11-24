import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../api";
import type { Machine } from "../types/Machine";
import { PRIORITIES, priorityLabel, type Ticket } from "../types/Ticket";
import "./Tickets.css";

const DESCRIPTION_LIMIT = 255;

type Filter = "open" | "fixed" | "all";

const PAGE_SIZE = 5;

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

async function errorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.message ?? fallback;
}

function normalize(raw: Ticket & { fixed?: boolean }): Ticket {
  return { ...raw, isFixed: raw.isFixed ?? raw.fixed ?? false };
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function byUrgency(a: Ticket, b: Ticket) {
  if (a.isFixed !== b.isFixed) return a.isFixed ? 1 : -1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return b.id - a.id;
}

const COOKED_KEY = "tickets.cooked";
const COOK_CLICKS = 5;
const COOK_WINDOW_MS = 1500;

function readCooked() {
  try {
    return localStorage.getItem(COOKED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveCooked(value: boolean) {
  try {
    localStorage.setItem(COOKED_KEY, value ? "1" : "0");
  } catch {
  }
}

type NewTicketFormProps = {
  isAdmin: boolean;
  cooked: boolean;
  onToggleCooked: () => void;
  onCreated: (ticket: Ticket) => void;
};

function NewTicketForm({ isAdmin, cooked, onToggleCooked, onCreated }: NewTicketFormProps) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineId, setMachineId] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(3);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cookClicks = useRef({ count: 0, last: 0 });

  function handlePriorityLabelClick() {
    const now = Date.now();
    const clicks = cookClicks.current;
    clicks.count = now - clicks.last < COOK_WINDOW_MS ? clicks.count + 1 : 1;
    clicks.last = now;
    if (clicks.count >= COOK_CLICKS) {
      clicks.count = 0;
      onToggleCooked();
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    apiFetch("/api/v1/machines")
      .then(response => (response.ok ? response.json() : []))
      .then((data: Machine[]) => setMachines(data))
      .catch(() => setMachines([]));
  }, [isAdmin]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const id = Number(machineId);
    if (!Number.isInteger(id) || id < 1) {
      setMessage({ text: "Choose a valid machine.", error: true });
      return;
    }
    if (!description.trim()) {
      setMessage({ text: "Describe the problem.", error: true });
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch("/api/v1/tickets/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId: id, description: description.trim(), priority }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Failed to create the ticket."));

      onCreated(normalize(await response.json()));
      setMachineId("");
      setDescription("");
      setPriority(3);
      setMessage({ text: "Ticket submitted.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Failed to create the ticket.", error: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="ticket-form" onSubmit={handleSubmit}>
      <h2>New ticket</h2>

      <div className="ticket-form-row">
        <div className="ticket-field">
          <label htmlFor="ticketMachine">MACHINE</label>
          {isAdmin && machines.length > 0 ? (
            <select id="ticketMachine" value={machineId} onChange={e => setMachineId(e.target.value)} required>
              <option value="" disabled>Select a machine</option>
              {machines.map(machine => (
                <option key={machine.id} value={machine.id}>
                  {machine.hostname} (#{machine.id})
                </option>
              ))}
            </select>
          ) : (
            <input
              id="ticketMachine"
              type="number"
              min={1}
              placeholder="Machine ID"
              value={machineId}
              onChange={e => setMachineId(e.target.value)}
              required
            />
          )}
        </div>

        <div className="ticket-field">
          <label htmlFor="ticketPriority" className="ticket-cook-toggle" onClick={handlePriorityLabelClick}>
            {cooked ? "HOW COOKED ARE YOU?" : "PRIORITY"}
          </label>
          <select id="ticketPriority" value={priority} onChange={e => setPriority(Number(e.target.value))}>
            {(cooked ? [...PRIORITIES] : PRIORITIES).map(p => (
              <option key={p.value} value={p.value}>{priorityLabel(p.value, cooked)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="ticket-field">
        <label htmlFor="ticketDescription">DESCRIPTION</label>
        <textarea
          id="ticketDescription"
          rows={2}
          maxLength={DESCRIPTION_LIMIT}
          placeholder="What's wrong?"
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
        />
        <span className="ticket-counter">{description.length} / {DESCRIPTION_LIMIT}</span>
      </div>

      <div className="ticket-form-footer">
        {message && (
          <p className={`ticket-message ${message.error ? "error" : ""}`} role={message.error ? "alert" : "status"}>
            {message.text}
          </p>
        )}
        <button type="submit" className="ticket-submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit ticket"}
        </button>
      </div>
    </form>
  );
}

function Tickets() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [closing, setClosing] = useState<number | null>(null);
  const [cooked, setCooked] = useState(readCooked);
  const [page, setPage] = useState(1);

  function toggleCooked() {
    setCooked(current => {
      saveCooked(!current);
      return !current;
    });
  }

  const loadTickets = useCallback(async () => {
    try {
      const response = await apiFetch(isAdmin ? "/api/v1/tickets" : "/api/v1/tickets/me");
      if (!response.ok) throw new Error(await errorMessage(response, "Failed to load tickets."));
      setTickets((await response.json()).map(normalize));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  async function markFixed(id: number) {
    setClosing(id);
    try {
      const response = await apiFetch(`/api/v1/tickets/fixed/${id}`, { method: "PATCH" });
      if (!response.ok && response.status !== 409) {
        throw new Error(await errorMessage(response, "Failed to close the ticket."));
      }
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close the ticket.");
    } finally {
      setClosing(null);
    }
  }

  const visible = tickets
    .filter(t => filter === "all" || (filter === "open" ? !t.isFixed : t.isFixed))
    .sort(byUrgency);
  const openCount = tickets.filter(t => !t.isFixed).length;

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageTickets = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function changeFilter(value: Filter) {
    setFilter(value);
    setPage(1);
  }

  return (
    <div className={`tickets-page ${cooked ? "cooked" : ""}`}>
      <h1>Tickets</h1>

      <NewTicketForm
        isAdmin={isAdmin}
        cooked={cooked}
        onToggleCooked={toggleCooked}
        onCreated={ticket => setTickets(current => [ticket, ...current])}
      />

      <section className="ticket-list-section">
        <div className="ticket-list-header">
          <h2>{isAdmin ? "All tickets" : "My tickets"} <span>{openCount} open</span></h2>

          <div className="ticket-filter" role="tablist" aria-label="Filter tickets">
            {(["open", "fixed", "all"] as const).map(value => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={filter === value ? "active" : ""}
                onClick={() => changeFilter(value)}
              >
                {value === "open" ? "Open" : value === "fixed" ? "Fixed" : "All"}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="ticket-message error" role="alert">{error}</p>}

        <div>
        {loading ? (
          <div className="ticket-list">
            {Array.from({ length: Math.min(PAGE_SIZE, 3) }, (_, i) => <div key={i} className="skeleton ticket-skeleton" />)}
          </div>
        ) : visible.length === 0 ? (
          <p className="ticket-empty">
            {filter === "open" ? "No open tickets." : filter === "fixed" ? "No fixed tickets yet." : "No tickets yet."}
          </p>
        ) : (
          <div className="ticket-list">
            {pageTickets.map(ticket => (
              <article key={ticket.id} className={`ticket-card ${ticket.isFixed ? "fixed" : ""}`} data-priority={ticket.priority}>
                <div className="ticket-card-top">
                  <span className="ticket-id">#{ticket.id}</span>
                  <span className={`ticket-badge priority-${ticket.priority}`}>{priorityLabel(ticket.priority, cooked)}</span>
                  <span className={`ticket-badge ${ticket.isFixed ? "status-fixed" : "status-open"}`}>
                    {ticket.isFixed ? "Fixed" : "Open"}
                  </span>

                  {isAdmin && !ticket.isFixed && (
                    <Link className="ticket-fix-button ticket-attend" to={`/session/${ticket.machineId}`}>
                      Attend
                    </Link>
                  )}

                  {isAdmin && !ticket.isFixed && (
                    <button
                      type="button"
                      className="ticket-fix-button"
                      onClick={() => void markFixed(ticket.id)}
                      disabled={closing === ticket.id}
                    >
                      {closing === ticket.id ? "Closing…" : "Mark as fixed"}
                    </button>
                  )}
                </div>

                <p className="ticket-description" title={ticket.description}>{ticket.description}</p>

                <div className="ticket-meta">
                  <span>Machine: <strong>{ticket.machineHostname}</strong></span>
                  {isAdmin && <span>Reported by: <strong>{ticket.userFullName}</strong></span>}
                  {ticket.isFixed && ticket.adminFullName && (
                    <span>Fixed by: <strong>{ticket.adminFullName}</strong></span>
                  )}
                  {ticket.createdAt && <span>Opened: <strong>{formatDate(ticket.createdAt)}</strong></span>}
                  {ticket.closedAt && <span>Closed: <strong>{formatDate(ticket.closedAt)}</strong></span>}
                </div>
              </article>
            ))}
          </div>
        )}
        </div>

        {!loading && pageCount > 1 && (
          <nav className="ticket-pagination" aria-label="Ticket pages">
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <span aria-hidden="true">‹</span> Prev
            </button>

            {pageNumbers(currentPage, pageCount).map((item, index) =>
              item === "…" ? (
                <span key={`gap-${index}`} className="ticket-page-gap">…</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={item === currentPage ? "active" : ""}
                  aria-current={item === currentPage ? "page" : undefined}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === pageCount}
            >
              Next <span aria-hidden="true">›</span>
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}

export default Tickets;
