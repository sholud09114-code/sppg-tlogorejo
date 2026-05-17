import express from "express";
import {
  generateWeeklyDocument,
  getReportSettingsHandler,
  updateReportSettingsHandler,
} from "./weeklyReport.controller.js";

const router = express.Router();

router.get("/document", generateWeeklyDocument);
router.get("/settings", getReportSettingsHandler);
router.put("/settings", updateReportSettingsHandler);

export default router;
