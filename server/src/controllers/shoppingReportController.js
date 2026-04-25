import pool from "../config/db.js";
import { ensureItemMastersTable } from "./itemMasterController.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
let ensureShoppingReportsTablePromise;

export function ensureShoppingReportsTables() {
  if (!ensureShoppingReportsTablePromise) {
    ensureShoppingReportsTablePromise = (async () => {
      await ensureItemMastersTable();
      await pool.query(
        `CREATE TABLE IF NOT EXISTS shopping_reports (
          id INT AUTO_INCREMENT PRIMARY KEY,
          report_date DATE NOT NULL,
          menu_name VARCHAR(200) NOT NULL,
          small_portion_count DECIMAL(12,2) NOT NULL DEFAULT 0,
          large_portion_count DECIMAL(12,2) NOT NULL DEFAULT 0,
          daily_budget DECIMAL(12,2) NOT NULL DEFAULT 0,
          total_spending DECIMAL(12,2) NOT NULL DEFAULT 0,
          difference_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          item_count INT NOT NULL DEFAULT 0,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_shopping_report_date (report_date),
          INDEX idx_shopping_menu_name (menu_name)
        ) ENGINE=InnoDB`
      );

      const [smallColumns] = await pool.query(
        `SHOW COLUMNS FROM shopping_reports LIKE 'small_portion_count'`
      );
      if (smallColumns.length === 0) {
        await pool.query(
          `ALTER TABLE shopping_reports
             ADD COLUMN small_portion_count DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER menu_name`
        );
      }

      const [largeColumns] = await pool.query(
        `SHOW COLUMNS FROM shopping_reports LIKE 'large_portion_count'`
      );
      if (largeColumns.length === 0) {
        await pool.query(
          `ALTER TABLE shopping_reports
             ADD COLUMN large_portion_count DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER small_portion_count`
        );
      }

      await pool.query(
        `CREATE TABLE IF NOT EXISTS shopping_report_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          report_id INT NOT NULL,
          master_item_id INT NULL,
          description VARCHAR(200) NOT NULL,
          qty DECIMAL(12,2) NOT NULL DEFAULT 0,
          unit_name VARCHAR(50) NOT NULL DEFAULT '',
          price DECIMAL(12,2) NOT NULL DEFAULT 0,
          amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          notes VARCHAR(255) NULL,
          display_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_shopping_report_items_report
            FOREIGN KEY (report_id) REFERENCES shopping_reports(id) ON DELETE CASCADE,
          CONSTRAINT fk_shopping_report_items_master
            FOREIGN KEY (master_item_id) REFERENCES item_masters(id) ON DELETE SET NULL,
          INDEX idx_shopping_report_items_report (report_id),
          INDEX idx_shopping_report_items_order (display_order)
        ) ENGINE=InnoDB`
      );

      const [columns] = await pool.query(
        `SHOW COLUMNS FROM shopping_report_items LIKE 'master_item_id'`
      );
      if (columns.length === 0) {
        await pool.query(
          `ALTER TABLE shopping_report_items ADD COLUMN master_item_id INT NULL AFTER report_id`
        );
        await pool.query(
          `ALTER TABLE shopping_report_items
             ADD CONSTRAINT fk_shopping_report_items_master
             FOREIGN KEY (master_item_id) REFERENCES item_masters(id) ON DELETE SET NULL`
        );
      }
    })().catch((err) => {
      ensureShoppingReportsTablePromise = null;
      throw err;
    });
  }

  return ensureShoppingReportsTablePromise;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function normalizeNumber(value, fieldLabel, { allowNegative = false } = {}) {
  const number = value === "" || value == null ? 0 : Number(value);
  if (!Number.isFinite(number)) {
    return { error: `${fieldLabel} harus berupa angka.` };
  }
  if (!allowNegative && number < 0) {
    return { error: `${fieldLabel} tidak boleh negatif.` };
  }
  return { value: number };
}

function normalizePayload(body) {
  const reportDate = String(body.report_date || body.tanggal_laporan || "").trim();
  const menuName = String(body.menu_name || body.nama_menu || "").trim();
  const notes = String(body.notes || body.catatan || "").trim();
  const smallPortionResult = normalizeNumber(
    body.small_portion_count ?? body.jumlah_porsi_kecil,
    "Jumlah porsi kecil"
  );
  const largePortionResult = normalizeNumber(
    body.large_portion_count ?? body.jumlah_porsi_besar,
    "Jumlah porsi besar"
  );

  if (!reportDate || !DATE_REGEX.test(reportDate)) {
    return { error: "Field 'report_date' wajib diisi dengan format YYYY-MM-DD." };
  }

  if (!menuName) {
    return { error: "Field 'menu_name' wajib diisi." };
  }

  if (smallPortionResult.error || largePortionResult.error) {
    return { error: smallPortionResult.error || largePortionResult.error };
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) {
    return { error: "Minimal ada 1 item belanja." };
  }

  const items = [];
  for (let index = 0; index < rawItems.length; index += 1) {
    const row = rawItems[index] || {};
    const masterItemId = row.master_item_id == null || row.master_item_id === ""
      ? null
      : Number(row.master_item_id);
    const description = String(row.description || row.uraian || "").trim();
    const unitName = String(row.unit_name || row.satuan || "").trim();
    const itemNotes = String(row.notes || row.keterangan || "").trim();

    if (!description) {
      return { error: `Uraian item pada baris ${index + 1} wajib diisi.` };
    }

    const qtyResult = normalizeNumber(row.qty, `Qty item baris ${index + 1}`);
    const priceResult = normalizeNumber(row.price, `Harga item baris ${index + 1}`);
    const amountSource =
      row.amount === "" || row.amount == null
        ? (Number(row.qty || 0) || 0) * (Number(row.price || 0) || 0)
        : row.amount;
    const amountResult = normalizeNumber(
      amountSource,
      `Jumlah item baris ${index + 1}`
    );

    if (qtyResult.error || priceResult.error || amountResult.error) {
      return {
        error: qtyResult.error || priceResult.error || amountResult.error,
      };
    }

    items.push({
      master_item_id: Number.isInteger(masterItemId) && masterItemId > 0 ? masterItemId : null,
      description,
      qty: qtyResult.value,
      unit_name: unitName,
      price: priceResult.value,
      amount: amountResult.value,
      notes: itemNotes,
      display_order: index + 1,
    });
  }

  const totalSpending = items.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );
  const dailyBudget =
    Number(smallPortionResult.value) * 8000 + Number(largePortionResult.value) * 10000;
  const differenceAmount = Number(dailyBudget) - Number(totalSpending);

  return {
    payload: {
      report_date: reportDate,
      menu_name: menuName,
      small_portion_count: smallPortionResult.value,
      large_portion_count: largePortionResult.value,
      daily_budget: dailyBudget,
      total_spending: totalSpending,
      difference_amount: differenceAmount,
      item_count: items.length,
      notes,
      items,
    },
  };
}

function buildExtractionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "report_date",
      "menu_name",
      "items",
      "total_belanja",
      "pagu_harian",
      "selisih",
      "warnings",
    ],
    properties: {
      report_date: {
        type: "string",
        description:
          "Tanggal laporan dalam format YYYY-MM-DD jika terbaca jelas. Jika tidak yakin atau tidak ada, isi string kosong.",
      },
      menu_name: {
        type: "string",
        description:
          "Nama menu jika tertulis jelas. Jika tidak ada atau tidak yakin, isi string kosong.",
      },
      items: {
        type: "array",
        description: "Daftar item belanja yang berhasil diekstrak dari gambar.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["uraian", "qty", "satuan", "harga", "jumlah", "keterangan"],
          properties: {
            uraian: { type: "string" },
            qty: { type: "number" },
            satuan: { type: "string" },
            harga: { type: "number" },
            jumlah: { type: "number" },
            keterangan: { type: "string" },
          },
        },
      },
      total_belanja: { type: "number" },
      pagu_harian: { type: "number" },
      selisih: { type: "number" },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
    },
  };
}

function buildExtractionPrompt(fileName = "") {
  return [
    "Anda mengekstrak draft laporan belanja harian dari gambar tabel, nota, atau lembar belanja.",
    "Kembalikan JSON sesuai schema yang diberikan, tanpa teks tambahan.",
    "Aturan penting:",
    "1. Ambil data semaksimal mungkin dari gambar.",
    "2. Normalisasi semua nilai rupiah menjadi angka bersih tanpa simbol Rp dan tanpa pemisah ribuan.",
    "3. Untuk qty, harga, jumlah, total_belanja, pagu_harian, dan selisih, gunakan number JSON.",
    "4. Jika data tidak terbaca atau tidak yakin, isi string kosong atau 0 sesuai konteks dan tambahkan penjelasan pada warnings.",
    "5. Jangan mengarang item, tanggal, nama menu, atau nominal yang tidak tampak di gambar.",
    "6. Jika total item tidak cocok dengan total laporan, tambahkan warning.",
    "7. Jika gambar tampak hanya sebagian, buram, atau ambigu, tambahkan warning.",
    "8. Gunakan format tanggal YYYY-MM-DD hanya jika tanggal benar-benar dapat dinormalisasi dengan yakin.",
    `9. Nama file referensi: ${fileName || "tanpa-nama-file"}.`,
  ].join("\n");
}

function sanitizeDraftNumber(value) {
  const number = normalizeDraftCurrency(value, { allowNegative: false });
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return number;
}

