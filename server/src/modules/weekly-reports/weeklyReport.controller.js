import {
  collectWeeklyReportData,
} from "./weeklyReport.repository.js";
import {
  buildDocxFilename,
  buildWeeklyReportDocx,
} from "./weeklyReportDocx.js";
import {
  ensureReportSettingsTable,
  getReportSettings,
  updateReportSettings,
} from "./reportSettings.repository.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function getReportSettingsHandler(req, res, next) {
  try {
    const settings = await getReportSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

export async function updateReportSettingsHandler(req, res, next) {
  try {
    const settings = await updateReportSettings(req.body || {});
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

export async function generateWeeklyDocument(req, res, next) {
  try {
    const startDate = String(req.query.start_date || "").trim();
    const endDate = String(req.query.end_date || "").trim();

    if (!startDate || !DATE_REGEX.test(startDate)) {
      return res.status(400).json({
        error: "Query 'start_date' wajib diisi dengan format YYYY-MM-DD.",
      });
    }
    if (!endDate || !DATE_REGEX.test(endDate)) {
      return res.status(400).json({
        error: "Query 'end_date' wajib diisi dengan format YYYY-MM-DD.",
      });
    }
    if (endDate < startDate) {
      return res.status(400).json({
        error: "Query 'end_date' tidak boleh lebih kecil dari 'start_date'.",
      });
    }

    await ensureReportSettingsTable();
    const [settings, data] = await Promise.all([
      getReportSettings(),
      collectWeeklyReportData({ startDate, endDate }),
    ]);

    const { buffer, periodLabel } = await buildWeeklyReportDocx({ data, settings });
    const filename = buildDocxFilename(periodLabel, settings);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"`
    );
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
  } catch (err) {
    next(err);
  }
}
