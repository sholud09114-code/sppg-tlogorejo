import pool from "../config/db.js";
import { ensureMenuReportsTable } from "./menuReportController.js";
import { ensureFoodWasteTable } from "./foodWasteController.js";
import { ensureDailyReportDetailColumns } from "../modules/daily-reports/dailyReport.controller.js";

function getJakartaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildMenuText(row) {
  if (!row) return "";
  return [
    row.menu_name_1,
    row.menu_name_2,
    row.menu_name_3,
    row.menu_name_4,
    row.menu_name_5,
  ]
    .filter(Boolean)
    .join(", ") || row.menu_name || "";
}

export async function getHomeSummary(req, res, next) {
  try {
    await ensureDailyReportDetailColumns();
    await ensureMenuReportsTable();
    await ensureFoodWasteTable();

    const todayDate = getJakartaDateString();
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayDate = getJakartaDateString(yesterday);

    const [[dailyToday]] = await pool.query(
      `SELECT r.id,
              r.report_date,
              COALESCE(r.total_pm, 0) AS total_pm,
              COALESCE(SUM(d.actual_small_portion), 0) AS total_small_portion,
              COALESCE(SUM(d.actual_large_portion), 0) AS total_large_portion
         FROM daily_reports r
         LEFT JOIN daily_report_details d ON d.report_id = r.id
        WHERE r.report_date = ?
        GROUP BY r.id, r.report_date, r.total_pm
        ORDER BY r.report_date DESC, r.id DESC
        LIMIT 1`,
      [todayDate]
    );

    const [[menuToday]] = await pool.query(
      `SELECT id, menu_date, menu_name, menu_name_1, menu_name_2, menu_name_3, menu_name_4, menu_name_5
         FROM menu_reports
        WHERE menu_date = ?
        ORDER BY menu_date DESC, id DESC
        LIMIT 1`,
      [todayDate]
    );

    const [[foodWasteYesterday]] = await pool.query(
      `SELECT id, report_date, total_kg, menu_notes
         FROM food_waste_reports
        WHERE report_date = ?
        ORDER BY report_date DESC, id DESC
        LIMIT 1`,
      [yesterdayDate]
    );

    const dailyRow = dailyToday || null;
    const menuRow = menuToday || null;
    const foodWasteRow = foodWasteYesterday || null;

    res.json({
      today_date: todayDate,
      yesterday_date: yesterdayDate,
      has_any_data: Boolean(dailyRow || menuRow || foodWasteRow),
      daily_report: dailyRow
        ? {
            report_date: dailyRow.report_date,
            is_today: dailyRow.report_date === todayDate,
            total_pm: Number(dailyRow.total_pm || 0),
            total_small_portion: Number(dailyRow.total_small_portion || 0),
            total_large_portion: Number(dailyRow.total_large_portion || 0),
          }
        : null,
      menu_report: menuRow
        ? {
            report_date: menuRow.menu_date,
            is_today: true,
            menu_name: buildMenuText(menuRow),
          }
        : null,
      food_waste: foodWasteRow
        ? {
            report_date: foodWasteRow.report_date,
            target_date: yesterdayDate,
            is_yesterday: true,
            total_kg: Number(foodWasteRow.total_kg || 0),
            menu_notes: String(foodWasteRow.menu_notes || "").trim(),
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}
