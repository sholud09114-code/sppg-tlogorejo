import { apiFetch, handleResponse } from "./apiClient.js";

let menuReportsCache = null;
let menuReportsRequest = null;

export function getCachedMenuReports() {
  return menuReportsCache;
}

export function invalidateMenuReportsCache() {
  menuReportsCache = null;
  menuReportsRequest = null;
}

export async function fetchMenuReports({ force = false } = {}) {
  if (!force && menuReportsCache) {
    return menuReportsCache;
  }

  if (!force && menuReportsRequest) {
    return menuReportsRequest;
  }

  menuReportsRequest = apiFetch("/menu-reports")
    .then((res) => handleResponse(res))
    .then((data) => {
      menuReportsCache = data;
      menuReportsRequest = null;
      return data;
    })
    .catch((error) => {
      menuReportsRequest = null;
      throw error;
    });

  return menuReportsRequest;
}

export async function fetchMenuReportById(id) {
  const res = await apiFetch(`/menu-reports/${id}`);
  return handleResponse(res);
}

export async function createMenuReport(payload) {
  const res = await apiFetch("/menu-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  invalidateMenuReportsCache();
  return data;
}

export async function updateMenuReport(id, payload) {
  const res = await apiFetch(`/menu-reports/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  invalidateMenuReportsCache();
  return data;
}

export async function deleteMenuReport(id) {
  const res = await apiFetch(`/menu-reports/${id}`, {
    method: "DELETE",
  });
  const data = await handleResponse(res);
  invalidateMenuReportsCache();
  return data;
}

export async function extractMenuReportImage(payload) {
  const formData = new FormData();
  formData.append("image", payload.file);
  const res = await apiFetch("/menu-reports/extract-image", {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}
