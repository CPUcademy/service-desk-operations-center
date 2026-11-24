import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, Send } from "lucide-react";
import { apiFetch } from "../api";
import { useChat } from "../chat/ChatContext";
import "./Chat.css";

type Contact = { id: number; fullName: string; isAdmin: boolean; online: boolean };

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();

function Chat() {
  const { ready, messages, undelivered, send } = useChat();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [search, setSearch] = useState("");
  const [peerId, setPeerId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = () => apiFetch("/api/v1/users/contacts")
      .then(response => (response.ok ? response.json() : []))
      .then((data: Contact[]) => active && setContacts(data))
      .catch(() => active && setContacts(current => current ?? []));
    void load();
    const interval = window.setInterval(load, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const conversation = messages.filter(message => message.peer === peerId);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length]);

  const query = search.trim().toLowerCase();
  const lastMessage = (id: number) => messages.findLast(message => message.peer === id);
  const visible = (contacts ?? [])
    .filter(contact => contact.fullName.toLowerCase().includes(query))
    .sort((a, b) => (lastMessage(b.id)?.id ?? -1) - (lastMessage(a.id)?.id ?? -1) || Number(b.online) - Number(a.online));
  const peer = contacts?.find(contact => contact.id === peerId) ?? null;

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (peerId !== null && value && send(peerId, value)) setText("");
  }

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2>Chat</h2>
        </div>

        <label className="chat-search">
          <Search size={14} aria-hidden="true" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search people…" aria-label="Search people" />
        </label>

        <div className="chat-list" role="listbox" aria-label="People">
          {visible.map(contact => {
            const last = lastMessage(contact.id);
            return (
              <button
                type="button"
                role="option"
                aria-selected={peerId === contact.id}
                key={contact.id}
                className={`chat-list-item ${peerId === contact.id ? "active" : ""}`}
                onClick={() => setPeerId(contact.id)}
              >
                <div className="chat-avatar">{initials(contact.fullName)}</div>
                <div>
                  <strong>{contact.fullName}</strong>
                  <small>
                    {last ? `${last.fromMe ? "You: " : ""}${last.text}` : `${contact.isAdmin ? "IT support" : "User"} · ${contact.online ? "Online" : "Offline"}`}
                  </small>
                </div>
              </button>
            );
          })}

          {contacts !== null && visible.length === 0 && (
            <p className="chat-empty-list">{query ? "No one matches your search." : "No one to chat with yet."}</p>
          )}
        </div>

        {!ready && <div className="chat-my-id">Reconnecting to the server…</div>}
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div>
            <strong>{peer?.fullName ?? "Messages"}</strong>
            <small>{peer ? `${peer.isAdmin ? "IT support" : "User"} · ${peer.online ? "Online" : "Offline"}` : "Choose someone from the list"}</small>
          </div>
        </header>

        <div className="chat-messages">
          {peer === null ? (
            <div className="chat-welcome"><p>Choose someone from the list to start chatting.</p></div>
          ) : conversation.length === 0 ? (
            <div className="chat-welcome"><p>No messages yet. Say hello.</p></div>
          ) : (
            conversation.map(message => (
              <div key={message.id} className={`chat-message ${message.fromMe ? "mine" : ""}`}>
                {message.text}
              </div>
            ))
          )}
          {peerId !== null && undelivered.includes(peerId) && (
            <p className="chat-error" role="alert">{peer?.fullName ?? "This person"} is offline. Your last message was not delivered.</p>
          )}
          <div ref={messagesEnd} />
        </div>

        <form className="chat-input-container" onSubmit={handleSend}>
          <input
            value={text}
            onChange={event => setText(event.target.value)}
            placeholder={peer ? `Message ${peer.fullName}…` : "Choose someone first"}
            maxLength={2000}
            disabled={!peer || !ready}
          />
          <button type="submit" aria-label="Send" disabled={!peer || !ready || !text.trim()}>
            <Send size={16} />
          </button>
        </form>
      </main>
    </div>
  );
}

export default Chat;
