import { clearAuthToken, getAuthToken } from "../auth/tokenStorage.js";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

function buildApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${normalizedPath}`;
}

export function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(buildApiUrl(path), {
    ...options,
    headers,
  });
}

export async function handleResponse(res, { clearOnUnauthorized = true } = {}) {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (clearOnUnauthorized && res.status === 401) {
      clearAuthToken();
      window.dispatchEvent(new Event("sppg-auth-expired"));
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}
