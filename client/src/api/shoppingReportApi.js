import { apiFetch, handleResponse } from "./apiClient.js";

export async function fetchShoppingReports() {
  const res = await apiFetch("/shopping-reports");
  return handleResponse(res);
}

export async function fetchShoppingReportById(id) {
  const res = await apiFetch(`/shopping-reports/${id}`);
  return handleResponse(res);
}

export async function createShoppingReport(payload) {
  const res = await apiFetch("/shopping-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function extractShoppingReportImage(payload) {
  const formData = new FormData();
  formData.append("image", payload.file);
  const res = await apiFetch("/shopping-reports/extract-image", {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

export async function updateShoppingReport(id, payload) {
  const res = await apiFetch(`/shopping-reports/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteShoppingReport(id) {
  const res = await apiFetch(`/shopping-reports/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function fetchItemMasters(activeOnly = false) {
  const params = new URLSearchParams();
  if (activeOnly) {
    params.set("active_only", "1");
  }
  const path = `/item-masters${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await apiFetch(path);
  return handleResponse(res);
}

export async function fetchItemMasterById(id) {
  const res = await apiFetch(`/item-masters/${id}`);
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

  const res = await apiFetch(`/item-masters/price-monitoring?${params.toString()}`);
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

  const res = await apiFetch(`/item-masters/price-increase-detection?${params.toString()}`);
  return handleResponse(res);
}

export async function createItemMaster(payload) {
  const res = await apiFetch("/item-masters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateItemMaster(id, payload) {
  const res = await apiFetch(`/item-masters/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteItemMaster(id) {
  const res = await apiFetch(`/item-masters/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}
