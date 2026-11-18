import { API_URL } from "./config";

const AUTH_PREFIX = "/api/v1/auth/";

let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

// AuthProvider registers this so a failed refresh mid-session logs the user out.
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

// Swaps the refresh cookie for a new access cookie. Concurrent callers share one
// request, because the backend rotates the refresh token on every use.
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_URL}${AUTH_PREFIX}refresh`, { method: "POST", credentials: "include" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// fetch() for our API: sends cookies, and on a 401 refreshes the session once and retries.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = () => fetch(`${API_URL}${path}`, { ...init, credentials: "include" });

  const response = await send();
  if (response.status !== 401 || path.startsWith(AUTH_PREFIX)) return response;

  if (await refreshSession()) return send();

  onSessionExpired?.();
  return response;
}
