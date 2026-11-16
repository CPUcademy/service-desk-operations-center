// Set VITE_API_URL in frontend/.env, e.g. VITE_API_URL=https://api.yourdomain.com
// Falls back to port 8002 on the current host for local development.
const fallback = `http://${window.location.hostname}:8002`;

export const API_URL = (import.meta.env.VITE_API_URL ?? fallback).replace(/\/$/, "");

// http -> ws, https -> wss
export const SIGNAL_URL = API_URL.replace(/^http/, "ws") + "/api/v1/signal";
