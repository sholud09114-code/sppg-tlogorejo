import { apiFetch, handleResponse } from "./apiClient.js";

let menuPlansCache = new Map();
let menuPlansRequest = new Map();

export function getCachedMenuPlans(filter = {}) {
  return menuPlansCache.get(buildCacheKey(filter)) || null;
}

export function invalidateMenuPlansCache() {
  menuPlansCache = new Map();
  menuPlansRequest = new Map();
}

function buildCacheKey({ year, month, includeItems } = {}) {
  return JSON.stringify({
    year: year ?? null,
    month: month ?? null,
    includeItems: Boolean(includeItems),
  });
}

export async function fetchMenuPlans({
  force = false,
  year,
  month,
  includeItems = false,
} = {}) {
  const filter = { year, month, includeItems };
  const key = buildCacheKey(filter);

  if (!force && menuPlansCache.has(key)) {
    return menuPlansCache.get(key);
  }

  if (!force && menuPlansRequest.has(key)) {
    return menuPlansRequest.get(key);
  }

  const params = new URLSearchParams();
  if (year != null && year !== "") params.set("year", year);
  if (month != null && month !== "") params.set("month", month);
  if (includeItems) params.set("include", "items");
  const query = params.toString();
  const url = query ? `/menu-plans?${query}` : "/menu-plans";

  const promise = apiFetch(url)
    .then((res) => handleResponse(res))
    .then((data) => {
      menuPlansCache.set(key, data);
      menuPlansRequest.delete(key);
      return data;
    })
    .catch((error) => {
      menuPlansRequest.delete(key);
      throw error;
    });

  menuPlansRequest.set(key, promise);
  return promise;
}

export async function fetchMenuPlanById(id) {
  const res = await apiFetch(`/menu-plans/${id}`);
  return handleResponse(res);
}

export async function fetchMenuPlanByDate(date) {
  const res = await apiFetch(`/menu-plans/by-date/${date}`);
  return handleResponse(res);
}

export async function createMenuPlan(payload) {
  const res = await apiFetch("/menu-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  invalidateMenuPlansCache();
  return data;
}

export async function updateMenuPlan(id, payload) {
  const res = await apiFetch(`/menu-plans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  invalidateMenuPlansCache();
  return data;
}

export async function deleteMenuPlan(id) {
  const res = await apiFetch(`/menu-plans/${id}`, { method: "DELETE" });
  const data = await handleResponse(res);
  invalidateMenuPlansCache();
  return data;
}

export async function extractMenuPlanImage(payload) {
  const formData = new FormData();
  formData.append("image", payload.file);
  const res = await apiFetch("/menu-plans/extract-image", {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
  return handleResponse(res);
}
