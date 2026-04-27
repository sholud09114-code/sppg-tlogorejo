import { apiFetch, handleResponse } from "./apiClient.js";

let foodWasteReportsCache = null;
let foodWasteReportsRequest = null;

export function getCachedFoodWasteReports() {
  return foodWasteReportsCache;
}

export function invalidateFoodWasteReportsCache() {
  foodWasteReportsCache = null;
  foodWasteReportsRequest = null;
}

export async function fetchFoodWasteReports({ force = false } = {}) {
  if (!force && foodWasteReportsCache) {
    return foodWasteReportsCache;
  }

  if (!force && foodWasteReportsRequest) {
    return foodWasteReportsRequest;
  }

  foodWasteReportsRequest = apiFetch("/food-waste")
    .then((res) => handleResponse(res))
    .then((data) => {
      foodWasteReportsCache = data;
      foodWasteReportsRequest = null;
      return data;
    })
    .catch((error) => {
      foodWasteReportsRequest = null;
      throw error;
    });

  return foodWasteReportsRequest;
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
  const data = await handleResponse(res);
  invalidateFoodWasteReportsCache();
  return data;
}

export async function updateFoodWaste(id, payload) {
  const res = await apiFetch(`/food-waste/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  invalidateFoodWasteReportsCache();
  return data;
}

export async function deleteFoodWaste(id) {
  const res = await apiFetch(`/food-waste/${id}`, {
    method: "DELETE",
  });
  const data = await handleResponse(res);
  invalidateFoodWasteReportsCache();
  return data;
}

export async function fetchFoodWasteMenuReference(date) {
  const params = new URLSearchParams({ date });
  const res = await apiFetch(`/food-waste/menu-reference?${params.toString()}`);
  return handleResponse(res);
}
