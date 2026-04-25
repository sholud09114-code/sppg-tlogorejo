import pool from "../config/db.js";
import {
  ensureBeneficiaryGroupsTable,
  syncBeneficiaryGroupsToUnits,
} from "../utils/beneficiaryGroupSync.js";
import XLSX from "xlsx";

const VALID_GROUP_TYPES = ["Paud/KB/TK", "SD", "SMP/MTs", "SMK"];
const NUMBER_FIELDS = [
  "student_small_portion",
  "student_large_portion",
  "staff_small_portion",
  "staff_large_portion",
];
const IMPORT_COLUMN_MAP = {
  jenis_kelompok: "group_type",
  nama_kelompok: "group_name",
  porsi_siswa_kecil: "student_small_portion",
  porsi_siswa_besar: "student_large_portion",
  porsi_guru_tendik_kecil: "staff_small_portion",
  porsi_guru_tendik_besar: "staff_large_portion",
};

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function normalizePayload(body) {
  const groupType = String(body.group_type || "").trim();
  const groupName = String(body.group_name || "").trim();

  if (!VALID_GROUP_TYPES.includes(groupType)) {
    return { error: "Field 'group_type' is required and must be valid." };
  }

  if (!groupName) {
    return { error: "Field 'group_name' is required." };
  }

  const payload = {
    group_type: groupType,
    group_name: groupName,
  };

  for (const field of NUMBER_FIELDS) {
    const rawValue = body[field];
    const value = rawValue === "" || rawValue == null ? 0 : Number(rawValue);

    if (!Number.isFinite(value) || value < 0) {
      return { error: `Field '${field}' cannot be negative.` };
    }

    payload[field] = value;
  }

  return { payload };
}

function parseImportPayload(body) {
  const fileName = String(body.file_name || "").trim();
  const fileContentBase64 = String(body.file_content_base64 || "").trim();

  if (!fileName || !fileContentBase64) {
    return { error: "File import is required." };
  }

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
    raw: false,
  });

  const normalizedRequiredHeaders = Object.keys(IMPORT_COLUMN_MAP);
  let headerRowIndex = -1;

  for (let index = 0; index < matrix.length; index += 1) {
    const row = matrix[index].map((cell) => String(cell || "").trim());
    const firstValue = row[0] || "";

    if (!row.some(Boolean) || firstValue.startsWith("#")) {
      continue;
    }

    const normalizedRow = row.map((cell) => cell.toLowerCase());
    const isHeaderRow = normalizedRequiredHeaders.every((header) =>
      normalizedRow.includes(header)
    );

    if (isHeaderRow) {
      headerRowIndex = index;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return {
      error: "Header file tidak sesuai template import.",
    };
  }

  const headerRow = matrix[headerRowIndex].map((cell) =>
    String(cell || "").trim().toLowerCase()
  );

  const filteredRows = matrix
    .slice(headerRowIndex + 1)
    .map((row) => row.map((cell) => String(cell || "").trim()))
    .filter((row) => row.some(Boolean));

  if (!filteredRows.length) {
    return { error: "File import is empty." };
  }

  const previewRows = filteredRows.map((row, index) => {
    const mappedRow = {};
    Object.entries(IMPORT_COLUMN_MAP).forEach(([sourceKey, targetKey]) => {
      const columnIndex = headerRow.indexOf(sourceKey);
      mappedRow[targetKey] = columnIndex >= 0 ? row[columnIndex] || "" : "";
    });

    const { payload, error } = normalizePayload(mappedRow);
    return {
      row_number: headerRowIndex + index + 2,
      raw: mappedRow,
      data: payload || null,
      errors: error ? [error] : [],
    };
  });

  return {
    rows: previewRows,
    is_valid: previewRows.every((row) => row.errors.length === 0),
  };
}

async function findBeneficiaryGroupById(id) {
  await ensureBeneficiaryGroupsTable();
  const [rows] = await pool.query(
    `SELECT id, group_type, group_name,
            student_small_portion, student_large_portion,
            staff_small_portion, staff_large_portion,
            (
              student_small_portion +
              student_large_portion +
              staff_small_portion +
              staff_large_portion
            ) AS total_portion,
            created_at, updated_at
       FROM beneficiary_groups
      WHERE id = ?`,
    [id]
  );

  return rows[0] || null;
}

