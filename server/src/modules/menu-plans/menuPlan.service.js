import {
  deleteMenuPlanById,
  ensureMenuPlansTables,
  findMenuPlanById,
  findMenuPlanByYearMonthWeek,
  findMenuPlanItemsByDate,
  findMenuPlanItemsByPlanId,
  findMenuPlanItemsByPlanIds,
  insertMenuPlanWithItems,
  listMenuPlanRows,
  updateMenuPlanWithItems,
} from "./menuPlan.repository.js";
import { normalizeMenuPlanPayload, parseMenuPlanId } from "./menuPlan.validators.js";
import { recordAuditLog } from "../../services/auditLogService.js";
import {
  MENU_PLAN_IMAGE_MIME_TYPES,
  requestMenuPlanDraftFromAi,
} from "./menuPlan.ai.js";

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireMenuPlanId(value) {
  const id = parseMenuPlanId(value);
  if (!id) {
    throw createHttpError("ID rencana menu tidak valid.", 400);
  }
  return id;
}

function requireMenuPlanPayload(body) {
  const { payload, error } = normalizeMenuPlanPayload(body || {});
  if (error) {
    throw createHttpError(`Data rencana menu tidak valid: ${error}`, 400);
  }
  if (payload.start_date > payload.end_date) {
    throw createHttpError("Tanggal mulai tidak boleh setelah tanggal selesai.", 400);
  }
  return payload;
}

function toIsoDateString(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof value === "string") {
    return value.length >= 10 ? value.slice(0, 10) : value;
  }
  return String(value);
}

function serializeMenuPlanRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    week_number: row.week_number,
    start_date: toIsoDateString(row.start_date),
    end_date: toIsoDateString(row.end_date),
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeMenuPlanItem(item) {
  return {
    id: item.id,
    plan_id: item.plan_id,
    plan_date: toIsoDateString(item.plan_date),
    day_of_week: item.day_of_week,
    category: item.category,
    menu_name: item.menu_name,
    portion_target: item.portion_target,
    is_holiday: Boolean(item.is_holiday),
    sort_order: item.sort_order,
  };
}

export async function listMenuPlans(filter = {}) {
  await ensureMenuPlansTables();
  const rows = await listMenuPlanRows(filter);
  const includeItems = Boolean(filter?.includeItems);
  if (!includeItems) {
    return rows.map(serializeMenuPlanRow);
  }
  if (rows.length === 0) return [];
  const planIds = rows.map((row) => row.id);
  const items = await findMenuPlanItemsByPlanIds(planIds);
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.plan_id)) grouped.set(item.plan_id, []);
    grouped.get(item.plan_id).push(serializeMenuPlanItem(item));
  }
  return rows.map((row) => ({
    ...serializeMenuPlanRow(row),
    items: grouped.get(row.id) || [],
  }));
}

export async function getMenuPlan(idValue) {
  const id = requireMenuPlanId(idValue);
  const row = await findMenuPlanById(id);
  if (!row) {
    throw createHttpError("Rencana menu tidak ditemukan.", 404);
  }
  const items = await findMenuPlanItemsByPlanId(id);
  return {
    ...serializeMenuPlanRow(row),
    items: items.map(serializeMenuPlanItem),
  };
}

export async function getMenuPlanItemsByDate(planDate) {
  if (typeof planDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(planDate)) {
    throw createHttpError("Format tanggal harus YYYY-MM-DD.", 400);
  }
  await ensureMenuPlansTables();
  const items = await findMenuPlanItemsByDate(planDate);
  return items.map(serializeMenuPlanItem);
}

async function ensureUniqueWeek(payload, excludeId = null) {
  const existing = await findMenuPlanByYearMonthWeek(
    payload.year,
    payload.month,
    payload.week_number
  );
  if (existing && existing.id !== excludeId) {
    throw createHttpError(
      `Rencana menu untuk minggu ke-${payload.week_number} bulan ${payload.month}/${payload.year} sudah ada.`,
      409
    );
  }
}

export async function createMenuPlan(body, userId) {
  const payload = requireMenuPlanPayload(body);
  await ensureUniqueWeek(payload);
  const planId = await insertMenuPlanWithItems(payload, payload.items);
  const created = await getMenuPlan(planId);
  await recordAuditLog({
    userId,
    action: "CREATE",
    entityType: "menu_plan",
    entityId: planId,
    newData: created,
  });
  return created;
}

export async function updateMenuPlan(idValue, body, userId) {
  const id = requireMenuPlanId(idValue);
  const existing = await findMenuPlanById(id);
  if (!existing) {
    throw createHttpError("Rencana menu tidak ditemukan.", 404);
  }
  const payload = requireMenuPlanPayload(body);
  await ensureUniqueWeek(payload, id);
  const previousItems = await findMenuPlanItemsByPlanId(id);
  await updateMenuPlanWithItems(id, payload, payload.items);
  const updated = await getMenuPlan(id);
  await recordAuditLog({
    userId,
    action: "UPDATE",
    entityType: "menu_plan",
    entityId: id,
    oldData: {
      ...serializeMenuPlanRow(existing),
      items: previousItems.map(serializeMenuPlanItem),
    },
    newData: updated,
  });
  return updated;
}

export async function deleteMenuPlan(idValue, userId) {
  const id = requireMenuPlanId(idValue);
  const existing = await findMenuPlanById(id);
  if (!existing) {
    throw createHttpError("Rencana menu tidak ditemukan.", 404);
  }
  const previousItems = await findMenuPlanItemsByPlanId(id);
  await deleteMenuPlanById(id);
  await recordAuditLog({
    userId,
    action: "DELETE",
    entityType: "menu_plan",
    entityId: id,
    oldData: {
      ...serializeMenuPlanRow(existing),
      items: previousItems.map(serializeMenuPlanItem),
    },
  });
}


export async function extractMenuPlanDraftFromImage(file) {
  if (!file) {
    throw createHttpError("File gambar wajib diunggah.", 400);
  }
  const mimeType = String(file.mimetype || "").toLowerCase().trim();
  const fileName = String(file.originalname || "").trim();
  if (!MENU_PLAN_IMAGE_MIME_TYPES.has(mimeType)) {
    throw createHttpError(
      "Format file tidak didukung. Gunakan jpg, jpeg, png, atau webp.",
      400
    );
  }
  return requestMenuPlanDraftFromAi({
    buffer: file.buffer,
    mimeType,
    fileName,
  });
}
