import { apiFetch, handleResponse } from "./apiClient.js";
import { invalidateUnitsCache } from "./dailyReportApi.js";

let beneficiaryGroupsCache = null;
let beneficiaryGroupsRequest = null;

export function getCachedBeneficiaryGroups() {
  return beneficiaryGroupsCache;
}

export function invalidateBeneficiaryGroupsCache() {
  beneficiaryGroupsCache = null;
  beneficiaryGroupsRequest = null;
}

export async function fetchBeneficiaryGroups({ force = false } = {}) {
  if (!force && beneficiaryGroupsCache) {
    return beneficiaryGroupsCache;
  }

  if (!force && beneficiaryGroupsRequest) {
    return beneficiaryGroupsRequest;
  }

  beneficiaryGroupsRequest = apiFetch("/beneficiary-groups")
    .then((res) => handleResponse(res))
    .then((data) => {
      beneficiaryGroupsCache = data;
      beneficiaryGroupsRequest = null;
      return data;
    })
    .catch((error) => {
      beneficiaryGroupsRequest = null;
      throw error;
    });

  return beneficiaryGroupsRequest;
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
  invalidateBeneficiaryGroupsCache();
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
  invalidateBeneficiaryGroupsCache();
  invalidateUnitsCache();
  return data;
}

export async function deleteBeneficiaryGroup(id) {
  const res = await apiFetch(`/beneficiary-groups/${id}`, {
    method: "DELETE",
  });
  const data = await handleResponse(res);
  invalidateBeneficiaryGroupsCache();
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
  invalidateBeneficiaryGroupsCache();
  invalidateUnitsCache();
  return data;
}
