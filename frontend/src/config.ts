// Set VITE_API_URL in frontend/.env, e.g. VITE_API_URL=https://api.yourdomain.com
// Falls back to port 8002 on the current host for local development.
const fallback = `http://${window.location.hostname}:8002`;

export const API_URL = (import.meta.env.VITE_API_URL ?? fallback).replace(/\/$/, "");

// http -> ws, https -> wss. An empty API_URL (dev proxy) resolves against the page origin.
export const WS_BASE = (API_URL || window.location.origin).replace(/^http/, "ws");
export const SIGNAL_URL = WS_BASE + "/api/v1/signal";
