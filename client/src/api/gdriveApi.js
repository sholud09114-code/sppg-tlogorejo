import { apiFetch, handleResponse } from "./apiClient.js";
import { getAuthToken } from "../auth/tokenStorage.js";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export async function fetchGdriveStatus() {
  const res = await apiFetch("/gdrive/status");
  return handleResponse(res);
}

export async function startGdriveOAuth() {
  const res = await apiFetch("/gdrive/oauth/start");
  return handleResponse(res);
}

export async function disconnectGdrive() {
  const res = await apiFetch("/gdrive/disconnect", { method: "POST" });
  return handleResponse(res);
}

export function buildGdriveThumbnailUrl(fileId, size = 600) {
  const token = getAuthToken();
  const params = new URLSearchParams({ s: String(size) });
  if (token) params.set("token", token);
  return `${BASE_URL}/gdrive/thumbnail/${encodeURIComponent(fileId)}?${params.toString()}`;
}
