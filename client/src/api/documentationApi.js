import { apiFetch, handleResponse } from "./apiClient.js";
import { getAuthToken } from "../auth/tokenStorage.js";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export const PHOTO_TYPES = [
  { value: "menu_daily", label: "Menu Harian" },
  { value: "distribution", label: "Distribusi" },
  { value: "activity_other", label: "Kegiatan Lain" },
];

export const PHOTO_TYPE_LABEL = Object.fromEntries(
  PHOTO_TYPES.map((entry) => [entry.value, entry.label])
);

export async function listDocumentationPhotos({ photoType, startDate, endDate } = {}) {
  const params = new URLSearchParams();
  if (photoType) params.set("photo_type", photoType);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();
  const res = await apiFetch(`/documentation${qs ? `?${qs}` : ""}`);
  return handleResponse(res);
}

export async function uploadDocumentationPhoto({ photoType, photoDate, title, notes, file }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("photo_type", photoType);
  formData.append("photo_date", photoDate);
  if (title) formData.append("title", title);
  if (notes) formData.append("notes", notes);
  const res = await apiFetch("/documentation", { method: "POST", body: formData });
  return handleResponse(res);
}

export async function updateDocumentationPhoto(id, payload) {
  const res = await apiFetch(`/documentation/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteDocumentationPhoto(id) {
  const res = await apiFetch(`/documentation/${encodeURIComponent(id)}`, { method: "DELETE" });
  return handleResponse(res);
}

export function buildDocumentationThumbnailUrl(id, size = 600) {
  const token = getAuthToken();
  const params = new URLSearchParams({ s: String(size) });
  if (token) params.set("token", token);
  return `${BASE_URL}/documentation/${encodeURIComponent(id)}/thumbnail?${params.toString()}`;
}
