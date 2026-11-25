import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import "./Tickets.css";

type UserRow = { id: number; fullName: string; email: string; isAdmin: boolean };

const EMPTY = { fullName: "", email: "", password: "", isAdmin: false };

async function errorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.message ?? fallback;
}

function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [promoting, setPromoting] = useState<UserRow | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [removing, setRemoving] = useState<UserRow | null>(null);
  const [typedEmail, setTypedEmail] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const removeDialog = useRef<HTMLDialogElement>(null);
  const emailMatches = !!removing && typedEmail.trim().toLowerCase() === removing.email.toLowerCase();

  useEffect(() => {
    apiFetch("/api/v1/users")
      .then(response => (response.ok ? response.json() : []))
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await apiFetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, fullName: form.fullName.trim(), email: form.email.trim() }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Failed to add the user."));
      const created: UserRow = await response.json();
      setUsers(current => [...(current ?? []), created].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setForm(EMPTY);
      setMessage({ text: `${created.fullName} added${created.isAdmin ? " as an administrator" : ""}.`, error: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Failed to add the user.", error: true });
    } finally {
      setSaving(false);
    }
  }

  function askPromote(row: UserRow) {
    setPromoting(row);
    setPromoteError(null);
    dialog.current?.showModal();
  }

  async function promote() {
    if (!promoting) return;
    setPromoteError(null);
    try {
      const response = await apiFetch(`/api/v1/users/${promoting.id}/admin`, { method: "PATCH" });
      if (!response.ok) throw new Error(await errorMessage(response, "Failed to grant admin rights."));
      const updated: UserRow = await response.json();
      setUsers(current => current?.map(row => (row.id === updated.id ? updated : row)) ?? null);
      dialog.current?.close();
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : "Failed to grant admin rights.");
    }
  }

  function askRemove(row: UserRow) {
    setRemoving(row);
    setTypedEmail("");
    setRemoveError(null);
    removeDialog.current?.showModal();
  }

  async function remove() {
    if (!removing || !emailMatches) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      const response = await apiFetch(`/api/v1/users/${removing.id}?confirmEmail=${encodeURIComponent(typedEmail.trim())}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await errorMessage(response, "Failed to remove the user."));
      setUsers(current => current?.filter(row => row.id !== removing.id) ?? null);
      removeDialog.current?.close();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Failed to remove the user.");
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <div className="tickets-page">
      <h1>Users</h1>

      <form className="ticket-form" onSubmit={handleSubmit}>
        <h2>Add user</h2>
        <div className="ticket-form-row">
          <div className="ticket-field">
            <label htmlFor="userName">FULL NAME</label>
            <input id="userName" value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} required maxLength={100} />
          </div>
          <div className="ticket-field">
            <label htmlFor="userEmail">EMAIL</label>
            <input id="userEmail" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required />
          </div>
        </div>
        <div className="ticket-field">
          <label htmlFor="userPassword">INITIAL PASSWORD</label>
          <input
            id="userPassword"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={event => setForm({ ...form, password: event.target.value })}
            minLength={12}
            maxLength={72}
            required
          />
        </div>
        <label className="user-admin-check">
          <input type="checkbox" checked={form.isAdmin} onChange={event => setForm({ ...form, isAdmin: event.target.checked })} />
          Administrator (full access to machines, remote control and users, can't be revoked here)
        </label>
        <div className="ticket-form-footer">
          {message && (
            <p className={`ticket-message ${message.error ? "error" : ""}`} role={message.error ? "alert" : "status"}>{message.text}</p>
          )}
          <button type="submit" className="ticket-submit" disabled={saving}>{saving ? "Adding…" : "Add user"}</button>
        </div>
      </form>

      <section className="ticket-form users-list" aria-labelledby="users-title">
        <h2 id="users-title">All users</h2>
        {users === null ? (
          <div className="skeleton ticket-skeleton" />
        ) : (
          <table className="users-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {users.map(row => (
                <tr key={row.id}>
                  <td><strong>{row.fullName}</strong>{row.id === user?.id && <span className="muted"> · you</span>}</td>
                  <td>{row.email}</td>
                  <td className={row.isAdmin ? "users-admin" : ""}>{row.isAdmin ? "Administrator" : "User"}</td>
                  <td className="users-action">
                    {!row.isAdmin && <button type="button" className="ticket-fix-button" onClick={() => askPromote(row)}>Make admin</button>}
                    {row.id !== user?.id && <button type="button" className="ticket-fix-button" onClick={() => askRemove(row)}>Remove</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <dialog ref={dialog} className="rc-dialog" onClose={() => setPromoting(null)}>
        <form onSubmit={event => { event.preventDefault(); void promote(); }}>
          <h2>Make {promoting?.fullName} an administrator?</h2>
          <p>They get full access to all machines, remote control, diagnostics and user management. Admin rights can't be taken away.</p>
          {promoteError && <p className="rc-error" role="alert">{promoteError}</p>}
          <div className="rc-dialog-actions">
            <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
            <button type="submit" className="is-danger">Make admin</button>
          </div>
        </form>
      </dialog>

      <dialog ref={removeDialog} className="rc-dialog" onClose={() => setRemoving(null)}>
        <form onSubmit={event => { event.preventDefault(); void remove(); }}>
          <h2>Remove {removing?.fullName}?</h2>
          <p>
            This permanently deletes the account and their tickets, and immediately ends their open sessions.
            Users who own machines can't be removed until those machines are removed. Type <strong>{removing?.email}</strong> to confirm.
          </p>
          <input value={typedEmail} onChange={event => setTypedEmail(event.target.value)} aria-label="Email" autoComplete="off" spellCheck={false} />
          {removeError && <p className="rc-error" role="alert">{removeError}</p>}
          <div className="rc-dialog-actions">
            <button type="button" onClick={() => removeDialog.current?.close()}>Cancel</button>
            <button type="submit" className="is-danger" disabled={removeBusy || !emailMatches}>{removeBusy ? "Removing…" : "Remove"}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

export default Users;
