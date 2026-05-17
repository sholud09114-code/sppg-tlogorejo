import { apiFetch, handleResponse } from "./apiClient.js";
import { getAuthToken } from "../auth/tokenStorage.js";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export async function generateReportDraft({ startDate, endDate, title }) {
  const res = await apiFetch("/report-drafts/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_date: startDate,
      end_date: endDate,
      title,
    }),
  });
  return handleResponse(res);
}

export async function listReportDrafts() {
  const res = await apiFetch("/report-drafts");
  return handleResponse(res);
}

export async function fetchReportDraft(id) {
  const res = await apiFetch(`/report-drafts/${encodeURIComponent(id)}`);
  return handleResponse(res);
}

export async function updateReportDraft(id, payload) {
  const res = await apiFetch(`/report-drafts/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteReportDraft(id) {
  const res = await apiFetch(`/report-drafts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function uploadReportPhoto({ id, section, file, extra = {} }) {
  const formData = new FormData();
  formData.append("file", file);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  }

  const res = await apiFetch(
    `/report-drafts/${encodeURIComponent(id)}/photos/${encodeURIComponent(section)}`,
    {
      method: "POST",
      body: formData,
    }
  );
  return handleResponse(res);
}

export async function deleteReportPhoto({ id, section, filename }) {
  const res = await apiFetch(
    `/report-drafts/${encodeURIComponent(id)}/photos/${encodeURIComponent(section)}/${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );
  return handleResponse(res);
}

export async function generateReportPdf(id) {
  const res = await apiFetch(`/report-drafts/${encodeURIComponent(id)}/pdf`, {
    method: "POST",
  });
  return handleResponse(res);
}

export async function downloadReportPdf({ id, file }) {
  const res = await apiFetch(
    `/report-drafts/${encodeURIComponent(id)}/pdf?file=${encodeURIComponent(file)}`
  );
  if (!res.ok) {
    const message = await res
      .clone()
      .json()
      .then((data) => data?.error || `Gagal mengunduh PDF (${res.status})`)
      .catch(() => `Gagal mengunduh PDF (${res.status})`);
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function buildPhotoSrc({ id, section, filename }) {
  if (!filename) return "";
  const path = `/report-drafts/${encodeURIComponent(id)}/photos/${encodeURIComponent(section)}/${encodeURIComponent(filename)}`;
  const token = getAuthToken();
  return token ? `${BASE_URL}${path}?token=${encodeURIComponent(token)}` : `${BASE_URL}${path}`;
}
