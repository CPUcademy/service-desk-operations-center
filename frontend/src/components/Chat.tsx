
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, Plus, Send, X } from "lucide-react";
import { usePeerChat, type PeerStatus } from "../chat/usePeerChat";
import { API_URL } from "../config";
import "./Chat.css";

const STATUS_LABEL: Record<PeerStatus, string> = {
  idle: "Wybierz rozmowę",
  connecting: "Łączenie...",
  connected: "Połączono",
  unavailable: "Użytkownik niedostępny",
  disconnected: "Rozłączono",
};

function Chat() {
  const { signalReady, peerId, status, messages, connect, send, hangup } =
    usePeerChat();

  const [myId, setMyId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [newChat, setNewChat] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [error, setError] = useState("");
  const [conversations, setConversations] = useState<number[]>([]);

  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/users/me`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((user) => {
        if (user) setMyId(user.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (peerId !== null) {
      setConversations((current) =>
        current.includes(peerId) ? current : [...current, peerId]
      );
    }
  }, [peerId]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function startChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const id = Number(newUser);

    if (!newUser.trim() || !Number.isInteger(id) || id <= 0) {
      setError("Wpisz prawidłowe ID użytkownika.");
      return;
    }

    if (id === myId) {
      setError("Nie możesz rozpocząć rozmowy z samym sobą.");
      return;
    }

    if (!signalReady) {
      setError("Brak połączenia z serwerem.");
      return;
    }

    connect(id);
    setNewChat(false);
    setNewUser("");
    setError("");
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = text.trim();

    if (value && send(value)) {
      setText("");
    }
  }

  const connected = status === "connected";

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div>
            <h2>Chat</h2>
            <p>Twoje rozmowy</p>
          </div>

          <button
            className="chat-new-button"
            type="button"
            onClick={() => {
              setNewChat(!newChat);
              setError("");
            }}
            disabled={!signalReady}
            title="Nowa rozmowa"
          >
            {newChat ? <X size={19} /> : <Plus size={19} />}
          </button>
        </div>

        {newChat && (
          <form className="chat-new-panel" onSubmit={startChat}>
            <h3>Nowa rozmowa</h3>

            <div className="chat-search">
              <Search size={17} />
              <input
                autoFocus
                value={newUser}
                onChange={(event) => {
                  setNewUser(event.target.value);
                  setError("");
                }}
                placeholder="Wyszukaj użytkownika..."
              />
            </div>

            {error && <p className="chat-error">{error}</p>}

            <button type="submit" className="chat-start-button">
              Rozpocznij rozmowę
            </button>
          </form>
        )}

        {!newChat && (
          <>
            <div className="chat-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Szukaj rozmów..."
              />
            </div>

            <div className="chat-list">
              {conversations
                .filter((id) => String(id).includes(search))
                .map((id) => (
                  <button
                    type="button"
                    key={id}
                    className={`chat-list-item ${peerId === id ? "active" : ""}`}
                    onClick={() => connect(id)}
                  >
                    <div className="chat-avatar">{String(id).slice(0, 2)}</div>
                    <div>
                      <strong>Użytkownik #{id}</strong>
                      <small>
                        {peerId === id ? STATUS_LABEL[status] : "Rozmowa"}
                      </small>
                    </div>
                  </button>
                ))}

              {conversations.length === 0 && (
                <p className="chat-empty-list">
                  Nie masz jeszcze rozmów.
                </p>
              )}
            </div>
          </>
        )}

        <div className="chat-my-id">
          {signalReady
            ? `Twoje ID: ${myId ?? "..."}`
            : "Brak połączenia z serwerem"}
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div>
            <strong>
              {peerId !== null ? `Użytkownik #${peerId}` : "Wiadomości"}
            </strong>
            <small>{STATUS_LABEL[status]}</small>
          </div>

          <button
            type="button"
            className="chat-hangup"
            onClick={hangup}
            disabled={peerId === null}
          >
            Rozłącz
          </button>
        </header>

        <div className="chat-messages">
          {peerId === null ? (
            <div className="chat-welcome">
              <h3>Twoje rozmowy</h3>
              <p>Wybierz rozmowę lub rozpocznij nową.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-welcome">
              <p>To początek rozmowy.</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`chat-message ${message.fromMe ? "mine" : ""}`}
              >
                {message.text}
              </div>
            ))
          )}

          <div ref={messagesEnd} />
        </div>

        <form className="chat-input-container" onSubmit={handleSend}>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Napisz wiadomość..."
            disabled={!connected}
          />

          <button type="submit" disabled={!connected || !text.trim()}>
            <Send size={18} />
          </button>
        </form>
      </main>
    </div>
  );
}

export default Chat;
