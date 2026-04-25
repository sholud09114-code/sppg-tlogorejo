import { apiFetch, handleResponse } from "./apiClient.js";

export async function loginRequest({ username, password }) {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res, { clearOnUnauthorized: false });
}

export async function fetchCurrentUser() {
  const res = await apiFetch("/auth/me");
  return handleResponse(res, { clearOnUnauthorized: false });
}
