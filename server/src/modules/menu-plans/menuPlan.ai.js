const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
const AI_PROVIDER = String(process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
const OPENROUTER_MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS) || 3000;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_CATEGORIES = new Set([
  "karbohidrat",
  "protein_hewani",
  "protein_nabati",
  "sayur",
  "buah",
]);
const VALID_PORTIONS = new Set(["all", "PMB", "PMK"]);
const DAY_NAME_TO_DOW = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  "jum'at": 5,
  sabtu: 6,
  minggu: 7,
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMenuPlanExtractionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "year",
      "month",
      "week_number",
      "start_date",
      "end_date",
      "items",
      "warnings",
    ],
    properties: {
      year: { type: "integer" },
      month: { type: "integer" },
      week_number: { type: "integer" },
      start_date: { type: "string" },
      end_date: { type: "string" },
      notes: { type: "string" },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "plan_date",
            "day_of_week",
            "category",
            "menu_name",
            "portion_target",
            "is_holiday",
          ],
          properties: {
            plan_date: { type: "string" },
            day_of_week: { type: "integer" },
            category: { type: "string" },
            menu_name: { type: "string" },
            portion_target: { type: "string" },
            is_holiday: { type: "boolean" },
          },
        },
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
    },
  };
}

function buildMenuPlanExtractionPrompt(fileName = "") {
  return [
    "Anda mengekstrak rencana menu mingguan SPPG dari sebuah gambar tabel menu.",
    "Output hanya JSON valid sesuai schema yang diberikan. Tanpa markdown. Tanpa penjelasan tambahan.",
    "",
    "Konteks tabel:",
    "- Tabel berisi rencana menu satu minggu untuk hari Senin sampai Sabtu (Minggu = LIBUR).",
    "- Baris pertama biasanya bertuliskan judul seperti 'MENU MEI 2026' dan baris di bawahnya 'MINGGU KE 2'.",
    "- Kolom pertama berisi kategori: KARBOHIDRAT, PROTEIN HEWANI, PROTEIN NABATI, SAYUR, BUAH.",
    "- Kolom selanjutnya untuk setiap hari: SENIN, SELASA, RABU, KAMIS, JUMAT/JUM'AT, SABTU. Tiap header hari biasanya ada sub-header tanggal (DD/MM/YYYY).",
    "- Sel bisa berisi satu atau lebih nama menu. Tag (PMB) berarti porsi besar, (PMK) berarti porsi kecil.",
    "- Sel bertuliskan 'LIBUR' artinya hari itu libur dan tidak ada menu.",
    "",
    "Aturan output:",
    "1. year, month, week_number diambil dari judul. Bulan dalam angka 1-12.",
    "2. start_date adalah tanggal Senin minggu itu, end_date tanggal Sabtu, format YYYY-MM-DD.",
    "3. day_of_week: 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu, 7=Minggu.",
    "4. Setiap sel non-kosong/non-libur menghasilkan satu atau lebih objek di items, satu objek per nama menu.",
    "5. Pertahankan capitalization persis seperti di gambar (UPPER CASE).",
    "6. Jika ada tag (PMB) atau (PMK), hapus dari menu_name dan set portion_target ke 'PMB' atau 'PMK'. Jika tidak ada tag, gunakan 'all'.",
    "7. Sel 'LIBUR' menghasilkan satu objek per kategori dengan menu_name='LIBUR', is_holiday=true, portion_target='all'.",
    "8. category harus salah satu dari: karbohidrat, protein_hewani, protein_nabati, sayur, buah (huruf kecil, snake_case).",
    "9. plan_date dihitung dari header tanggal di kolom hari (format YYYY-MM-DD).",
    "10. Jika ada inkonsistensi (mis. tanggal Kamis tertulis 12/05/2026 padahal seharusnya 14/05/2026), tetap gunakan urutan hari yang benar dan tambahkan warning.",
    "11. Jangan halusinasi nama menu yang tidak terlihat di gambar.",
    "12. Jika field tidak terbaca, kosongkan dan tambahkan warning.",
    `13. Nama file referensi: ${fileName || "tanpa-nama-file"}.`,
  ].join("\n");
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

function extractOpenRouterTextResponse(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("")
      .trim();
  }
  return null;
}

function parseJsonDraftFromText(text, invalidMessage) {
  const rawText = String(text || "").trim();
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1].trim() : rawText;
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    const error = new Error(invalidMessage, { cause: err });
    error.status = 502;
    throw error;
  }
}

function safeIsoDate(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().slice(0, 10);
  return DATE_REGEX.test(trimmed) ? trimmed : "";
}

function clampInt(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const truncated = Math.trunc(parsed);
  if (truncated < min || truncated > max) return null;
  return truncated;
}

function normalizeCategory(value) {
  const text = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s/-]+/g, "_");
  if (VALID_CATEGORIES.has(text)) return text;
  if (text.includes("karbo")) return "karbohidrat";
  if (text.includes("hewan")) return "protein_hewani";
  if (text.includes("nabat")) return "protein_nabati";
  if (text.includes("sayur")) return "sayur";
  if (text.includes("buah")) return "buah";
  return "";
}

function normalizePortion(value) {
  const text = String(value || "").toUpperCase().trim();
  if (VALID_PORTIONS.has(text)) return text;
  if (text === "PORSI BESAR") return "PMB";
  if (text === "PORSI KECIL") return "PMK";
  return "all";
}

function normalizeDayOfWeek(value, fallbackName) {
  const direct = clampInt(value, 1, 7);
  if (direct) return direct;
  const text = String(fallbackName || "").toLowerCase().trim();
  return DAY_NAME_TO_DOW[text] || null;
}

