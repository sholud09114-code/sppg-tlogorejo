import express from "express";
import {
  deleteReport,
  getWeeklySummary,
  importReportsBatch,
  listReports,
  previewReportImport,
  getReportByDate,
  saveReport,
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/", listReports);
router.get("/weekly-summary", getWeeklySummary);
router.post("/import/preview", previewReportImport);
router.post("/import", importReportsBatch);
router.get("/:date", getReportByDate);
router.post("/", saveReport);
router.delete("/:id", deleteReport);

export default router;
