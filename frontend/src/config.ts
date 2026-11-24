const fallback = `http://${window.location.hostname}:8002`;

export const API_URL = (import.meta.env.VITE_API_URL ?? fallback).replace(/\/$/, "");

export const WS_BASE = (API_URL || window.location.origin).replace(/^http/, "ws");
export const SIGNAL_URL = WS_BASE + "/api/v1/signal";