function sanitizeMenuPlanDraft(rawDraft, { fileName }) {
  const warnings = Array.isArray(rawDraft?.warnings)
    ? rawDraft.warnings.map((w) => String(w || "").trim()).filter(Boolean)
    : [];

  const year = clampInt(rawDraft?.year, 2000, 2100);
  const month = clampInt(rawDraft?.month, 1, 12);
  const weekNumber = clampInt(rawDraft?.week_number, 1, 6);
  const startDate = safeIsoDate(rawDraft?.start_date);
  const endDate = safeIsoDate(rawDraft?.end_date);

  if (!year) warnings.push("Tahun tidak terbaca dari gambar.");
  if (!month) warnings.push("Bulan tidak terbaca dari gambar.");
  if (!weekNumber) warnings.push("Nomor minggu tidak terbaca dari gambar.");
  if (!startDate) warnings.push("Tanggal mulai tidak terbaca dari gambar.");
  if (!endDate) warnings.push("Tanggal selesai tidak terbaca dari gambar.");

  const rawItems = Array.isArray(rawDraft?.items) ? rawDraft.items : [];
  const items = [];
  for (const raw of rawItems) {
    const dow = normalizeDayOfWeek(raw?.day_of_week, raw?.day_name);
    const category = normalizeCategory(raw?.category);
    const planDate = safeIsoDate(raw?.plan_date);
    const isHoliday = Boolean(raw?.is_holiday);
    const menuName = String(raw?.menu_name || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!dow || !category || !planDate) {
      warnings.push(
        `Item dilewati karena data tidak lengkap: ${JSON.stringify({
          day_of_week: raw?.day_of_week,
          category: raw?.category,
          plan_date: raw?.plan_date,
        })}`
      );
      continue;
    }

    if (!isHoliday && !menuName) {
      continue;
    }

    items.push({
      plan_date: planDate,
      day_of_week: dow,
      category,
      menu_name: isHoliday ? "LIBUR" : menuName,
      portion_target: isHoliday ? "all" : normalizePortion(raw?.portion_target),
      is_holiday: isHoliday,
      sort_order: 0,
    });
  }

  const sortKey = (item) =>
    `${item.day_of_week}-${item.category}-${item.is_holiday ? 1 : 0}`;
  items.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const orderCounter = new Map();
  for (const item of items) {
    const key = `${item.day_of_week}|${item.category}`;
    const next = (orderCounter.get(key) ?? -1) + 1;
    orderCounter.set(key, next);
    item.sort_order = next;
  }

  const notes =
    typeof rawDraft?.notes === "string" && rawDraft.notes.trim()
      ? rawDraft.notes.trim()
      : null;

  if (items.length === 0) {
    warnings.push("Tidak ada item menu yang berhasil diekstrak.");
  }

  return {
    year: year ?? null,
    month: month ?? null,
    week_number: weekNumber ?? null,
    start_date: startDate || "",
    end_date: endDate || "",
    notes,
    items,
    warnings,
    source: { fileName: fileName || "" },
  };
}

async function requestPlanDraftFromOpenRouter({ buffer, mimeType, fileName }) {
  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error(
      "Fitur import gambar belum aktif. OPENROUTER_API_KEY belum dikonfigurasi."
    );
    error.status = 500;
    throw error;
  }

  const prompt = [
    buildMenuPlanExtractionPrompt(fileName),
    "",
    "Kembalikan hanya JSON valid dengan struktur:",
    JSON.stringify(buildMenuPlanExtractionSchema()),
  ].join("\n");

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: OPENROUTER_MAX_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${buffer.toString("base64")}`,
              },
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      "OpenRouter API gagal memproses gambar rencana menu.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const outputText = extractOpenRouterTextResponse(data);
  if (!outputText) {
    const error = new Error("OpenRouter tidak mengembalikan draft JSON rencana menu.");
    error.status = 502;
    throw error;
  }

  const draft = sanitizeMenuPlanDraft(
    parseJsonDraftFromText(outputText, "Draft JSON rencana menu dari OpenRouter tidak valid."),
    { fileName }
  );
  draft.warnings = [
    ...draft.warnings,
    `Ekstraksi gambar memakai OpenRouter (${OPENROUTER_MODEL}).`,
  ];
  return draft;
}

async function requestPlanDraftFromGemini({ buffer, mimeType, fileName }) {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error(
      "Fitur import gambar belum aktif. Hubungi admin sistem untuk mengaktifkan integrasi Gemini."
    );
    error.status = 500;
    throw error;
  }

  const requestPayload = {
    contents: [
      {
        parts: [
          { text: buildMenuPlanExtractionPrompt(fileName) },
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
      responseJsonSchema: buildMenuPlanExtractionSchema(),
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
        `Gemini tidak menyelesaikan ekstraksi rencana menu dengan normal (${finishReason}).`
      );
      error.status = 502;
      throw error;
    }

    const outputText = extractGeminiTextResponse(data);
    if (!outputText) {
      const error = new Error("Gemini tidak mengembalikan draft JSON rencana menu.");
      error.status = 502;
      throw error;
    }

    return sanitizeMenuPlanDraft(
      parseJsonDraftFromText(outputText, "Draft JSON rencana menu dari Gemini tidak valid."),
      { fileName }
    );
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
        "Gemini API gagal memproses gambar rencana menu.";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return parseGeminiResponse(data);
  };

  const requestWithRetry = async (modelName, attempts = 3) => {
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

export async function requestMenuPlanDraftFromAi({ buffer, mimeType, fileName }) {
  if (AI_PROVIDER === "openrouter") {
    return requestPlanDraftFromOpenRouter({ buffer, mimeType, fileName });
  }
  return requestPlanDraftFromGemini({ buffer, mimeType, fileName });
}

export const MENU_PLAN_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
