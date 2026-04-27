import { apiFetch, handleResponse } from "./apiClient.js";

let unitsCache = null;
let unitsRequest = null;
const reportListCache = new Map();
const reportListRequests = new Map();

export function invalidateUnitsCache() {
  unitsCache = null;
  unitsRequest = null;
}

export function getCachedReportList(limit = 30) {
  return reportListCache.get(String(limit)) || null;
}

export function invalidateReportListCache() {
  reportListCache.clear();
  reportListRequests.clear();
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
  const data = await handleResponse(res);
  invalidateReportListCache();
  return data;
}

export async function saveReport(payload) {
  const res = await apiFetch("/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  invalidateReportListCache();
  return data;
}

export async function deleteReport(id) {
  const res = await apiFetch(`/reports/${id}`, {
    method: "DELETE",
  });
  const data = await handleResponse(res);
  invalidateReportListCache();
  return data;
}

export async function listReports(limit = 30, { force = false } = {}) {
  const cacheKey = String(limit);
  if (!force && reportListCache.has(cacheKey)) {
    return reportListCache.get(cacheKey);
  }

  if (!force && reportListRequests.has(cacheKey)) {
    return reportListRequests.get(cacheKey);
  }

  const request = apiFetch(`/reports?limit=${limit}`)
    .then((res) => handleResponse(res))
    .then((data) => {
      reportListCache.set(cacheKey, data);
      reportListRequests.delete(cacheKey);
      return data;
    })
    .catch((error) => {
      reportListRequests.delete(cacheKey);
      throw error;
    });

  reportListRequests.set(cacheKey, request);
  return request;
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
