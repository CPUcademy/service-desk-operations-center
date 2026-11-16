import { useCallback, useEffect, useRef, useState } from "react";
import { SIGNAL_URL } from "../config";

const ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export type ChatMessage = { id: number; fromMe: boolean; text: string; at: number };
export type PeerStatus = "idle" | "connecting" | "connected" | "unavailable" | "disconnected";

type Signal =
  | { type: "offer"; from: number; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: number; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: number; candidate: RTCIceCandidateInit }
  | { type: "hangup"; from: number }
  | { type: "unavailable"; from: number };

let nextMessageId = 0;

export function usePeerChat() {
  const [signalReady, setSignalReady] = useState(false);
  const [peerId, setPeerId] = useState<number | null>(null);
  const [status, setStatus] = useState<PeerStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const peerRef = useRef<number | null>(null);

  const addMessage = useCallback((fromMe: boolean, text: string) => {
    setMessages((m) => [...m, { id: nextMessageId++, fromMe, text, at: Date.now() }]);
  }, []);

  const sendSignal = useCallback((msg: object) => {
    if (ws.current?.readyState === WebSocket.OPEN && peerRef.current !== null)
      ws.current.send(JSON.stringify({ ...msg, to: peerRef.current }));
  }, []);

  const closePeer = useCallback(() => {
    
    const ch = channel.current, conn = pc.current;
    channel.current = null;
    pc.current = null;
    ch?.close();
    conn?.close();
  }, []);

  const setupChannel = useCallback((ch: RTCDataChannel) => {
    channel.current = ch;
    ch.onopen = () => setStatus("connected");
    // Only react if this is still the active channel (not one we replaced)
    ch.onclose = () => { console.log("channel closed"); if (channel.current === ch) setStatus("disconnected"); };
    ch.onmessage = (e) => addMessage(false, String(e.data));
  }, [addMessage]);

  const createPc = useCallback(() => {
    closePeer();
    const conn = new RTCPeerConnection(ICE);
    conn.onicecandidate = (e) => {
      if (e.candidate) sendSignal({ type: "ice", candidate: e.candidate.toJSON() });
    };
    conn.ondatachannel = (e) => setupChannel(e.channel);
    conn.onconnectionstatechange = () => {
      if (pc.current === conn && conn.connectionState === "failed") setStatus("disconnected");
    };
    conn.oniceconnectionstatechange = () => console.log("ice:", conn.iceConnectionState);
    conn.addEventListener("connectionstatechange", () => console.log("pc:", conn.connectionState));
    pc.current = conn;
    return conn;
  }, [closePeer, sendSignal, setupChannel]);

  const startConversation = useCallback((id: number) => {
    peerRef.current = id;
    setPeerId(id);
    setMessages([]);
    setStatus("connecting");
  }, []);

  const handleSignal = useCallback(async (msg: Signal) => {
    switch (msg.type) {
      case "offer": {
        startConversation(msg.from);
        const conn = createPc();
        await conn.setRemoteDescription(msg.sdp);
        await conn.setLocalDescription(await conn.createAnswer());
        sendSignal({ type: "answer", sdp: conn.localDescription });
        break;
      }
      case "answer":
        if (msg.from === peerRef.current) await pc.current?.setRemoteDescription(msg.sdp);
        break;
      case "ice":
        if (msg.from === peerRef.current) await pc.current?.addIceCandidate(msg.candidate);
        break;
      case "hangup":
        if (msg.from === peerRef.current) { closePeer(); setStatus("disconnected"); }
        break;
      case "unavailable":
        if (msg.from === peerRef.current) { closePeer(); setStatus("unavailable"); }
        break;
    }
  }, [closePeer, createPc, sendSignal, startConversation]);

  useEffect(() => {
    
    const socket = new WebSocket(SIGNAL_URL);
    ws.current = socket;
    socket.onopen = () => setSignalReady(true);
    socket.onclose = () => setSignalReady(false);
    
    let queue = Promise.resolve();
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data) as Signal;
      console.log("signal in:", msg.type, "from", msg.from);
      queue = queue.then(() => handleSignal(msg)).catch(console.error);
    };

    return () => {
      sendSignal({ type: "hangup" });
      socket.close();
      closePeer();
    };
    
  }, [handleSignal, sendSignal, closePeer]);

  const connect = useCallback(async (to: number) => {
    startConversation(to);
    const conn = createPc();
    setupChannel(conn.createDataChannel("chat"));
    await conn.setLocalDescription(await conn.createOffer());
    sendSignal({ type: "offer", sdp: conn.localDescription });
  }, [createPc, setupChannel, sendSignal, startConversation]);

  const send = useCallback((text: string) => {
    if (channel.current?.readyState !== "open") return false;
    channel.current.send(text);
    addMessage(true, text);
    return true;
  }, [addMessage]);

  const hangup = useCallback(() => {
    sendSignal({ type: "hangup" });
    closePeer();
    setStatus("disconnected");
  }, [sendSignal, closePeer]);

  return { signalReady, peerId, status, messages, connect, send, hangup };
}