import { z } from "zod";

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const MENU_CATEGORIES = [
  "karbohidrat",
  "protein_hewani",
  "protein_nabati",
  "sayur",
  "buah",
];

export const PORTION_TARGETS = ["all", "PMB", "PMK"];

const menuPlanItemSchema = z.object({
  plan_date: z.string().regex(DATE_REGEX),
  day_of_week: z.number().int().min(1).max(7),
  category: z.enum(MENU_CATEGORIES),
  menu_name: z.string().trim().max(200),
  portion_target: z.enum(PORTION_TARGETS).default("all"),
  is_holiday: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(127).default(0),
});

const menuPlanPayloadSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  week_number: z.number().int().min(1).max(6),
  start_date: z.string().regex(DATE_REGEX),
  end_date: z.string().regex(DATE_REGEX),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(menuPlanItemSchema).max(120).default([]),
});

function toIntOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function normalizeItem(raw) {
  const planDate = typeof raw.plan_date === "string" ? raw.plan_date.trim() : "";
  const category = typeof raw.category === "string" ? raw.category.trim().toLowerCase() : "";
  const portion =
    typeof raw.portion_target === "string"
      ? raw.portion_target.trim().toUpperCase()
      : "all";
  return {
    plan_date: planDate,
    day_of_week: toIntOrUndefined(raw.day_of_week),
    category,
    menu_name: typeof raw.menu_name === "string" ? raw.menu_name.trim() : "",
    portion_target: portion === "PMB" || portion === "PMK" ? portion : "all",
    is_holiday: Boolean(raw.is_holiday),
    sort_order: toIntOrUndefined(raw.sort_order) ?? 0,
  };
}

export function normalizeMenuPlanPayload(body) {
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const normalizedItems = rawItems
    .map(normalizeItem)
    .filter((item) => item.menu_name.length > 0 || item.is_holiday);

  const payload = {
    year: toIntOrUndefined(body?.year),
    month: toIntOrUndefined(body?.month),
    week_number: toIntOrUndefined(body?.week_number),
    start_date: typeof body?.start_date === "string" ? body.start_date.trim() : "",
    end_date: typeof body?.end_date === "string" ? body.end_date.trim() : "",
    notes:
      typeof body?.notes === "string"
        ? body.notes.trim() || null
        : body?.notes == null
          ? null
          : String(body.notes),
    items: normalizedItems,
  };

  const result = menuPlanPayloadSchema.safeParse(payload);
  if (!result.success) {
    return { error: result.error.issues.map((issue) => issue.message).join("; ") };
  }
  return { payload: result.data };
}

export function parseMenuPlanId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
