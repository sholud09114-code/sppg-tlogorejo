import { apiFetch, handleResponse } from "./apiClient.js";

export async function fetchFoodWasteReports() {
  const res = await apiFetch("/food-waste");
  return handleResponse(res);
}

export async function fetchFoodWasteById(id) {
  const res = await apiFetch(`/food-waste/${id}`);
  return handleResponse(res);
}

export async function createFoodWaste(payload) {
  const res = await apiFetch("/food-waste", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateFoodWaste(id, payload) {
  const res = await apiFetch(`/food-waste/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteFoodWaste(id) {
  const res = await apiFetch(`/food-waste/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function fetchFoodWasteMenuReference(date) {
  const params = new URLSearchParams({ date });
  const res = await apiFetch(`/food-waste/menu-reference?${params.toString()}`);
  return handleResponse(res);
}
