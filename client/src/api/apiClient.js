import { clearAuthToken, getAuthToken } from "../auth/tokenStorage.js";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_RETRY_ATTEMPTS = 1;

function buildApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${normalizedPath}`;
}

function shouldRetryRequest({ method, attempt, retryAttempts, error, response }) {
  if (attempt >= retryAttempts) return false;
  if (!["GET", "HEAD"].includes(method)) return false;
  if (error) return true;
  return response?.status >= 500;
}

function createTimeoutSignal(timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort(new DOMException("Request timeout", "TimeoutError"));
  }, timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener(
        "abort",
        () => controller.abort(externalSignal.reason),
        { once: true }
      );
    }
  }

  return { signal: controller.signal, clear: () => window.clearTimeout(timeoutId) };
}

export async function apiFetch(path, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryAttempts = DEFAULT_RETRY_ATTEMPTS,
    signal: externalSignal,
    ...fetchOptions
  } = options;
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();
  const method = String(fetchOptions.method || "GET").toUpperCase();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
    const timeout = createTimeoutSignal(timeoutMs, externalSignal);
    try {
      const response = await fetch(buildApiUrl(path), {
        ...fetchOptions,
        headers,
        signal: timeout.signal,
      });

      if (shouldRetryRequest({ method, attempt, retryAttempts, response })) {
        timeout.clear();
        continue;
      }

      timeout.clear();
      return response;
    } catch (error) {
      timeout.clear();
      if (error?.name === "AbortError" || error?.name === "TimeoutError") {
        throw new Error(
          "Server sedang disiapkan, mohon tunggu beberapa detik lalu coba lagi.",
          { cause: error }
        );
      }
      if (shouldRetryRequest({ method, attempt, retryAttempts, error })) {
        continue;
      }
      throw new Error(
        "Tidak dapat terhubung ke server. Jika baru dibuka, server mungkin sedang disiapkan. Mohon tunggu beberapa detik lalu coba lagi.",
        { cause: error }
      );
    }
  }

  throw new Error("Request gagal. Coba lagi beberapa saat.");
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
