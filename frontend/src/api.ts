import { API_URL } from "./config";

const AUTH_PREFIX = "/api/v1/auth/";

let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_URL}${AUTH_PREFIX}refresh`, { method: "POST", credentials: "include" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = () => fetch(`${API_URL}${path}`, { ...init, credentials: "include" });

  const response = await send();
  if (response.status !== 401 || path.startsWith(AUTH_PREFIX)) return response;

  if (await refreshSession()) return send();

  onSessionExpired?.();
  return response;
}
