import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePeerChat } from "./usePeerChat";

type ChatContextValue = ReturnType<typeof usePeerChat> & { conversations: number[] };

const ChatContext = createContext<ChatContextValue | null>(null);

// Lives in the app layout so the signalling socket, peer connection and
// messages survive navigating between pages instead of resetting with <Chat />.
export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = usePeerChat();
  const [conversations, setConversations] = useState<number[]>([]);
  const { peerId } = chat;

  useEffect(() => {
    if (peerId !== null) {
      setConversations((current) => (current.includes(peerId) ? current : [...current, peerId]));
    }
  }, [peerId]);

  return <ChatContext.Provider value={{ ...chat, conversations }}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used inside ChatProvider");
  return context;
}