export async function listBeneficiaryGroups(req, res, next) {
  try {
    await ensureBeneficiaryGroupsTable();
    const [rows] = await pool.query(
      `SELECT id, group_type, group_name,
              student_small_portion, student_large_portion,
              staff_small_portion, staff_large_portion,
              (
                student_small_portion +
                student_large_portion +
                staff_small_portion +
                staff_large_portion
              ) AS total_portion,
              created_at, updated_at
         FROM beneficiary_groups
        ORDER BY created_at DESC, id DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getBeneficiaryGroupById(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid beneficiary group id." });
    }

    const row = await findBeneficiaryGroupById(id);
    if (!row) {
      return res.status(404).json({ error: "Beneficiary group not found." });
    }

    res.json(row);
  } catch (err) {
    next(err);
  }
}

export async function createBeneficiaryGroup(req, res, next) {
  try {
    await ensureBeneficiaryGroupsTable();
    const { payload, error } = normalizePayload(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    const [result] = await pool.query(
      `INSERT INTO beneficiary_groups
        (group_type, group_name, student_small_portion, student_large_portion,
         staff_small_portion, staff_large_portion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.group_type,
        payload.group_name,
        payload.student_small_portion,
        payload.student_large_portion,
        payload.staff_small_portion,
        payload.staff_large_portion,
      ]
    );

    const row = await findBeneficiaryGroupById(result.insertId);
    await syncBeneficiaryGroupsToUnits();
    res.status(201).json({
      ok: true,
      message: "Beneficiary group created.",
      data: row,
    });
  } catch (err) {
    next(err);
  }
}

export async function previewBeneficiaryGroupImport(req, res, next) {
  try {
    await ensureBeneficiaryGroupsTable();
    const result = parseImportPayload(req.body || {});
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function importBeneficiaryGroups(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await ensureBeneficiaryGroupsTable();
    const result = parseImportPayload(req.body || {});
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    if (!result.is_valid) {
      return res.status(400).json({
        error: "Import file contains invalid rows.",
        rows: result.rows,
      });
    }

    await conn.beginTransaction();

    const values = result.rows.map((row) => [
      row.data.group_type,
      row.data.group_name,
      row.data.student_small_portion,
      row.data.student_large_portion,
      row.data.staff_small_portion,
      row.data.staff_large_portion,
    ]);

    await conn.query(
      `INSERT INTO beneficiary_groups
        (group_type, group_name, student_small_portion, student_large_portion,
         staff_small_portion, staff_large_portion)
       VALUES ?`,
      [values]
    );

    await conn.commit();
    await syncBeneficiaryGroupsToUnits();

    res.status(201).json({
      ok: true,
      imported: values.length,
      message: "Beneficiary groups imported.",
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export async function updateBeneficiaryGroup(req, res, next) {
  try {
    await ensureBeneficiaryGroupsTable();
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid beneficiary group id." });
    }

    const { payload, error } = normalizePayload(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    const [result] = await pool.query(
      `UPDATE beneficiary_groups
          SET group_type = ?,
              group_name = ?,
              student_small_portion = ?,
              student_large_portion = ?,
              staff_small_portion = ?,
              staff_large_portion = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        payload.group_type,
        payload.group_name,
        payload.student_small_portion,
        payload.student_large_portion,
        payload.staff_small_portion,
        payload.staff_large_portion,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Beneficiary group not found." });
    }

    const row = await findBeneficiaryGroupById(id);
    await syncBeneficiaryGroupsToUnits();
    res.json({
      ok: true,
      message: "Beneficiary group updated.",
      data: row,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteBeneficiaryGroup(req, res, next) {
  try {
    await ensureBeneficiaryGroupsTable();
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid beneficiary group id." });
    }

    const [result] = await pool.query(
      `DELETE FROM beneficiary_groups WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Beneficiary group not found." });
    }

    await syncBeneficiaryGroupsToUnits();
    res.json({ ok: true, message: "Beneficiary group deleted." });
  } catch (err) {
    next(err);
  }
}
