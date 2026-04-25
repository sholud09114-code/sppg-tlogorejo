import { clearAuthToken, getAuthToken } from "../auth/tokenStorage.js";

const BASE_URL = "/api";

function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

async function handleResponse(res) {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearAuthToken();
      window.dispatchEvent(new Event("sppg-auth-expired"));
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchUnits() {
  const res = await apiFetch(`${BASE_URL}/units`);
  return handleResponse(res);
}

export async function fetchHomeSummary() {
  const res = await apiFetch(`${BASE_URL}/home/summary`);
  return handleResponse(res);
}

export async function fetchReportByDate(date) {
  const res = await apiFetch(`${BASE_URL}/reports/${date}`);
  return handleResponse(res);
}

export async function previewReportImport(payload) {
  const res = await apiFetch(`${BASE_URL}/reports/import/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function importReportsBatch(payload) {
  const res = await apiFetch(`${BASE_URL}/reports/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function saveReport(payload) {
  const res = await apiFetch(`${BASE_URL}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteReport(id) {
  const res = await apiFetch(`${BASE_URL}/reports/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function listReports(limit = 30) {
  const res = await apiFetch(`${BASE_URL}/reports?limit=${limit}`);
  return handleResponse(res);
}

export async function fetchReportsForPrint(dateFrom, dateTo) {
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
    include_details: "1",
  });
  const res = await apiFetch(`${BASE_URL}/reports?${params.toString()}`);
  return handleResponse(res);
}

export async function fetchWeeklySummary(startDate, endDate) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  const res = await apiFetch(`${BASE_URL}/reports/weekly-summary?${params.toString()}`);
  return handleResponse(res);
}

export async function fetchBeneficiaryGroups() {
  const res = await apiFetch(`${BASE_URL}/beneficiary-groups`);
  return handleResponse(res);
}

export async function fetchBeneficiaryGroupById(id) {
  const res = await apiFetch(`${BASE_URL}/beneficiary-groups/${id}`);
  return handleResponse(res);
}

export async function createBeneficiaryGroup(payload) {
  const res = await apiFetch(`${BASE_URL}/beneficiary-groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateBeneficiaryGroup(id, payload) {
  const res = await apiFetch(`${BASE_URL}/beneficiary-groups/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteBeneficiaryGroup(id) {
  const res = await apiFetch(`${BASE_URL}/beneficiary-groups/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function previewBeneficiaryGroupImport(payload) {
  const res = await apiFetch(`${BASE_URL}/beneficiary-groups/import/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function importBeneficiaryGroups(payload) {
  const res = await apiFetch(`${BASE_URL}/beneficiary-groups/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function fetchMenuReports() {
  const res = await apiFetch(`${BASE_URL}/menu-reports`);
  return handleResponse(res);
}

export async function fetchMenuReportById(id) {
  const res = await apiFetch(`${BASE_URL}/menu-reports/${id}`);
  return handleResponse(res);
}

export async function createMenuReport(payload) {
  const res = await apiFetch(`${BASE_URL}/menu-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateMenuReport(id, payload) {
  const res = await apiFetch(`${BASE_URL}/menu-reports/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteMenuReport(id) {
  const res = await apiFetch(`${BASE_URL}/menu-reports/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function extractMenuReportImage(payload) {
  const formData = new FormData();
  formData.append("image", payload.file);
  const res = await apiFetch(`${BASE_URL}/menu-reports/extract-image`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

export async function fetchShoppingReports() {
  const res = await apiFetch(`${BASE_URL}/shopping-reports`);
  return handleResponse(res);
}

export async function fetchShoppingReportById(id) {
  const res = await apiFetch(`${BASE_URL}/shopping-reports/${id}`);
  return handleResponse(res);
}

export async function createShoppingReport(payload) {
  const res = await apiFetch(`${BASE_URL}/shopping-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function extractShoppingReportImage(payload) {
  const formData = new FormData();
  formData.append("image", payload.file);
  const res = await apiFetch(`${BASE_URL}/shopping-reports/extract-image`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

export async function updateShoppingReport(id, payload) {
  const res = await apiFetch(`${BASE_URL}/shopping-reports/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteShoppingReport(id) {
  const res = await apiFetch(`${BASE_URL}/shopping-reports/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function fetchFoodWasteReports() {
  const res = await apiFetch(`${BASE_URL}/food-waste`);
  return handleResponse(res);
}

export async function fetchFoodWasteById(id) {
  const res = await apiFetch(`${BASE_URL}/food-waste/${id}`);
  return handleResponse(res);
}

export async function createFoodWaste(payload) {
  const res = await apiFetch(`${BASE_URL}/food-waste`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateFoodWaste(id, payload) {
  const res = await apiFetch(`${BASE_URL}/food-waste/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteFoodWaste(id) {
  const res = await apiFetch(`${BASE_URL}/food-waste/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function fetchFoodWasteMenuReference(date) {
  const params = new URLSearchParams({ date });
  const res = await apiFetch(`${BASE_URL}/food-waste/menu-reference?${params.toString()}`);
  return handleResponse(res);
}

export async function fetchItemMasters(activeOnly = false) {
  const params = new URLSearchParams();
  if (activeOnly) {
    params.set("active_only", "1");
  }
  const url = `${BASE_URL}/item-masters${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await apiFetch(url);
  return handleResponse(res);
}

export async function fetchItemMasterById(id) {
  const res = await apiFetch(`${BASE_URL}/item-masters/${id}`);
  return handleResponse(res);
}

export async function fetchItemPriceMonitoring({
  itemId,
  itemCode,
  itemName,
  startDate,
  endDate,
}) {
  const normalizedItemCode = String(itemCode || "").trim();
  const normalizedItemName = String(itemName || "").trim();
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });

  if (itemId) {
    params.set("item_id", String(itemId));
  } else if (normalizedItemCode && normalizedItemCode !== "-") {
    params.set("item_code", normalizedItemCode);
  } else if (normalizedItemName) {
    params.set("item_name", normalizedItemName);
  }

  const res = await apiFetch(`${BASE_URL}/item-masters/price-monitoring?${params.toString()}`);
  return handleResponse(res);
}

export async function fetchPriceIncreaseDetection({
  reportDate,
  onlyIncreased = false,
  minPercentIncrease = "",
}) {
  const params = new URLSearchParams({
    report_date: reportDate,
  });

  if (onlyIncreased) {
    params.set("only_increased", "1");
  }

  if (minPercentIncrease !== "" && minPercentIncrease != null) {
    params.set("min_percent_increase", String(minPercentIncrease));
  }

  const res = await apiFetch(`${BASE_URL}/item-masters/price-increase-detection?${params.toString()}`);
  return handleResponse(res);
}

export async function createItemMaster(payload) {
  const res = await apiFetch(`${BASE_URL}/item-masters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateItemMaster(id, payload) {
  const res = await apiFetch(`${BASE_URL}/item-masters/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteItemMaster(id) {
  const res = await apiFetch(`${BASE_URL}/item-masters/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}
