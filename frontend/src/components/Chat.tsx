import {
  Search,
  Plus,
  Paperclip,
  Send,
  MoreHorizontal,
} from "lucide-react";

import "./Chat.css";

function Chat() {
  return (
    <div className="chat-page">
      <div className="chat-container">

        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2>Chat</h2>

            <button type="button" className="chat-icon-button">
              <Plus size={20} />
            </button>
          </div>

          <div className="chat-search">
            <Search size={18} />
            <input type="text" aria-label="Szukaj" />
          </div>

          <div className="chat-list"></div>
        </aside>

        <main className="chat-main">
          <header className="chat-header">
            <div></div>

            <button type="button" className="chat-icon-button">
              <MoreHorizontal size={22} />
            </button>
          </header>

          <div className="chat-messages"></div>

          <div className="chat-input-container">
            <button type="button" className="chat-icon-button">
              <Paperclip size={20} />
            </button>

            <input
              type="text"
              placeholder="Napisz wiadomość..."
            />

            <button type="button" className="chat-send-button">
              <Send size={19} />
            </button>
          </div>
        </main>

      </div>
    </div>
  );
}

export default Chat;