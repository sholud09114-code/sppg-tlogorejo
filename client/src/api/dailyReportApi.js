import { apiFetch, handleResponse } from "./apiClient.js";

let unitsCache = null;
let unitsRequest = null;

export function invalidateUnitsCache() {
  unitsCache = null;
  unitsRequest = null;
}

export async function fetchUnits() {
  if (unitsCache) {
    return unitsCache;
  }

  if (!unitsRequest) {
    unitsRequest = apiFetch("/units")
      .then((res) => handleResponse(res))
      .then((data) => {
        unitsCache = data;
        unitsRequest = null;
        return data;
      })
      .catch((error) => {
        unitsRequest = null;
        throw error;
      });
  }

  return unitsRequest;
}

export async function fetchHomeSummary() {
  const res = await apiFetch("/home/summary");
  return handleResponse(res);
}

export async function fetchReportByDate(date) {
  const res = await apiFetch(`/reports/${date}`);
  return handleResponse(res);
}

export async function previewReportImport(payload) {
  const res = await apiFetch("/reports/import/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function importReportsBatch(payload) {
  const res = await apiFetch("/reports/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function saveReport(payload) {
  const res = await apiFetch("/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteReport(id) {
  const res = await apiFetch(`/reports/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function listReports(limit = 30) {
  const res = await apiFetch(`/reports?limit=${limit}`);
  return handleResponse(res);
}

export async function fetchReportsForPrint(dateFrom, dateTo) {
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
    include_details: "1",
  });
  const res = await apiFetch(`/reports?${params.toString()}`);
  return handleResponse(res);
}

export async function fetchWeeklySummary(startDate, endDate) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  const res = await apiFetch(`/reports/weekly-summary?${params.toString()}`);
  return handleResponse(res);
}
