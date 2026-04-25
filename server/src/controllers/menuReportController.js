import pool from "../config/db.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
const MENU_NAME_FIELDS = [
  "menu_name_1",
  "menu_name_2",
  "menu_name_3",
  "menu_name_4",
  "menu_name_5",
];
const SMALL_NUMBER_FIELDS = [
  "small_energy",
  "small_protein",
  "small_fat",
  "small_carbohydrate",
  "small_fiber",
];
const LARGE_NUMBER_FIELDS = [
  "large_energy",
  "large_protein",
  "large_fat",
  "large_carbohydrate",
  "large_fiber",
];
const ALL_NUMBER_FIELDS = [...SMALL_NUMBER_FIELDS, ...LARGE_NUMBER_FIELDS];
let ensureMenuReportsTablePromise;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ensureMenuReportsTable() {
  if (!ensureMenuReportsTablePromise) {
    ensureMenuReportsTablePromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS menu_reports (
          id INT AUTO_INCREMENT PRIMARY KEY,
          menu_date DATE NOT NULL,
          menu_name VARCHAR(150) NULL,
          menu_name_1 VARCHAR(150) NULL,
          menu_name_2 VARCHAR(150) NULL,
          menu_name_3 VARCHAR(150) NULL,
          menu_name_4 VARCHAR(150) NULL,
          menu_name_5 VARCHAR(150) NULL,
          energy DECIMAL(10,2) NOT NULL DEFAULT 0,
          protein DECIMAL(10,2) NOT NULL DEFAULT 0,
          fat DECIMAL(10,2) NOT NULL DEFAULT 0,
          carbohydrate DECIMAL(10,2) NOT NULL DEFAULT 0,
          fiber DECIMAL(10,2) NOT NULL DEFAULT 0,
          small_energy DECIMAL(10,2) NOT NULL DEFAULT 0,
          small_protein DECIMAL(10,2) NOT NULL DEFAULT 0,
          small_fat DECIMAL(10,2) NOT NULL DEFAULT 0,
          small_carbohydrate DECIMAL(10,2) NOT NULL DEFAULT 0,
          small_fiber DECIMAL(10,2) NOT NULL DEFAULT 0,
          large_energy DECIMAL(10,2) NOT NULL DEFAULT 0,
          large_protein DECIMAL(10,2) NOT NULL DEFAULT 0,
          large_fat DECIMAL(10,2) NOT NULL DEFAULT 0,
          large_carbohydrate DECIMAL(10,2) NOT NULL DEFAULT 0,
          large_fiber DECIMAL(10,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_menu_date (menu_date),
          INDEX idx_menu_name (menu_name)
        ) ENGINE=InnoDB`
      );

      const columnDefinitions = {
        menu_name_1: "VARCHAR(150) NULL",
        menu_name_2: "VARCHAR(150) NULL",
        menu_name_3: "VARCHAR(150) NULL",
        menu_name_4: "VARCHAR(150) NULL",
        menu_name_5: "VARCHAR(150) NULL",
        small_energy: "DECIMAL(10,2) NOT NULL DEFAULT 0",
        small_protein: "DECIMAL(10,2) NOT NULL DEFAULT 0",
        small_fat: "DECIMAL(10,2) NOT NULL DEFAULT 0",
        small_carbohydrate: "DECIMAL(10,2) NOT NULL DEFAULT 0",
        small_fiber: "DECIMAL(10,2) NOT NULL DEFAULT 0",
        large_energy: "DECIMAL(10,2) NOT NULL DEFAULT 0",
        large_protein: "DECIMAL(10,2) NOT NULL DEFAULT 0",
        large_fat: "DECIMAL(10,2) NOT NULL DEFAULT 0",
        large_carbohydrate: "DECIMAL(10,2) NOT NULL DEFAULT 0",
        large_fiber: "DECIMAL(10,2) NOT NULL DEFAULT 0",
      };

      for (const [columnName, columnSql] of Object.entries(columnDefinitions)) {
        const [rows] = await pool.query(
          `SHOW COLUMNS FROM menu_reports LIKE ?`,
          [columnName]
        );

        if (rows.length === 0) {
          await pool.query(
            `ALTER TABLE menu_reports ADD COLUMN ${columnName} ${columnSql}`
          );
        }
      }
    })().catch((err) => {
      ensureMenuReportsTablePromise = null;
      throw err;
    });
  }

  return ensureMenuReportsTablePromise;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function normalizePayload(body) {
  const menuDate = String(body.menu_date || "").trim();
  const menuNames = MENU_NAME_FIELDS.map((field) =>
    String(body[field] || "").trim()
  );
  const menuNameSummary = menuNames.filter(Boolean).join(", ");

  if (!menuDate || !DATE_REGEX.test(menuDate)) {
    return { error: "Field 'menu_date' is required in YYYY-MM-DD format." };
  }

  if (!menuNameSummary) {
    return { error: "Minimal satu nama menu wajib diisi." };
  }

  const payload = {
    menu_date: menuDate,
    menu_name: menuNameSummary,
  };

  MENU_NAME_FIELDS.forEach((field, index) => {
    payload[field] = menuNames[index];
  });

  for (const field of ALL_NUMBER_FIELDS) {
    const rawValue = body[field];
    const value = rawValue === "" || rawValue == null ? 0 : Number(rawValue);

    if (!Number.isFinite(value) || value < 0) {
      return { error: `Field '${field}' cannot be negative.` };
    }

    payload[field] = value;
  }

  return { payload };
}

function buildMenuExtractionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "report_date",
      "menu_items",
      "small_portion_nutrition",
      "large_portion_nutrition",
      "warnings",
    ],
    properties: {
      report_date: { type: "string" },
      menu_items: {
        type: "object",
        additionalProperties: false,
        required: ["menu_1", "menu_2", "menu_3", "menu_4", "menu_5"],
        properties: {
          menu_1: { type: "string" },
          menu_2: { type: "string" },
          menu_3: { type: "string" },
          menu_4: { type: "string" },
          menu_5: { type: "string" },
        },
      },
      small_portion_nutrition: {
        type: "object",
        additionalProperties: false,
        required: ["energy", "protein", "fat", "carbohydrate", "fiber"],
        properties: {
          energy: { type: "number" },
          protein: { type: "number" },
          fat: { type: "number" },
          carbohydrate: { type: "number" },
          fiber: { type: "number" },
        },
      },
      large_portion_nutrition: {
        type: "object",
        additionalProperties: false,
        required: ["energy", "protein", "fat", "carbohydrate", "fiber"],
        properties: {
          energy: { type: "number" },
          protein: { type: "number" },
          fat: { type: "number" },
          carbohydrate: { type: "number" },
          fiber: { type: "number" },
        },
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
    },
  };
}

function buildMenuExtractionPrompt(fileName = "") {
  return [
    "Anda mengekstrak draft laporan menu harian dari gambar poster menu.",
    "Output hanya JSON valid sesuai schema yang diberikan.",
    "Tanpa markdown. Tanpa penjelasan tambahan. Tanpa teks lain selain JSON.",
    "Aturan:",
    "1. Ambil tanggal poster jika terlihat jelas dan ubah ke format YYYY-MM-DD.",
    "2. Ambil nama menu yang tampil pada poster, isi ke menu_1 sampai menu_5.",
    "3. Ambil kandungan gizi untuk porsi kecil dan porsi besar secara terpisah.",
    "4. Normalisasi semua angka menjadi number JSON yang bersih.",
    "5. Abaikan elemen dekoratif, logo, ornamen, atau teks promosi yang bukan data inti.",
    "6. Jika field tidak terbaca, isi string kosong atau 0 sesuai konteks lalu tambahkan warning.",
    "7. Jangan halusinasi. Jangan membuat menu atau angka yang tidak terlihat di gambar.",
    "8. Jika gambar buram, terpotong, atau ambigu, tambahkan warning.",
    `9. Nama file referensi: ${fileName || "tanpa-nama-file"}.`,
  ].join("\n");
}

function normalizeExtractedNumber(value, { allowNegative = false } = {}) {
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

  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") {
    return 0;
  }

  let normalized = cleaned;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
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

function roundToTwoDecimals(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
}

function sanitizeNutritionBlock(block) {
  return {
    energy: roundToTwoDecimals(normalizeExtractedNumber(block?.energy)),
    protein: roundToTwoDecimals(normalizeExtractedNumber(block?.protein)),
    fat: roundToTwoDecimals(normalizeExtractedNumber(block?.fat)),
    carbohydrate: roundToTwoDecimals(normalizeExtractedNumber(block?.carbohydrate)),
    fiber: roundToTwoDecimals(normalizeExtractedNumber(block?.fiber)),
  };
}

function normalizePortionNutritionOrder(smallNutrition, largeNutrition) {
  const normalizedSmall = { ...smallNutrition };
  const normalizedLarge = { ...largeNutrition };
  let swappedFields = 0;

  for (const field of ["energy", "protein", "fat", "carbohydrate", "fiber"]) {
    const smallValue = Number(normalizedSmall[field] || 0);
    const largeValue = Number(normalizedLarge[field] || 0);

    if (smallValue > largeValue) {
      normalizedSmall[field] = largeValue;
      normalizedLarge[field] = smallValue;
      swappedFields += 1;
    }
  }

  return {
    smallNutrition: normalizedSmall,
    largeNutrition: normalizedLarge,
    swappedFields,
  };
}

function sanitizeMenuImageDraft(rawDraft) {
  const normalizedReportDate = String(rawDraft?.report_date || "").trim();
  const reportDate =
    normalizedReportDate && DATE_REGEX.test(normalizedReportDate)
      ? normalizedReportDate
      : "";
  const sanitizedSmallNutrition = sanitizeNutritionBlock(rawDraft?.small_portion_nutrition);
  const sanitizedLargeNutrition = sanitizeNutritionBlock(rawDraft?.large_portion_nutrition);
  const { smallNutrition, largeNutrition, swappedFields } = normalizePortionNutritionOrder(
    sanitizedSmallNutrition,
    sanitizedLargeNutrition
  );
  const warnings = Array.isArray(rawDraft?.warnings)
    ? rawDraft.warnings.map((warning) => String(warning || "").trim()).filter(Boolean)
    : [];

  if (swappedFields > 0) {
    warnings.push(
      "Sebagian nilai gizi ditata ulang otomatis agar porsi kecil berisi nilai lebih kecil daripada porsi besar."
    );
  }

  return {
    report_date: reportDate,
    menu_items: {
      menu_1: String(rawDraft?.menu_items?.menu_1 || "").trim(),
      menu_2: String(rawDraft?.menu_items?.menu_2 || "").trim(),
      menu_3: String(rawDraft?.menu_items?.menu_3 || "").trim(),
      menu_4: String(rawDraft?.menu_items?.menu_4 || "").trim(),
      menu_5: String(rawDraft?.menu_items?.menu_5 || "").trim(),
    },
    small_portion_nutrition: smallNutrition,
    large_portion_nutrition: largeNutrition,
    warnings,
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

async function requestMenuDraftFromGemini({ buffer, mimeType, fileName }) {
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
          { text: buildMenuExtractionPrompt(fileName) },
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
      responseJsonSchema: buildMenuExtractionSchema(),
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
        `Gemini tidak menyelesaikan ekstraksi poster menu dengan normal (${finishReason}).`
      );
      error.status = 502;
      throw error;
    }

    const outputText = extractGeminiTextResponse(data);
    if (!outputText) {
      const error = new Error("Gemini tidak mengembalikan draft JSON menu yang dapat dibaca.");
      error.status = 502;
      throw error;
    }

    try {
      return sanitizeMenuImageDraft(JSON.parse(outputText));
    } catch (err) {
      const error = new Error("Draft JSON menu dari Gemini tidak valid.");
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
        "Gemini API gagal memproses gambar poster menu.";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return parseGeminiResponse(data);
  };

  const requestWithRetry = async (modelName, attempts = 2) => {
    let lastError;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await requestWithModel(modelName);
      } catch (err) {
        lastError = err;
        const isHighDemand =
          err?.status === 429 ||
          String(err?.message || "").toLowerCase().includes("high demand");
        if (!isHighDemand || attempt === attempts - 1) {
          throw err;
        }
        await delay(1000 * (attempt + 1));
      }
    }

    throw lastError;
  };

  try {
    return await requestWithRetry(GEMINI_MODEL, 3);
  } catch (err) {
    const canFallback =
      err?.status === 404 &&
      String(err?.message || "").includes("not found for API version") &&
      GEMINI_FALLBACK_MODEL !== GEMINI_MODEL;

    if (!canFallback) {
      throw err;
    }

    const draft = await requestWithRetry(GEMINI_FALLBACK_MODEL, 3);
    draft.warnings = [
      ...draft.warnings,
      `Model ${GEMINI_MODEL} tidak tersedia; ekstraksi otomatis memakai ${GEMINI_FALLBACK_MODEL}.`,
    ];
    return draft;
  }
}

async function findMenuReportById(id) {
  await ensureMenuReportsTable();
  const [rows] = await pool.query(
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
            COALESCE(large_fiber, 0) AS large_fiber,
            created_at, updated_at
       FROM menu_reports
      WHERE id = ?`,
    [id]
  );

  return rows[0] || null;
}

export async function listMenuReports(req, res, next) {
  try {
    await ensureMenuReportsTable();
    const [rows] = await pool.query(
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
              COALESCE(large_fiber, 0) AS large_fiber,
              created_at, updated_at
         FROM menu_reports
        ORDER BY menu_date DESC, id DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getMenuReportById(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid menu report id." });
    }

    const row = await findMenuReportById(id);
    if (!row) {
      return res.status(404).json({ error: "Menu report not found." });
    }

    res.json(row);
  } catch (err) {
    next(err);
  }
}

export async function createMenuReport(req, res, next) {
  try {
    await ensureMenuReportsTable();
    const { payload, error } = normalizePayload(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    const [result] = await pool.query(
      `INSERT INTO menu_reports
        (
          menu_date, menu_name,
          menu_name_1, menu_name_2, menu_name_3, menu_name_4, menu_name_5,
          energy, protein, fat, carbohydrate, fiber,
          small_energy, small_protein, small_fat, small_carbohydrate, small_fiber,
          large_energy, large_protein, large_fat, large_carbohydrate, large_fiber
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.menu_date,
        payload.menu_name,
        payload.menu_name_1,
        payload.menu_name_2,
        payload.menu_name_3,
        payload.menu_name_4,
        payload.menu_name_5,
        payload.small_energy,
        payload.small_protein,
        payload.small_fat,
        payload.small_carbohydrate,
        payload.small_fiber,
        payload.small_energy,
        payload.small_protein,
        payload.small_fat,
        payload.small_carbohydrate,
        payload.small_fiber,
        payload.large_energy,
        payload.large_protein,
        payload.large_fat,
        payload.large_carbohydrate,
        payload.large_fiber,
      ]
    );

    const row = await findMenuReportById(result.insertId);
    res.status(201).json({
      ok: true,
      message: "Menu report created.",
      data: row,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMenuReport(req, res, next) {
  try {
    await ensureMenuReportsTable();
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid menu report id." });
    }

    const { payload, error } = normalizePayload(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    const [result] = await pool.query(
      `UPDATE menu_reports
          SET menu_date = ?,
              menu_name = ?,
              menu_name_1 = ?,
              menu_name_2 = ?,
              menu_name_3 = ?,
              menu_name_4 = ?,
              menu_name_5 = ?,
              energy = ?,
              protein = ?,
              fat = ?,
              carbohydrate = ?,
              fiber = ?,
              small_energy = ?,
              small_protein = ?,
              small_fat = ?,
              small_carbohydrate = ?,
              small_fiber = ?,
              large_energy = ?,
              large_protein = ?,
              large_fat = ?,
              large_carbohydrate = ?,
              large_fiber = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        payload.menu_date,
        payload.menu_name,
        payload.menu_name_1,
        payload.menu_name_2,
        payload.menu_name_3,
        payload.menu_name_4,
        payload.menu_name_5,
        payload.small_energy,
        payload.small_protein,
        payload.small_fat,
        payload.small_carbohydrate,
        payload.small_fiber,
        payload.small_energy,
        payload.small_protein,
        payload.small_fat,
        payload.small_carbohydrate,
        payload.small_fiber,
        payload.large_energy,
        payload.large_protein,
        payload.large_fat,
        payload.large_carbohydrate,
        payload.large_fiber,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Menu report not found." });
    }

    const row = await findMenuReportById(id);
    res.json({
      ok: true,
      message: "Menu report updated.",
      data: row,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteMenuReport(req, res, next) {
  try {
    await ensureMenuReportsTable();
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid menu report id." });
    }

    const [result] = await pool.query(`DELETE FROM menu_reports WHERE id = ?`, [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Menu report not found." });
    }

    res.json({ ok: true, message: "Menu report deleted." });
  } catch (err) {
    next(err);
  }
}

export async function extractMenuReportImage(req, res, next) {
  try {
    await ensureMenuReportsTable();

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

    const draft = await requestMenuDraftFromGemini({
      buffer: file.buffer,
      mimeType,
      fileName,
    });

    res.json({
      ok: true,
      message: "Draft menu berhasil dibuat dari gambar.",
      draft,
    });
  } catch (err) {
    next(err);
  }
}
