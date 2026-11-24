import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, Plus, Send, X } from "lucide-react";
import { type PeerStatus } from "../chat/usePeerChat";
import { useChat } from "../chat/ChatContext";
import { useAuth } from "../auth/AuthContext";
import "./Chat.css";

const STATUS_LABEL: Record<PeerStatus, string> = {
  idle: "Select a conversation",
  connecting: "Connecting...",
  connected: "Connected",
  unavailable: "User unavailable",
  disconnected: "Disconnected",
};

function Chat() {
  const { signalReady, peerId, status, messages, conversations, connect, send, hangup } =
    useChat();

  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [newChat, setNewChat] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [error, setError] = useState("");

  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function startChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const id = Number(newUser);

    if (!newUser.trim() || !Number.isInteger(id) || id <= 0) {
      setError("Enter a valid user ID.");
      return;
    }

    if (id === myId) {
      setError("You cannot start a conversation with yourself.");
      return;
    }

    if (!signalReady) {
      setError("No connection to the server.");
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
          <h2>Chat</h2>

          <button
            className="chat-new-button"
            type="button"
            onClick={() => {
              setNewChat(!newChat);
              setError("");
            }}
            disabled={!signalReady}
            title="New conversation"
          >
            {newChat ? <X size={16} /> : <Plus size={16} />}
          </button>
        </div>

        {newChat && (
          <form className="chat-new-panel" onSubmit={startChat}>
            <h3>New conversation</h3>

            <div className="chat-search">
              <Search size={14} />
              <input
                autoFocus
                value={newUser}
                onChange={(event) => {
                  setNewUser(event.target.value);
                  setError("");
                }}
                placeholder="Search for a user..."
              />
            </div>

            {error && <p className="chat-error">{error}</p>}

            <button type="submit" className="chat-start-button">
              Start conversation
            </button>
          </form>
        )}

        {!newChat && (
          <>
            <div className="chat-search">
              <Search size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations..."
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
                    onClick={() => {
                      const live = status === "connected" || status === "connecting";
                      if (peerId !== id || !live) connect(id);
                    }}
                  >
                    <div className="chat-avatar">{String(id).slice(0, 2)}</div>
                    <div>
                      <strong>User #{id}</strong>
                      <small>
                        {peerId === id ? STATUS_LABEL[status] : "Conversation"}
                      </small>
                    </div>
                  </button>
                ))}

              {conversations.length === 0 && (
                <p className="chat-empty-list">
                  You don't have any conversations yet.
                </p>
              )}
            </div>
          </>
        )}

        <div className="chat-my-id">
          {signalReady
            ? `Your ID: ${myId ?? "..."}`
            : "No connection to the server"}
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div>
            <strong>
              {peerId !== null ? `User #${peerId}` : "Messages"}
            </strong>
            <small>{STATUS_LABEL[status]}</small>
          </div>

          <button
            type="button"
            className="chat-hangup"
            onClick={hangup}
            disabled={peerId === null}
          >
            Disconnect
          </button>
        </header>

        <div className="chat-messages">
          {peerId === null ? (
            <div className="chat-welcome">
              <p>Select a conversation or start a new one.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-welcome">
              <p>This is the beginning of your conversation.</p>
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
            placeholder="Type a message..."
            disabled={!connected}
          />

          <button type="submit" disabled={!connected || !text.trim()}>
            <Send size={16} />
          </button>
        </form>
      </main>
    </div>
  );
}

export default Chat;

