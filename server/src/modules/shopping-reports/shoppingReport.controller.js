import {
  createShoppingReport as createShoppingReportService,
  deleteShoppingReport as deleteShoppingReportService,
  extractShoppingReportDraftFromImage,
  getShoppingReport,
  listShoppingReports as listShoppingReportsService,
  updateShoppingReport as updateShoppingReportService,
} from "./shoppingReport.service.js";

export async function listShoppingReports(req, res, next) {
  try {
    const rows = await listShoppingReportsService();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getShoppingReportById(req, res, next) {
  try {
    const report = await getShoppingReport(req.params.id);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function createShoppingReport(req, res, next) {
  try {
    const report = await createShoppingReportService(req.body, req.user?.id);
    res.status(201).json({ ok: true, message: "Shopping report created.", data: report });
  } catch (err) {
    next(err);
  }
}

export async function updateShoppingReport(req, res, next) {
  try {
    const report = await updateShoppingReportService(req.params.id, req.body, req.user?.id);
    res.json({ ok: true, message: "Shopping report updated.", data: report });
  } catch (err) {
    next(err);
  }
}

export async function deleteShoppingReport(req, res, next) {
  try {
    await deleteShoppingReportService(req.params.id, req.user?.id);
    res.json({ ok: true, message: "Shopping report deleted." });
  } catch (err) {
    next(err);
  }
}

export async function extractShoppingReportImage(req, res, next) {
  try {
    const draft = await extractShoppingReportDraftFromImage(req.file);
    res.json({
      ok: true,
      message: "Draft laporan belanja berhasil dibuat dari gambar.",
      draft,
    });
  } catch (err) {
    next(err);
  }
}
