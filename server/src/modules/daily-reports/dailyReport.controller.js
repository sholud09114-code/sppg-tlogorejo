import pool from "../../config/db.js";
import { syncBeneficiaryGroupsToUnits } from "../../utils/beneficiaryGroupSync.js";
import XLSX from "xlsx";

const VALID_STATUS = ["penuh", "libur", "sebagian"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY_NORMALIZATION = {
  "Paud/KB/TK": "PAUD/TK/KB",
  "PAUD/TK/KB": "PAUD/TK/KB",
  SD: "SD",
  "SMP/MTs": "SMP",
  SMP: "SMP",
  SMK: "SMK",
};
const MONTH_MAP = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};
let ensureDailyReportColumnsPromise;

function isValidDate(value) {
  return DATE_REGEX.test(value || "");
}

export function ensureDailyReportDetailColumns() {
  if (!ensureDailyReportColumnsPromise) {
    ensureDailyReportColumnsPromise = (async () => {
      await pool.query(
        `ALTER TABLE daily_report_details
           ADD COLUMN actual_small_portion INT NOT NULL DEFAULT 0 AFTER actual_pm,
           ADD COLUMN actual_large_portion INT NOT NULL DEFAULT 0 AFTER actual_small_portion`
      ).catch(async () => {
        const [smallRows] = await pool.query(
          `SHOW COLUMNS FROM daily_report_details LIKE 'actual_small_portion'`
        );
        if (smallRows.length === 0) {
          await pool.query(
            `ALTER TABLE daily_report_details
               ADD COLUMN actual_small_portion INT NOT NULL DEFAULT 0 AFTER actual_pm`
          );
        }

        const [largeRows] = await pool.query(
          `SHOW COLUMNS FROM daily_report_details LIKE 'actual_large_portion'`
        );
        if (largeRows.length === 0) {
          await pool.query(
            `ALTER TABLE daily_report_details
               ADD COLUMN actual_large_portion INT NOT NULL DEFAULT 0 AFTER actual_small_portion`
          );
        }
      });
    })().catch((err) => {
      ensureDailyReportColumnsPromise = null;
      throw err;
    });
  }

  return ensureDailyReportColumnsPromise;
}

function normalizeCategory(value) {
  return CATEGORY_NORMALIZATION[String(value || "").trim()] || String(value || "").trim();
}

function splitActualPortions(actualPm, smallTarget, largeTarget) {
  const totalTarget = Number(smallTarget || 0) + Number(largeTarget || 0);
  const totalActual = Number(actualPm || 0);

  if (totalActual <= 0 || totalTarget <= 0) {
    return { actualSmall: 0, actualLarge: 0 };
  }

  if (Number(smallTarget || 0) <= 0) {
    return { actualSmall: 0, actualLarge: totalActual };
  }

  if (Number(largeTarget || 0) <= 0) {
    return { actualSmall: totalActual, actualLarge: 0 };
  }

  const rawSmall = (Number(smallTarget || 0) / totalTarget) * totalActual;
  let actualSmall = Math.round(rawSmall);
  actualSmall = Math.max(0, Math.min(actualSmall, totalActual, Number(smallTarget || 0)));
  let actualLarge = totalActual - actualSmall;

  if (actualLarge > Number(largeTarget || 0)) {
    actualLarge = Number(largeTarget || 0);
    actualSmall = totalActual - actualLarge;
  }

  return {
    actualSmall: actualSmall,
    actualLarge: actualLarge,
  };
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "_");
}

