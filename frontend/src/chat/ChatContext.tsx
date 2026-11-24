import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { SIGNAL_URL } from "../config";

export type ChatMessage = { id: number; peer: number; fromMe: boolean; text: string; at: string };

type ChatContextValue = {
  ready: boolean;
  messages: ChatMessage[];
  undelivered: number[];
  send: (to: number, text: string) => boolean;
};

const ChatContext = createContext<ChatContextValue | null>(null);

let nextId = 0;

export function ChatProvider({ userId, children }: { userId: number; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [undelivered, setUndelivered] = useState<number[]>([]);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: number | undefined;

    function open() {
      const ws = new WebSocket(SIGNAL_URL);
      socket.current = ws;
      ws.onopen = () => setReady(true);
      ws.onclose = () => {
        setReady(false);
        if (!closed) retry = window.setTimeout(open, 3000);
      };
      ws.onmessage = event => {
        const msg = JSON.parse(event.data);
        if (msg.type === "chat") {
          const peer = msg.from === userId ? msg.to : msg.from;
          setMessages(current => [...current, { id: nextId++, peer, fromMe: msg.from === userId, text: msg.text, at: msg.at }]);
          setUndelivered(current => current.filter(id => id !== peer));
        } else if (msg.type === "unavailable") {
          setUndelivered(current => (current.includes(msg.from) ? current : [...current, msg.from]));
        }
      };
    }

    open();
    return () => {
      closed = true;
      window.clearTimeout(retry);
      socket.current?.close();
    };
  }, [userId]);

  const send = useCallback((to: number, text: string) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify({ type: "chat", to, text }));
    return true;
  }, []);

  return <ChatContext.Provider value={{ ready, messages, undelivered, send }}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used inside ChatProvider");
  return context;
}