function normalizeDraftCurrency(value, { allowNegative = true } = {}) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    if (!allowNegative && value < 0) return 0;
    return value;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const cleaned = raw
    .replace(/rp/gi, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") {
    return 0;
  }

  let normalized = cleaned;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const fractionalLength = normalized.length - lastComma - 1;
    normalized =
      fractionalLength > 0 && fractionalLength <= 2
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  const number = Number(normalized);
  if (!Number.isFinite(number)) return 0;
  if (!allowNegative && number < 0) return 0;
  return number;
}

function sanitizeExtractedDraft(rawDraft) {
  const items = Array.isArray(rawDraft?.items)
    ? rawDraft.items.map((item) => ({
        uraian: String(item?.uraian || "").trim(),
        qty: sanitizeDraftNumber(item?.qty),
        satuan: String(item?.satuan || "").trim(),
        harga: sanitizeDraftNumber(item?.harga),
        jumlah:
          item?.jumlah === "" || item?.jumlah == null
            ? sanitizeDraftNumber(item?.qty) * sanitizeDraftNumber(item?.harga)
            : sanitizeDraftNumber(item?.jumlah),
        keterangan: String(item?.keterangan || "").trim(),
      }))
    : [];

  const normalizedReportDate = String(rawDraft?.report_date || "").trim();
  const reportDate =
    normalizedReportDate && DATE_REGEX.test(normalizedReportDate)
      ? normalizedReportDate
      : "";

  return {
    report_date: reportDate,
    menu_name: String(rawDraft?.menu_name || "").trim(),
    items,
    total_belanja: sanitizeDraftNumber(rawDraft?.total_belanja),
    pagu_harian: sanitizeDraftNumber(rawDraft?.pagu_harian),
    selisih: normalizeDraftCurrency(rawDraft?.selisih),
    warnings: Array.isArray(rawDraft?.warnings)
      ? rawDraft.warnings.map((warning) => String(warning || "").trim()).filter(Boolean)
      : [],
  };
}

function extractGeminiTextResponse(data) {
  const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : null;
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];

  for (const part of parts) {
    if (typeof part?.text === "string" && part.text.trim()) {
      return part.text;
    }
  }

  return null;
}

