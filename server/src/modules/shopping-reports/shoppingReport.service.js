import {
  DATE_REGEX,
  IMAGE_MIME_TYPES,
  normalizeShoppingReportPayload,
  parseShoppingReportId,
} from "./shoppingReport.validators.js";
import {
  deleteShoppingReportById,
  ensureShoppingReportsTables,
  findShoppingReportById,
  insertShoppingReport,
  listShoppingReportRows,
  updateShoppingReportRecord,
} from "./shoppingReport.repository.js";
import { recordAuditLog } from "../../services/auditLogService.js";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireShoppingReportId(value) {
  const id = parseShoppingReportId(value);
  if (!id) {
    throw createHttpError("Invalid shopping report id.", 400);
  }
  return id;
}

function requireShoppingReportPayload(body) {
  const { payload, error } = normalizeShoppingReportPayload(body || {});
  if (error) {
    throw createHttpError(error, 400);
  }
  return payload;
}

function queueShoppingReportAudit({ userId, action, entityId, oldData = null, newData = null }) {
  void recordAuditLog({
    userId,
    action,
    entityType: "shopping_report",
    entityId,
    oldData,
    newData,
  });
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

function sanitizeDraftNumber(value) {
  const number = normalizeDraftCurrency(value, { allowNegative: false });
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
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
    throw createHttpError(
      "Fitur import gambar belum aktif. Hubungi admin sistem untuk mengaktifkan integrasi Gemini.",
      500
    );
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
      throw createHttpError(
        `Permintaan ditolak Gemini: ${String(data.promptFeedback.blockReason)}.`,
        400
      );
    }

    const finishReason = String(data?.candidates?.[0]?.finishReason || "").trim();
    if (finishReason && !["STOP", "MAX_TOKENS"].includes(finishReason)) {
      throw createHttpError(
        `Gemini tidak menyelesaikan ekstraksi gambar dengan normal (${finishReason}).`,
        502
      );
    }

    const outputText = extractGeminiTextResponse(data);
    if (!outputText) {
      throw createHttpError("Gemini tidak mengembalikan draft JSON yang dapat dibaca.", 502);
    }

    try {
      return sanitizeExtractedDraft(JSON.parse(outputText));
    } catch {
      throw createHttpError("Draft JSON dari Gemini tidak valid.", 502);
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
      const error = createHttpError(message, response.status);
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
    const canFallback = modelNotFound && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL;

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

export async function listShoppingReports() {
  return listShoppingReportRows();
}

export async function getShoppingReport(idValue) {
  await ensureShoppingReportsTables();
  const id = requireShoppingReportId(idValue);
  const report = await findShoppingReportById(id);
  if (!report) {
    throw createHttpError("Shopping report not found.", 404);
  }
  return report;
}

export async function createShoppingReport(body, userId = null) {
  await ensureShoppingReportsTables();
  const payload = requireShoppingReportPayload(body);
  const id = await insertShoppingReport(payload);
  const report = await findShoppingReportById(id);
  queueShoppingReportAudit({
    userId,
    action: "create",
    entityId: id,
    newData: report,
  });
  return report;
}

export async function updateShoppingReport(idValue, body, userId = null) {
  await ensureShoppingReportsTables();
  const id = requireShoppingReportId(idValue);
  const payload = requireShoppingReportPayload(body);
  const oldReport = await findShoppingReportById(id);
  if (!oldReport) {
    throw createHttpError("Shopping report not found.", 404);
  }

  const updated = await updateShoppingReportRecord(id, payload);
  if (!updated) {
    throw createHttpError("Shopping report not found.", 404);
  }

  const report = await findShoppingReportById(id);
  queueShoppingReportAudit({
    userId,
    action: "update",
    entityId: id,
    oldData: oldReport,
    newData: report,
  });
  return report;
}

export async function deleteShoppingReport(idValue, userId = null) {
  await ensureShoppingReportsTables();
  const id = requireShoppingReportId(idValue);
  const oldReport = await findShoppingReportById(id);
  if (!oldReport) {
    throw createHttpError("Shopping report not found.", 404);
  }

  const deleted = await deleteShoppingReportById(id);
  if (!deleted) {
    throw createHttpError("Shopping report not found.", 404);
  }

  queueShoppingReportAudit({
    userId,
    action: "delete",
    entityId: id,
    oldData: oldReport,
  });
}

export async function extractShoppingReportDraftFromImage(file) {
  await ensureShoppingReportsTables();

  if (!file) {
    throw createHttpError("File gambar wajib diunggah.", 400);
  }

  const mimeType = String(file.mimetype || "").toLowerCase().trim();
  const fileName = String(file.originalname || "").trim();

  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    throw createHttpError("Format file tidak didukung. Gunakan jpg, jpeg, atau png.", 400);
  }

  return requestShoppingDraftFromGemini({
    buffer: file.buffer,
    mimeType,
    fileName,
  });
}