function normalizePmNumber(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.replaceAll(/\s+/g, "").replaceAll(".", "").replaceAll(",", "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function createCategoryTotals() {
  return {
    "PAUD/TK/KB": 0,
    SD: 0,
    SMP: 0,
    SMK: 0,
  };
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function normalizeImportedDate(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${padNumber(parsed.m)}-${padNumber(parsed.d)}`;
    }
  }

  const raw = String(value).trim();
  if (!raw) return "";
  if (DATE_REGEX.test(raw)) return raw;

  if (/^\d+$/.test(raw)) {
    const parsed = XLSX.SSF.parse_date_code(Number(raw));
    if (parsed) {
      return `${parsed.y}-${padNumber(parsed.m)}-${padNumber(parsed.d)}`;
    }
  }

  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    let [, day, month, year] = slashMatch;
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${padNumber(month)}-${padNumber(day)}`;
  }

  const monthTextMatch = raw.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})$/);
  if (monthTextMatch) {
    let [, day, monthText, year] = monthTextMatch;
    if (year.length === 2) {
      year = `20${year}`;
    }

    const month = MONTH_MAP[monthText.toLowerCase()];
    if (month) {
      return `${year}-${month}-${padNumber(day)}`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${padNumber(parsed.getMonth() + 1)}-${padNumber(parsed.getDate())}`;
  }

  return "";
}

function parseImportWorkbook(fileName, fileContentBase64) {
  let workbook;
  try {
    const buffer = Buffer.from(fileContentBase64, "base64");
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith(".csv")) {
      const csvText = buffer.toString("utf8");
      const detectedSeparator = csvText.includes(";") ? ";" : ",";
      workbook = XLSX.read(csvText, {
        type: "string",
        FS: detectedSeparator,
      });
    } else {
      workbook = XLSX.read(buffer, { type: "buffer" });
    }
  } catch {
    return { error: "Failed to read file. Use valid CSV or Excel format." };
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { error: "File does not contain any worksheet." };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  let headerRowIndex = -1;

  for (let index = 0; index < matrix.length; index += 1) {
    const row = matrix[index].map((cell) => String(cell || "").trim());
    const firstValue = row[0] || "";

    if (!row.some(Boolean) || firstValue.startsWith("#")) {
      continue;
    }

    const normalizedRow = row.map((cell) => normalizeHeader(cell));
    if (normalizedRow.includes("tanggal")) {
      headerRowIndex = index;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return { error: "Header file tidak sesuai template import laporan harian batch." };
  }

  const headerRow = matrix[headerRowIndex].map((cell) => String(cell || "").trim());
  const normalizedHeaderRow = headerRow.map((cell) => normalizeHeader(cell));

  const rows = matrix
    .slice(headerRowIndex + 1)
    .filter((row) =>
      row.some((cell) => String(cell ?? "").trim())
    );

  if (!rows.length) {
    return { error: "File import is empty." };
  }

  return {
    headerRowIndex,
    headerRow,
    normalizedHeaderRow,
    rows,
  };
}

function validateReportDetails(details) {
  if (!Array.isArray(details) || details.length === 0) {
    return "Field 'details' must be a non-empty array.";
  }

  for (const row of details) {
    if (!row.unit_id) {
      return "Every detail needs unit_id.";
    }
    if (!VALID_STATUS.includes(row.service_status)) {
      return `Invalid service_status for unit ${row.unit_id}.`;
    }
    const actual = Number(row.actual_pm);
    const target = Number(row.target_pm);
    const actualSmall = Number(row.actual_small_portion ?? 0);
    const actualLarge = Number(row.actual_large_portion ?? 0);
    const targetSmall = Number(row.target_small_portion ?? 0);
    const targetLarge = Number(row.target_large_portion ?? 0);
    if (Number.isNaN(actual) || actual < 0) {
      return `actual_pm cannot be negative (unit ${row.unit_id}).`;
    }
    if (actual > target) {
      return `actual_pm exceeds target for unit ${row.unit_id}.`;
    }
    if (Number.isNaN(actualSmall) || actualSmall < 0) {
      return `actual_small_portion cannot be negative (unit ${row.unit_id}).`;
    }
    if (Number.isNaN(actualLarge) || actualLarge < 0) {
      return `actual_large_portion cannot be negative (unit ${row.unit_id}).`;
    }
    if (actualSmall + actualLarge !== actual) {
      return `actual_small_portion + actual_large_portion must equal actual_pm (unit ${row.unit_id}).`;
    }
    if (targetSmall > 0 && actualSmall > targetSmall) {
      return `actual_small_portion exceeds small target for unit ${row.unit_id}.`;
    }
    if (targetLarge > 0 && actualLarge > targetLarge) {
      return `actual_large_portion exceeds large target for unit ${row.unit_id}.`;
    }
  }

  return null;
}

function normalizeReportDetailPortions(details) {
  return details.map((detail) => {
    const actual = Number(detail.actual_pm || 0);
    const actualSmall = Number(detail.actual_small_portion ?? 0);
    const actualLarge = Number(detail.actual_large_portion ?? 0);

    if (actual <= 0 || actualSmall + actualLarge === actual) {
      return detail;
    }

    const targetSmall = Number(detail.target_small_portion ?? 0);
    const targetLarge = Number(detail.target_large_portion ?? 0);
    const totalTarget = targetSmall + targetLarge;

    if (totalTarget <= 0 || targetLarge <= 0) {
      return {
        ...detail,
        actual_small_portion: actual,
        actual_large_portion: 0,
      };
    }

    if (targetSmall <= 0) {
      return {
        ...detail,
        actual_small_portion: 0,
        actual_large_portion: actual,
      };
    }

    const rawSmall = (targetSmall / totalTarget) * actual;
    let nextSmall = Math.round(rawSmall);
    nextSmall = Math.max(0, Math.min(nextSmall, actual, targetSmall));
    let nextLarge = actual - nextSmall;

    if (nextLarge > targetLarge) {
      nextLarge = targetLarge;
      nextSmall = actual - nextLarge;
    }

    return {
      ...detail,
      actual_small_portion: nextSmall,
      actual_large_portion: nextLarge,
    };
  });
}

async function upsertDailyReport(conn, { report_date, details, notes }) {
  await ensureDailyReportDetailColumns();
  const totalPm = details.reduce((sum, detail) => sum + Number(detail.actual_pm || 0), 0);
  const [existing] = await conn.query(
    `SELECT id FROM daily_reports WHERE report_date = ?`,
    [report_date]
  );

  let reportId;
  let isUpdate = false;

  if (existing.length > 0) {
    isUpdate = true;
    reportId = existing[0].id;
    await conn.query(
      `UPDATE daily_reports SET total_pm = ?, notes = ? WHERE id = ?`,
      [totalPm, notes || null, reportId]
    );
    await conn.query(`DELETE FROM daily_report_details WHERE report_id = ?`, [reportId]);
  } else {
    const [result] = await conn.query(
      `INSERT INTO daily_reports (report_date, total_pm, notes)
       VALUES (?, ?, ?)`,
      [report_date, totalPm, notes || null]
    );
    reportId = result.insertId;
  }

  const values = details.map((detail) => [
    reportId,
    detail.unit_id,
    detail.target_pm,
    detail.service_status,
    detail.actual_pm,
    detail.actual_small_portion || 0,
    detail.actual_large_portion || 0,
  ]);

  await conn.query(
    `INSERT INTO daily_report_details
       (report_id, unit_id, target_pm, service_status, actual_pm, actual_small_portion, actual_large_portion)
     VALUES ?`,
    [values]
  );

  return { reportId, totalPm, isUpdate };
}

async function buildBatchImportPreview(fileName, fileContentBase64) {
  const parsed = parseImportWorkbook(fileName, fileContentBase64);
  if (parsed.error) {
    return { error: parsed.error };
  }

  const syncState = await syncBeneficiaryGroupsToUnits();
  const [units] = await pool.query(
    `SELECT u.id, u.name, u.category, u.default_target,
            (
              COALESCE(bg.student_small_portion, 0) +
              COALESCE(bg.staff_small_portion, 0)
            ) AS small_target,
            (
              COALESCE(bg.student_large_portion, 0) +
              COALESCE(bg.staff_large_portion, 0)
            ) AS large_target
       FROM units u
       LEFT JOIN beneficiary_groups bg ON bg.id = u.beneficiary_group_id
      WHERE is_active = 1
        ${syncState.usingBeneficiaryGroups ? "AND beneficiary_group_id IS NOT NULL" : ""}
      ORDER BY display_order ASC, id ASC`
  );

  const normalizedHeaders = parsed.normalizedHeaderRow;
  const dateColumnIndex = normalizedHeaders.indexOf("tanggal");
  const notesColumnIndex = normalizedHeaders.indexOf("keterangan");
  const totalColumnIndex = normalizedHeaders.indexOf("total_penerima_manfaat");

  if (dateColumnIndex === -1) {
    return { error: "Kolom tanggal wajib ada pada template import." };
  }

  const unitColumns = units.map((unit) => {
    const headerIndex = normalizedHeaders.indexOf(normalizeHeader(unit.name));
    return {
      unit,
      headerIndex,
    };
  });

  const missingUnitColumns = unitColumns
    .filter((entry) => entry.headerIndex === -1)
    .map((entry) => entry.unit.name);

  if (missingUnitColumns.length > 0) {
    return {
      error: `Kolom sekolah belum lengkap pada file import: ${missingUnitColumns.join(", ")}`,
    };
  }

  const previewRows = parsed.rows
    .map((row, index) => {
      const rowNumber = parsed.headerRowIndex + index + 2;
      const rawDate = row[dateColumnIndex];
      const normalizedDate = normalizeImportedDate(rawDate);
      const notes = notesColumnIndex >= 0 ? String(row[notesColumnIndex] || "").trim() : "";
      const totalCell = totalColumnIndex >= 0 ? row[totalColumnIndex] : "";
      const totalFromFile = normalizePmNumber(totalCell);
      const hasAnyUnitValue = unitColumns.some(({ headerIndex }) =>
        String(row[headerIndex] ?? "").trim()
      );

      if (!String(rawDate ?? "").trim() && !hasAnyUnitValue) {
        return null;
      }

      const errors = [];
      if (!normalizedDate || !DATE_REGEX.test(normalizedDate)) {
        errors.push("Tanggal wajib diisi dengan format yang valid.");
      }

      const details = unitColumns.map(({ unit, headerIndex }) => {
        const rawCell = String(row[headerIndex] ?? "").trim();
        const upperCell = rawCell.toUpperCase();
        let serviceStatus = "";
        let actualPm = 0;

        if (!rawCell) {
          errors.push(`Kolom ${unit.name} wajib diisi.`);
        } else if (upperCell === "LIBUR") {
          serviceStatus = "libur";
          actualPm = 0;
        } else {
          const parsedNumber = normalizePmNumber(rawCell);
          if (parsedNumber === null || parsedNumber < 0) {
            errors.push(`Nilai ${unit.name} harus angka >= 0 atau LIBUR.`);
          } else if (parsedNumber > Number(unit.default_target)) {
            errors.push(`Nilai ${unit.name} melebihi target (${unit.default_target}).`);
          } else {
            actualPm = parsedNumber;
            serviceStatus =
              parsedNumber === Number(unit.default_target) ? "penuh" : "sebagian";
          }
        }

        return {
          unit_id: unit.id,
          unit_name: unit.name,
          category: normalizeCategory(unit.category),
          target_pm: Number(unit.default_target),
          target_small_portion: Number(unit.small_target || 0),
          target_large_portion: Number(unit.large_target || 0),
          service_status: serviceStatus,
          actual_pm: actualPm,
          actual_small_portion: splitActualPortions(
            actualPm,
            Number(unit.small_target || 0),
            Number(unit.large_target || 0)
          ).actualSmall,
          actual_large_portion: splitActualPortions(
            actualPm,
            Number(unit.small_target || 0),
            Number(unit.large_target || 0)
          ).actualLarge,
        };
      });

      const totalPm = details.reduce((sum, detail) => sum + Number(detail.actual_pm || 0), 0);

      if (totalFromFile !== null && totalFromFile !== totalPm) {
        errors.push(`Total penerima manfaat tidak cocok. File: ${totalFromFile}, hitung sistem: ${totalPm}.`);
      }

      return {
        row_number: rowNumber,
        report_date: normalizedDate,
        notes,
        total_pm: totalPm,
        filled_units: details.length,
        details,
        errors,
      };
    })
    .filter(Boolean);

  if (!previewRows.length) {
    return { error: "Tidak ada baris laporan yang dapat diproses dari file import." };
  }

  return {
    is_valid: previewRows.every((row) => row.errors.length === 0),
    rows: previewRows,
  };
}

export async function previewReportImport(req, res, next) {
  try {
    await syncBeneficiaryGroupsToUnits();
    await ensureDailyReportDetailColumns();

    const fileName = String(req.body?.file_name || "").trim();
    const fileContentBase64 = String(req.body?.file_content_base64 || "").trim();

    if (!fileName || !fileContentBase64) {
      return res.status(400).json({ error: "File import is required." });
    }

    const preview = await buildBatchImportPreview(fileName, fileContentBase64);
    if (preview.error) {
      return res.status(400).json({ error: preview.error });
    }

    res.json(preview);
  } catch (err) {
    next(err);
  }
}

export async function importReportsBatch(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await syncBeneficiaryGroupsToUnits();
    await ensureDailyReportDetailColumns();

    const fileName = String(req.body?.file_name || "").trim();
    const fileContentBase64 = String(req.body?.file_content_base64 || "").trim();

    if (!fileName || !fileContentBase64) {
      return res.status(400).json({ error: "File import is required." });
    }

    const preview = await buildBatchImportPreview(fileName, fileContentBase64);
    if (preview.error) {
      return res.status(400).json({ error: preview.error });
    }

    const invalidRow = preview.rows.find((row) => row.errors.length > 0);
    if (invalidRow) {
      return res.status(400).json({
        error: `Import dibatalkan. Masih ada baris tidak valid pada baris ${invalidRow.row_number}.`,
        rows: preview.rows,
      });
    }

    await conn.beginTransaction();

    let createdCount = 0;
    let updatedCount = 0;

    for (const row of preview.rows) {
      const normalizedDetails = normalizeReportDetailPortions(row.details);
      const validationError = validateReportDetails(normalizedDetails);
      if (validationError) {
        throw new Error(validationError);
      }

      const result = await upsertDailyReport(conn, {
        report_date: row.report_date,
        details: normalizedDetails,
        notes: row.notes || null,
      });

      if (result.isUpdate) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
    }

    await conn.commit();

    res.status(201).json({
      ok: true,
      imported_count: preview.rows.length,
      created_count: createdCount,
      updated_count: updatedCount,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// GET /api/reports — list recent reports
export async function listReports(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const { date_from, date_to, include_details } = req.query;
    const includeDetails = String(include_details || "") === "1";

    if ((date_from && !isValidDate(date_from)) || (date_to && !isValidDate(date_to))) {
      return res.status(400).json({
        error: "Invalid date range. Use YYYY-MM-DD.",
      });
    }

    let query = `SELECT r.id,
                        r.report_date,
                        r.total_pm,
                        r.notes,
                        r.created_at,
                        r.updated_at,
                        COALESCE(SUM(d.actual_small_portion), 0) AS total_small_portion,
                        COALESCE(SUM(d.actual_large_portion), 0) AS total_large_portion
                   FROM daily_reports r
                   LEFT JOIN daily_report_details d ON d.report_id = r.id`;
    const conditions = [];
    const params = [];

    if (date_from) {
      conditions.push("r.report_date >= ?");
      params.push(date_from);
    }
    if (date_to) {
      conditions.push("r.report_date <= ?");
      params.push(date_to);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " GROUP BY r.id, r.report_date, r.total_pm, r.notes, r.created_at, r.updated_at";
    query += " ORDER BY r.report_date DESC";

    if (!date_from && !date_to) {
      query += " LIMIT ?";
      params.push(limit);
    }

    const [rows] = await pool.query(query, params);

    if (!includeDetails || rows.length === 0) {
      return res.json(rows);
    }

    const reportIds = rows.map((row) => row.id);
    const [details] = await pool.query(
      `SELECT d.report_id, d.unit_id, u.name AS unit_name, u.category,
              d.target_pm, d.service_status, d.actual_pm,
              d.actual_small_portion, d.actual_large_portion
         FROM daily_report_details d
         JOIN units u ON u.id = d.unit_id
        WHERE d.report_id IN (?)
        ORDER BY d.report_id DESC, u.display_order ASC, u.id ASC`,
      [reportIds]
    );

    const detailMap = new Map();
    details.forEach((detail) => {
      if (!detailMap.has(detail.report_id)) {
        detailMap.set(detail.report_id, []);
      }
      detailMap.get(detail.report_id).push(detail);
    });

    res.json(
      rows.map((row) => ({
        ...row,
        details: detailMap.get(row.id) || [],
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function getWeeklySummary(req, res, next) {
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

    const [dailyReports] = await pool.query(
      `SELECT id, report_date, total_pm, notes, created_at, updated_at
         FROM daily_reports
        WHERE report_date >= ? AND report_date <= ?
        ORDER BY report_date ASC, id ASC`,
      [startDate, endDate]
    );

    const dailySummary = {
      total_pm: 0,
      total_days: dailyReports.length,
      by_category: createCategoryTotals(),
    };
    let dailyDetails = [];

    if (dailyReports.length > 0) {
      const reportIds = dailyReports.map((row) => row.id);
      const [detailRows] = await pool.query(
        `SELECT d.report_id, d.actual_pm, d.actual_small_portion, d.actual_large_portion, u.category
           FROM daily_report_details d
           JOIN units u ON u.id = d.unit_id
          WHERE d.report_id IN (?)
          ORDER BY d.report_id ASC, u.display_order ASC, u.id ASC`,
        [reportIds]
      );
      dailyDetails = detailRows;
    }

    const dailyDetailMap = new Map();
    dailyDetails.forEach((detail) => {
      if (!dailyDetailMap.has(detail.report_id)) {
        dailyDetailMap.set(detail.report_id, []);
      }
      dailyDetailMap.get(detail.report_id).push(detail);
    });

    const dailyRows = dailyReports.map((report) => {
      const details = dailyDetailMap.get(report.id) || [];
      const categoryTotals = createCategoryTotals();
      let totalPm = 0;
      let totalSmallPortion = 0;
      let totalLargePortion = 0;

      details.forEach((detail) => {
        const actualPm = Number(detail.actual_pm || 0);
        const actualSmall = Number(detail.actual_small_portion || 0);
        const actualLarge = Number(detail.actual_large_portion || 0);
        const category = normalizeCategory(detail.category);

        totalPm += actualPm;
        totalSmallPortion += actualSmall;
        totalLargePortion += actualLarge;

        if (Object.prototype.hasOwnProperty.call(categoryTotals, category)) {
          categoryTotals[category] += actualPm;
        }
      });

      dailySummary.total_pm += totalPm;
      Object.keys(dailySummary.by_category).forEach((category) => {
        dailySummary.by_category[category] += categoryTotals[category] || 0;
      });

      return {
        report_id: report.id,
        report_date: report.report_date,
        total_pm: totalPm,
        total_small_portion: totalSmallPortion,
        total_large_portion: totalLargePortion,
        by_category: categoryTotals,
      };
    });

    const [menuRows] = await pool.query(
      `SELECT id, menu_date,
              COALESCE(NULLIF(menu_name, ''), TRIM(CONCAT_WS(', ',
                NULLIF(menu_name_1, ''),
                NULLIF(menu_name_2, ''),
                NULLIF(menu_name_3, ''),
                NULLIF(menu_name_4, ''),
                NULLIF(menu_name_5, '')
              ))) AS menu_name,
              menu_name_1, menu_name_2, menu_name_3, menu_name_4, menu_name_5,
              COALESCE(small_energy, energy, 0) AS small_energy,
              COALESCE(small_protein, protein, 0) AS small_protein,
              COALESCE(small_fat, fat, 0) AS small_fat,
              COALESCE(small_carbohydrate, carbohydrate, 0) AS small_carbohydrate,
              COALESCE(small_fiber, fiber, 0) AS small_fiber,
              COALESCE(large_energy, 0) AS large_energy,
              COALESCE(large_protein, 0) AS large_protein,
              COALESCE(large_fat, 0) AS large_fat,
              COALESCE(large_carbohydrate, 0) AS large_carbohydrate,
              COALESCE(large_fiber, 0) AS large_fiber
         FROM menu_reports
        WHERE menu_date >= ? AND menu_date <= ?
        ORDER BY menu_date ASC, id ASC`,
      [startDate, endDate]
    );

    const menuSummary = {
      total_days: new Set(menuRows.map((row) => row.menu_date)).size,
      total_reports: menuRows.length,
    };

    const [shoppingRows] = await pool.query(
      `SELECT id, report_date, menu_name, small_portion_count, large_portion_count,
              daily_budget, total_spending, difference_amount, item_count, notes
         FROM shopping_reports
        WHERE report_date >= ? AND report_date <= ?
        ORDER BY report_date ASC, id ASC`,
      [startDate, endDate]
    );

    const shoppingSummary = shoppingRows.reduce(
      (acc, row) => ({
        total_spending: acc.total_spending + Number(row.total_spending || 0),
        total_budget: acc.total_budget + Number(row.daily_budget || 0),
        total_difference: acc.total_difference + Number(row.difference_amount || 0),
        total_days: acc.total_days,
        total_reports: acc.total_reports + 1,
      }),
      {
        total_spending: 0,
        total_budget: 0,
        total_difference: 0,
        total_days: new Set(shoppingRows.map((row) => row.report_date)).size,
        total_reports: 0,
      }
    );

    res.json({
      ok: true,
      range: {
        start_date: startDate,
        end_date: endDate,
      },
      daily_reports: {
        summary: dailySummary,
        reports: dailyRows,
      },
      menu_reports: {
        summary: menuSummary,
        reports: menuRows,
      },
      shopping_reports: {
        summary: shoppingSummary,
        reports: shoppingRows,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/:date — fetch a report for one date
export async function getReportByDate(req, res, next) {
  try {
    const { date } = req.params;
    if (!DATE_REGEX.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    const [reports] = await pool.query(
      `SELECT id, report_date, total_pm, notes, created_at, updated_at
         FROM daily_reports
        WHERE report_date = ?`,
      [date]
    );

    if (reports.length === 0) {
      return res.json({ exists: false, report_date: date, details: [] });
    }

    const report = reports[0];
    const [details] = await pool.query(
      `SELECT d.id, d.unit_id, u.name AS unit_name, u.category,
              d.target_pm, d.service_status, d.actual_pm,
              d.actual_small_portion, d.actual_large_portion,
              COALESCE(bg.student_small_portion, 0) AS student_small_portion,
              COALESCE(bg.student_large_portion, 0) AS student_large_portion,
              COALESCE(bg.staff_small_portion, 0) AS staff_small_portion,
              COALESCE(bg.staff_large_portion, 0) AS staff_large_portion,
              (
                COALESCE(bg.student_small_portion, 0) +
                COALESCE(bg.staff_small_portion, 0)
              ) AS target_small_portion,
              (
                COALESCE(bg.student_large_portion, 0) +
                COALESCE(bg.staff_large_portion, 0)
              ) AS target_large_portion
         FROM daily_report_details d
         JOIN units u ON u.id = d.unit_id
         LEFT JOIN beneficiary_groups bg ON bg.id = u.beneficiary_group_id
        WHERE d.report_id = ?
        ORDER BY u.display_order ASC`,
      [report.id]
    );

    res.json({ exists: true, ...report, details });
  } catch (err) {
    next(err);
  }
}

// POST /api/reports — create or update a daily report (upsert by date)
export async function saveReport(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await syncBeneficiaryGroupsToUnits();
    await ensureDailyReportDetailColumns();
    const { report_date, details, notes } = req.body;

    // validation
    if (!report_date || !DATE_REGEX.test(report_date)) {
      return res.status(400).json({
        error: "Field 'report_date' is required in YYYY-MM-DD format.",
      });
    }
    if (!Array.isArray(details) || details.length === 0) {
      return res.status(400).json({
        error: "Field 'details' must be a non-empty array.",
      });
    }

    const normalizedDetails = normalizeReportDetailPortions(details);
    const validationError = validateReportDetails(normalizedDetails);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await conn.beginTransaction();
    const result = await upsertDailyReport(conn, {
      report_date,
      details: normalizedDetails,
      notes: notes || null,
    });

    await conn.commit();

    res.status(result.isUpdate ? 200 : 201).json({
      ok: true,
      updated: result.isUpdate,
      report_id: result.reportId,
      report_date,
      total_pm: result.totalPm,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// DELETE /api/reports/:id — delete one daily report by id
export async function deleteReport(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid report id." });
    }

    const [result] = await pool.query(
      `DELETE FROM daily_reports WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Report not found." });
    }

    res.json({ ok: true, message: "Report deleted." });
  } catch (err) {
    next(err);
  }
}