async function requestShoppingDraftFromGemini({ buffer, mimeType, fileName }) {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error(
      "Fitur import gambar belum aktif. Isi GEMINI_API_KEY di file server/.env lalu restart backend."
    );
    error.status = 500;
    throw error;
  }

  const requestPayload = {
    contents: [
      {
        parts: [
          {
            text: buildExtractionPrompt(fileName),
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: buffer.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: buildExtractionSchema(),
    },
  };

  const parseGeminiResponse = (data) => {
    if (data?.promptFeedback?.blockReason) {
      const error = new Error(
        `Permintaan ditolak Gemini: ${String(data.promptFeedback.blockReason)}.`
      );
      error.status = 400;
      throw error;
    }

    const finishReason = String(data?.candidates?.[0]?.finishReason || "").trim();
    if (finishReason && !["STOP", "MAX_TOKENS"].includes(finishReason)) {
      const error = new Error(
        `Gemini tidak menyelesaikan ekstraksi gambar dengan normal (${finishReason}).`
      );
      error.status = 502;
      throw error;
    }

    const outputText = extractGeminiTextResponse(data);
    if (!outputText) {
      const error = new Error("Gemini tidak mengembalikan draft JSON yang dapat dibaca.");
      error.status = 502;
      throw error;
    }

    try {
      return sanitizeExtractedDraft(JSON.parse(outputText));
    } catch (err) {
      const error = new Error("Draft JSON dari Gemini tidak valid.");
      error.status = 502;
      throw error;
    }
  };

  const requestWithModel = async (modelName) => {
    const endpoint = `${GEMINI_API_BASE_URL}/${encodeURIComponent(modelName)}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        "Gemini API gagal memproses gambar laporan belanja.";
      const error = new Error(message);
      error.status = response.status;
      error.code = data?.error?.status || null;
      throw error;
    }

    return parseGeminiResponse(data);
  };

  try {
    return await requestWithModel(GEMINI_MODEL);
  } catch (err) {
    const modelNotFound =
      err?.status === 404 &&
      String(err?.message || "").includes("not found for API version");
    const canFallback =
      modelNotFound &&
      GEMINI_FALLBACK_MODEL !== GEMINI_MODEL;

    if (!canFallback) {
      throw err;
    }

    const draft = await requestWithModel(GEMINI_FALLBACK_MODEL);
    draft.warnings = [
      ...draft.warnings,
      `Model ${GEMINI_MODEL} tidak tersedia; ekstraksi otomatis memakai ${GEMINI_FALLBACK_MODEL}.`,
    ];
    return draft;
  }
}

async function findShoppingReportById(id) {
  await ensureShoppingReportsTables();
  const [reports] = await pool.query(
    `SELECT id, report_date, menu_name, small_portion_count, large_portion_count, daily_budget, total_spending,
            difference_amount, item_count, notes, created_at, updated_at
       FROM shopping_reports
      WHERE id = ?`,
    [id]
  );

  if (!reports.length) return null;

  const [items] = await pool.query(
    `SELECT i.id, i.report_id, i.master_item_id, i.description, i.qty, i.unit_name, i.price, i.amount, i.notes, i.display_order,
            m.item_code AS master_item_code, m.item_name AS master_item_name
       FROM shopping_report_items i
       LEFT JOIN item_masters m ON m.id = i.master_item_id
      WHERE i.report_id = ?
      ORDER BY i.display_order ASC, i.id ASC`,
    [id]
  );

  return {
    ...reports[0],
    items,
  };
}

export async function listShoppingReports(req, res, next) {
  try {
    await ensureShoppingReportsTables();
    const [rows] = await pool.query(
      `SELECT id, report_date, menu_name, small_portion_count, large_portion_count, daily_budget, total_spending,
              difference_amount, item_count, notes, created_at, updated_at
         FROM shopping_reports
        ORDER BY report_date DESC, id DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getShoppingReportById(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid shopping report id." });
    }

    const report = await findShoppingReportById(id);
    if (!report) {
      return res.status(404).json({ error: "Shopping report not found." });
    }

    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function createShoppingReport(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await ensureShoppingReportsTables();
    const { payload, error } = normalizePayload(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO shopping_reports
        (report_date, menu_name, small_portion_count, large_portion_count, daily_budget, total_spending, difference_amount, item_count, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.report_date,
        payload.menu_name,
        payload.small_portion_count,
        payload.large_portion_count,
        payload.daily_budget,
        payload.total_spending,
        payload.difference_amount,
        payload.item_count,
        payload.notes || null,
      ]
    );

    const itemValues = payload.items.map((item) => [
      result.insertId,
      item.master_item_id,
      item.description,
      item.qty,
      item.unit_name,
      item.price,
      item.amount,
      item.notes || null,
      item.display_order,
    ]);

    await conn.query(
      `INSERT INTO shopping_report_items
        (report_id, master_item_id, description, qty, unit_name, price, amount, notes, display_order)
       VALUES ?`,
      [itemValues]
    );

    await conn.commit();

    const report = await findShoppingReportById(result.insertId);
    res.status(201).json({ ok: true, message: "Shopping report created.", data: report });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export async function updateShoppingReport(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await ensureShoppingReportsTables();
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid shopping report id." });
    }

    const { payload, error } = normalizePayload(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE shopping_reports
          SET report_date = ?,
              menu_name = ?,
              small_portion_count = ?,
              large_portion_count = ?,
              daily_budget = ?,
              total_spending = ?,
              difference_amount = ?,
              item_count = ?,
              notes = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        payload.report_date,
        payload.menu_name,
        payload.small_portion_count,
        payload.large_portion_count,
        payload.daily_budget,
        payload.total_spending,
        payload.difference_amount,
        payload.item_count,
        payload.notes || null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Shopping report not found." });
    }

    await conn.query(`DELETE FROM shopping_report_items WHERE report_id = ?`, [id]);

    const itemValues = payload.items.map((item) => [
      id,
      item.master_item_id,
      item.description,
      item.qty,
      item.unit_name,
      item.price,
      item.amount,
      item.notes || null,
      item.display_order,
    ]);

    await conn.query(
      `INSERT INTO shopping_report_items
        (report_id, master_item_id, description, qty, unit_name, price, amount, notes, display_order)
       VALUES ?`,
      [itemValues]
    );

    await conn.commit();

    const report = await findShoppingReportById(id);
    res.json({ ok: true, message: "Shopping report updated.", data: report });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export async function deleteShoppingReport(req, res, next) {
  try {
    await ensureShoppingReportsTables();
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid shopping report id." });
    }

    const [result] = await pool.query(`DELETE FROM shopping_reports WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Shopping report not found." });
    }

    res.json({ ok: true, message: "Shopping report deleted." });
  } catch (err) {
    next(err);
  }
}

export async function extractShoppingReportImage(req, res, next) {
  try {
    await ensureShoppingReportsTables();

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "File gambar wajib diunggah." });
    }

    const mimeType = String(file.mimetype || "").toLowerCase().trim();
    const fileName = String(file.originalname || "").trim();

    if (!IMAGE_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({
        error: "Format file tidak didukung. Gunakan jpg, jpeg, atau png.",
      });
    }

    const draft = await requestShoppingDraftFromGemini({
      buffer: file.buffer,
      mimeType,
      fileName,
    });

    res.json({
      ok: true,
      message: "Draft laporan belanja berhasil dibuat dari gambar.",
      draft,
    });
  } catch (err) {
    next(err);
  }
}
