import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, Plus, Paperclip, Send, MoreHorizontal } from "lucide-react";
import { usePeerChat, type PeerStatus } from "../chat/usePeerChat";
import { API_URL } from "../config";

import "./Chat.css";

const STATUS_LABEL: Record<PeerStatus, string> = {
  idle: "Select a conversation",
  connecting: "Connecting…",
  connected: "Connected",
  unavailable: "User unavailable",
  disconnected: "Disconnected",
};

function Chat() {
  const { signalReady, peerId, status, messages, connect, send, hangup } = usePeerChat();
  const [myId, setMyId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);

  // Own ID, so you can give it to the other person while there's no user list
  useEffect(() => {
    fetch(`${API_URL}/api/v1/users/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => me && setMyId(me.id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startChat = () => {
    const input = window.prompt("ID użytkownika:");
    const id = Number(input);
    if (input && Number.isInteger(id) && id > 0 && id !== myId) connect(id);
  };

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (value && send(value)) setText("");
  };

  const connected = status === "connected";

  return (
    <div className="chat-page">
      <div className="chat-container">

        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2>Chat</h2>

            <button type="button" className="chat-icon-button" onClick={startChat}
                    disabled={!signalReady} aria-label="Nowa rozmowa">
              <Plus size={20} />
            </button>
          </div>

          <div className="chat-search">
            <Search size={18} />
            <input type="text" aria-label="Szukaj" />
          </div>

          <div className="chat-list">
            {peerId !== null && (
              <div className="chat-list-item active">
                <span>Użytkownik #{peerId}</span>
                <small>{STATUS_LABEL[status]}</small>
              </div>
            )}
          </div>

          <div className="chat-my-id">
            {signalReady ? `Twoje ID: ${myId ?? "…"}` : "Brak połączenia z serwerem"}
          </div>
        </aside>

        <main className="chat-main">
          <header className="chat-header">
            <div className="chat-header-title">
              {peerId !== null ? <strong>Użytkownik #{peerId}</strong> : null}
              <small>{STATUS_LABEL[status]}</small>
            </div>

            <button type="button" className="chat-icon-button" onClick={hangup}
                    disabled={peerId === null} aria-label="Rozłącz">
              <MoreHorizontal size={22} />
            </button>
          </header>

          <div className="chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`chat-message ${m.fromMe ? "mine" : ""}`}>
                {m.text}
              </div>
            ))}
            <div ref={messagesEnd} />
          </div>

          <form className="chat-input-container" onSubmit={handleSend}>
            <button type="button" className="chat-icon-button" disabled>
              <Paperclip size={20} />
            </button>

            <input
              type="text"
              placeholder="Napisz wiadomość..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!connected}
            />

            <button type="submit" className="chat-send-button" disabled={!connected}>
              <Send size={19} />
            </button>
          </form>
        </main>

      </div>
    </div>
  );
}

export default Chat;