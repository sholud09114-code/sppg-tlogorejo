import { apiFetch, handleResponse } from "./apiClient.js";

export async function fetchMenuReports() {
  const res = await apiFetch("/menu-reports");
  return handleResponse(res);
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
  return handleResponse(res);
}

export async function updateMenuReport(id, payload) {
  const res = await apiFetch(`/menu-reports/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteMenuReport(id) {
  const res = await apiFetch(`/menu-reports/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
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
