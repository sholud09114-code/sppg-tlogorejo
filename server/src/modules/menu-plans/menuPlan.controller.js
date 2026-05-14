import {
  createMenuPlan as createMenuPlanService,
  deleteMenuPlan as deleteMenuPlanService,
  extractMenuPlanDraftFromImage,
  getMenuPlan,
  getMenuPlanItemsByDate,
  listMenuPlans as listMenuPlansService,
  updateMenuPlan as updateMenuPlanService,
} from "./menuPlan.service.js";

function parseIntParam(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

export async function listMenuPlans(req, res, next) {
  try {
    const includeItems =
      req.query.include === "items" ||
      req.query.includeItems === "true" ||
      req.query.includeItems === "1";
    const rows = await listMenuPlansService({
      year: parseIntParam(req.query.year),
      month: parseIntParam(req.query.month),
      includeItems,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getMenuPlanById(req, res, next) {
  try {
    const plan = await getMenuPlan(req.params.id);
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

export async function getMenuPlanByDate(req, res, next) {
  try {
    const items = await getMenuPlanItemsByDate(req.params.date);
    res.json(items);
  } catch (err) {
    next(err);
  }
}

export async function createMenuPlan(req, res, next) {
  try {
    const plan = await createMenuPlanService(req.body, req.user?.id);
    res.status(201).json({
      ok: true,
      message: "Rencana menu berhasil dibuat.",
      data: plan,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMenuPlan(req, res, next) {
  try {
    const plan = await updateMenuPlanService(req.params.id, req.body, req.user?.id);
    res.json({
      ok: true,
      message: "Rencana menu berhasil diperbarui.",
      data: plan,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteMenuPlan(req, res, next) {
  try {
    await deleteMenuPlanService(req.params.id, req.user?.id);
    res.json({ ok: true, message: "Rencana menu berhasil dihapus." });
  } catch (err) {
    next(err);
  }
}


export async function extractMenuPlanImage(req, res, next) {
  try {
    const draft = await extractMenuPlanDraftFromImage(req.file);
    res.json({
      ok: true,
      message: "Draft rencana menu berhasil dibuat dari gambar.",
      draft,
    });
  } catch (err) {
    next(err);
  }
}
