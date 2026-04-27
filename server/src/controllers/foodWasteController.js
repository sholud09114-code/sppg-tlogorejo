import pool from "../config/db.js";
import { ensureMenuReportsTable } from "./menuReportController.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
let ensureFoodWasteTablePromise;

export function ensureFoodWasteTable() {
  if (!ensureFoodWasteTablePromise) {
    ensureFoodWasteTablePromise = (async () => {
      await ensureMenuReportsTable();
      await pool.query(
        `CREATE TABLE IF NOT EXISTS food_waste_reports (
          id INT AUTO_INCREMENT PRIMARY KEY,
          report_date DATE NOT NULL,
          total_portions DECIMAL(12,2) NOT NULL DEFAULT 0,
          carb_source DECIMAL(12,2) NOT NULL DEFAULT 0,
          protein_source DECIMAL(12,2) NOT NULL DEFAULT 0,
          vegetable DECIMAL(12,2) NOT NULL DEFAULT 0,
          fruit DECIMAL(12,2) NOT NULL DEFAULT 0,
          total_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
          menu_notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_food_waste_report_date (report_date)
        ) ENGINE=InnoDB`
      );

      const [portionColumns] = await pool.query(
        `SHOW COLUMNS FROM food_waste_reports LIKE 'total_portions'`
      );
      if (portionColumns.length === 0) {
        await pool.query(
          `ALTER TABLE food_waste_reports
             ADD COLUMN total_portions DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER report_date`
        );
      }
    })().catch((err) => {
      ensureFoodWasteTablePromise = null;
      throw err;
    });
  }

  return ensureFoodWasteTablePromise;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function normalizeNumber(value, label) {
  const normalized = value === "" || value == null ? 0 : Number(value);
  if (!Number.isFinite(normalized)) {
    return { error: `${label} harus berupa angka.` };
  }
  if (normalized < 0) {
    return { error: `${label} tidak boleh negatif.` };
  }
  return { value: normalized };
}

function mapRow(row) {
  return {
    id: row.id,
    report_date: row.report_date,
    total_portions: Number(row.total_portions || 0),
    carb_source: Number(row.carb_source || 0),
    protein_source: Number(row.protein_source || 0),
    vegetable: Number(row.vegetable || 0),
    fruit: Number(row.fruit || 0),
    total_kg: Number(row.total_kg || 0),
    menu_notes: row.menu_notes || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildMenuText(row) {
  return [
    row?.menu_name_1,
    row?.menu_name_2,
    row?.menu_name_3,
    row?.menu_name_4,
    row?.menu_name_5,
  ]
    .filter(Boolean)
    .join(", ") || row?.menu_name || "";
}

async function findFoodWasteById(id) {
  await ensureFoodWasteTable();
  const [rows] = await pool.query(
    `SELECT id, report_date, carb_source, protein_source, vegetable, fruit, total_kg, menu_notes,
            created_at, updated_at
       FROM food_waste_reports
      WHERE id = ?`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

async function findMenuReferenceByDate(reportDate) {
  await ensureMenuReportsTable();
  const [rows] = await pool.query(
    `SELECT id, menu_date, menu_name, menu_name_1, menu_name_2, menu_name_3, menu_name_4, menu_name_5
       FROM menu_reports
      WHERE menu_date = ?
      ORDER BY id DESC
      LIMIT 1`,
    [reportDate]
  );

  if (!rows.length) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    menu_date: row.menu_date,
    menu_text: buildMenuText(row),
    menu_names: [
      row.menu_name_1,
      row.menu_name_2,
      row.menu_name_3,
      row.menu_name_4,
      row.menu_name_5,
    ].filter(Boolean),
  };
}

function normalizePayload(body) {
  const reportDate = String(body.report_date || body.tanggal || "").trim();
  const menuNotes = String(body.menu_notes || body.menu || body.keterangan_bahan_sisa || "").trim();
  const totalPortionsResult = normalizeNumber(
    body.total_portions ?? body.total_porsi,
    "Total porsi"
  );

  if (!reportDate || !DATE_REGEX.test(reportDate)) {
    return { error: "Field 'report_date' wajib diisi dengan format YYYY-MM-DD." };
  }

  if (totalPortionsResult.error) {
    return { error: totalPortionsResult.error };
  }

  const carbSourceResult = normalizeNumber(
    body.carb_source ?? body.sumber_karbohidrat,
    "Sumber karbohidrat"
  );
  const proteinSourceResult = normalizeNumber(
    body.protein_source ?? body.sumber_protein,
    "Sumber protein"
  );
  const vegetableResult = normalizeNumber(body.vegetable ?? body.sayur, "Sayur");
  const fruitResult = normalizeNumber(body.fruit ?? body.buah, "Buah");

  if (
    carbSourceResult.error ||
    proteinSourceResult.error ||
    vegetableResult.error ||
    fruitResult.error
  ) {
    return {
      error:
        carbSourceResult.error ||
        proteinSourceResult.error ||
        vegetableResult.error ||
        fruitResult.error,
    };
  }

  const autoTotal =
    Number(carbSourceResult.value) +
    Number(proteinSourceResult.value) +
    Number(vegetableResult.value) +
    Number(fruitResult.value);
  const totalKgResult = normalizeNumber(
    body.total_kg == null || body.total_kg === "" ? autoTotal : body.total_kg,
    "Total kg"
  );

  if (totalKgResult.error) {
    return { error: totalKgResult.error };
  }

  return {
    payload: {
      report_date: reportDate,
      total_portions: totalPortionsResult.value,
      carb_source: carbSourceResult.value,
      protein_source: proteinSourceResult.value,
      vegetable: vegetableResult.value,
      fruit: fruitResult.value,
      total_kg: totalKgResult.value,
      menu_notes: menuNotes,
    },
  };
}

export async function listFoodWasteReports(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, report_date, total_portions, carb_source, protein_source, vegetable, fruit, total_kg, menu_notes,
              created_at, updated_at
         FROM food_waste_reports
        ORDER BY report_date DESC, id DESC`
    );
    res.json(rows.map(mapRow));
  } catch (err) {
    next(err);
  }
}

export async function getFoodWasteById(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid food waste id." });
    }

    const row = await findFoodWasteById(id);
    if (!row) {
      return res.status(404).json({ error: "Food waste report not found." });
    }

    res.json(row);
  } catch (err) {
    next(err);
  }
}

export async function createFoodWaste(req, res, next) {
  try {
    await ensureFoodWasteTable();
    const { payload, error } = normalizePayload(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    const [result] = await pool.query(
      `INSERT INTO food_waste_reports
        (report_date, total_portions, carb_source, protein_source, vegetable, fruit, total_kg, menu_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.report_date,
        payload.total_portions,
        payload.carb_source,
        payload.protein_source,
        payload.vegetable,
        payload.fruit,
        payload.total_kg,
        payload.menu_notes || null,
      ]
    );

    const row = await findFoodWasteById(result.insertId);
    res.status(201).json({ ok: true, message: "Food waste report created.", data: row });
  } catch (err) {
    next(err);
  }
}

export async function updateFoodWaste(req, res, next) {
  try {
    await ensureFoodWasteTable();
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid food waste id." });
    }

    const existing = await findFoodWasteById(id);
    if (!existing) {
      return res.status(404).json({ error: "Food waste report not found." });
    }

    const { payload, error } = normalizePayload(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    await pool.query(
      `UPDATE food_waste_reports
          SET report_date = ?,
              total_portions = ?,
              carb_source = ?,
              protein_source = ?,
              vegetable = ?,
              fruit = ?,
              total_kg = ?,
              menu_notes = ?
        WHERE id = ?`,
      [
        payload.report_date,
        payload.total_portions,
        payload.carb_source,
        payload.protein_source,
        payload.vegetable,
        payload.fruit,
        payload.total_kg,
        payload.menu_notes || null,
        id,
      ]
    );

    const row = await findFoodWasteById(id);
    res.json({ ok: true, message: "Food waste report updated.", data: row });
  } catch (err) {
    next(err);
  }
}

export async function deleteFoodWaste(req, res, next) {
  try {
    await ensureFoodWasteTable();
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid food waste id." });
    }

    const existing = await findFoodWasteById(id);
    if (!existing) {
      return res.status(404).json({ error: "Food waste report not found." });
    }

    await pool.query(`DELETE FROM food_waste_reports WHERE id = ?`, [id]);
    res.json({ ok: true, message: "Food waste report deleted." });
  } catch (err) {
    next(err);
  }
}

export async function getFoodWasteMenuReference(req, res, next) {
  try {
    const reportDate = String(req.query.date || req.params.date || "").trim();
    if (!reportDate || !DATE_REGEX.test(reportDate)) {
      return res.status(400).json({
        error: "Query 'date' wajib diisi dengan format YYYY-MM-DD.",
      });
    }

    const menuReference = await findMenuReferenceByDate(reportDate);
    if (!menuReference) {
      return res.json({
        exists: false,
        date: reportDate,
        menu_text: "",
        menu_names: [],
        message: "Data menu pada tanggal ini tidak tersedia.",
      });
    }

    res.json({
      exists: true,
      date: reportDate,
      ...menuReference,
    });
  } catch (err) {
    next(err);
  }
}
