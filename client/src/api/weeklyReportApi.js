import { apiFetch, handleResponse } from "./apiClient.js";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export async function fetchReportSettings() {
  const res = await apiFetch("/weekly-reports/settings");
  return handleResponse(res);
}

export async function updateReportSettings(payload) {
  const res = await apiFetch("/weekly-reports/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export function buildWeeklyDocumentUrl(startDate, endDate) {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  return `${BASE_URL}/weekly-reports/document?${params.toString()}`;
}

export async function downloadWeeklyDocument(startDate, endDate) {
  const res = await apiFetch(`/weekly-reports/document?start_date=${startDate}&end_date=${endDate}`);
  if (!res.ok) {
    const message = await res
      .clone()
      .json()
      .then((data) => data?.error || `Gagal mengunduh laporan (${res.status})`)
      .catch(() => `Gagal mengunduh laporan (${res.status})`);
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const fallbackName = `Laporan Mingguan ${startDate} ${endDate}.docx`;
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { filename };
}
