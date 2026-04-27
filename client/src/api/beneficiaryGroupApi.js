import { apiFetch, handleResponse } from "./apiClient.js";
import { invalidateUnitsCache } from "./dailyReportApi.js";

export async function fetchBeneficiaryGroups() {
  const res = await apiFetch("/beneficiary-groups");
  return handleResponse(res);
}

export async function fetchBeneficiaryGroupById(id) {
  const res = await apiFetch(`/beneficiary-groups/${id}`);
  return handleResponse(res);
}

export async function createBeneficiaryGroup(payload) {
  const res = await apiFetch("/beneficiary-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  invalidateUnitsCache();
  return data;
}

export async function updateBeneficiaryGroup(id, payload) {
  const res = await apiFetch(`/beneficiary-groups/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  invalidateUnitsCache();
  return data;
}

export async function deleteBeneficiaryGroup(id) {
  const res = await apiFetch(`/beneficiary-groups/${id}`, {
    method: "DELETE",
  });
  const data = await handleResponse(res);
  invalidateUnitsCache();
  return data;
}

export async function previewBeneficiaryGroupImport(payload) {
  const res = await apiFetch("/beneficiary-groups/import/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function importBeneficiaryGroups(payload) {
  const res = await apiFetch("/beneficiary-groups/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  invalidateUnitsCache();
  return data;
}
