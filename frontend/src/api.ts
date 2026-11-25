import { API_URL } from "./config";

const AUTH_PREFIX = "/api/v1/auth/";
const TIMEOUT_MS = 10_000;

let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_URL}${AUTH_PREFIX}refresh`, { method: "POST", credentials: "include", signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = () => fetch(`${API_URL}${path}`, { ...init, credentials: "include", signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS) });

  let response: Response;
  try {
    response = await send();
  } catch (error) {
    if (!path.startsWith(AUTH_PREFIX) && !init.signal?.aborted) onSessionExpired?.();
    throw error;
  }
  if (response.status !== 401 || path.startsWith(AUTH_PREFIX)) return response;

  if (await refreshSession()) return send();

  onSessionExpired?.();
  return response;
}
