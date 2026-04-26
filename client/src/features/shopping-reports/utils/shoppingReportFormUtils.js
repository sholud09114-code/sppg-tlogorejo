export const UNIT_OPTIONS = ["kg", "gram", "liter", "ml", "pack", "pcs", "ikat", "buah"];
export const SMALL_PORTION_RATE = 8000;
export const LARGE_PORTION_RATE = 10000;

export function createEmptyItem() {
  return {
    master_item_id: null,
    item_lookup: "",
    description: "",
    show_suggestions: false,
    qty: 0,
    unit_name: "",
    price: 0,
    amount: 0,
    notes: "",
  };
}

export function getInitialState(initialData) {
  return {
    report_date: initialData?.report_date || "",
    menu_name: initialData?.menu_name || "",
    small_portion_count: initialData?.small_portion_count ?? 0,
    large_portion_count: initialData?.large_portion_count ?? 0,
    notes: initialData?.notes || "",
    items:
      initialData?.items?.length > 0
        ? initialData.items.map((item) => ({
            master_item_id: item.master_item_id ?? null,
            item_lookup: item.master_item_code
              ? `${item.master_item_code} - ${item.master_item_name || item.description}`
              : item.description || "",
            description: item.description || "",
            show_suggestions: false,
            qty: Number(item.qty ?? 0),
            unit_name: item.unit_name || "",
            price: Number(item.price ?? 0),
            amount: Number(item.amount ?? 0),
            notes: item.notes || "",
          }))
        : [createEmptyItem()],
  };
}

export function getMenuReportName(report) {
  const names = [
    report?.menu_name_1,
    report?.menu_name_2,
    report?.menu_name_3,
    report?.menu_name_4,
    report?.menu_name_5,
  ].filter(Boolean);

  return names.join(", ") || report?.menu_name || "";
}

export function getUnitOptions(currentValue) {
  return Array.from(
    new Set([String(currentValue || "").trim(), ...UNIT_OPTIONS].filter(Boolean))
  );
}

function normalizeSuggestionText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSuggestionTokens(value) {
  return normalizeSuggestionText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

export function scoreMasterItemSuggestion(masterItem, query) {
  const normalizedQuery = normalizeSuggestionText(query);
  if (!normalizedQuery) return -1;

  const queryTokens = buildSuggestionTokens(normalizedQuery);
  if (!queryTokens.length) return -1;

  const itemCode = normalizeSuggestionText(masterItem?.item_code);
  const itemName = normalizeSuggestionText(masterItem?.item_name);
  const haystack = `${itemCode} ${itemName}`.trim();
  if (!haystack) return -1;

  let score = 0;

  if (itemName.includes(normalizedQuery)) score += 120;
  if (itemCode.includes(normalizedQuery)) score += 100;

  for (const token of queryTokens) {
    if (itemName.includes(token)) {
      score += token.length >= 4 ? 40 : 25;
      continue;
    }

    if (itemCode.includes(token)) {
      score += 20;
      continue;
    }

    const itemTokens = haystack.split(" ");
    const nearMatch = itemTokens.some(
      (itemToken) =>
        itemToken.startsWith(token) ||
        token.startsWith(itemToken) ||
        itemToken.includes(token) ||
        token.includes(itemToken)
    );

    if (nearMatch) {
      score += 10;
      continue;
    }

    return -1;
  }

  if (itemName.startsWith(queryTokens[0])) score += 20;
  if (queryTokens.length > 1) score += queryTokens.length * 5;

  return score;
}

export function matchesMasterItemExactly(masterItem, value) {
  const normalizedValue = normalizeSuggestionText(value);
  if (!normalizedValue) return false;

  const itemCode = normalizeSuggestionText(masterItem?.item_code);
  const itemName = normalizeSuggestionText(masterItem?.item_name);
  const lookupLabel = normalizeSuggestionText(
    [masterItem?.item_code, masterItem?.item_name].filter(Boolean).join(" - ")
  );

  return (
    normalizedValue === itemCode ||
    normalizedValue === itemName ||
    normalizedValue === lookupLabel
  );
}

export function formatImageDraftError(message) {
  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    return "Gagal memproses gambar.";
  }

  if (
    normalizedMessage.includes("GEMINI_API_KEY") ||
    normalizedMessage.includes("server/.env") ||
    normalizedMessage.includes("Fitur import gambar belum aktif")
  ) {
    return "Fitur import gambar belum aktif. Isi GEMINI_API_KEY di file server/.env, lalu restart backend (`cd server && npm run dev`).";
  }

  return normalizedMessage;
}
