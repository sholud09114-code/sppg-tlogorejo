export const MENU_PLAN_CATEGORIES = [
  { key: "karbohidrat", label: "Karbohidrat" },
  { key: "protein_hewani", label: "Protein Hewani" },
  { key: "protein_nabati", label: "Protein Nabati" },
  { key: "sayur", label: "Sayur" },
  { key: "buah", label: "Buah" },
];

export const MENU_PLAN_DAYS = [
  { dow: 1, label: "Senin", short: "SEN" },
  { dow: 2, label: "Selasa", short: "SEL" },
  { dow: 3, label: "Rabu", short: "RAB" },
  { dow: 4, label: "Kamis", short: "KAM" },
  { dow: 5, label: "Jumat", short: "JUM" },
  { dow: 6, label: "Sabtu", short: "SAB" },
];

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date, count) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + count);
  return next;
}

// Returns the Monday of the week containing the given date (Mon..Sat layout).
export function startOfWeekMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  const diff = (dow + 6) % 7; // Sunday->6, Monday->0, ...
  return addDays(d, -diff);
}

// Returns ISO week-number-ish anchored to the first Monday of the month.
// Week 1 starts on the first Monday, days before that count as week 1.
export function weekNumberOfMonth(date) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstMonday = startOfWeekMonday(firstOfMonth);
  const diffDays = Math.floor((date - firstMonday) / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / 7) + 1;
}

export function buildEmptyItems(startDate) {
  const items = [];
  MENU_PLAN_DAYS.forEach((day, dayIndex) => {
    const dateForDay = addDays(startDate, dayIndex);
    MENU_PLAN_CATEGORIES.forEach((cat, catIndex) => {
      items.push({
        plan_date: toIsoDate(dateForDay),
        day_of_week: day.dow,
        category: cat.key,
        menu_name: "",
        portion_target: "all",
        is_holiday: false,
        sort_order: catIndex,
      });
    });
  });
  return items;
}

// Convert a "lines" string and a set of portion-tags to one or more items.
// Pattern detection: lines like "AYAM RICA-RICA (PMB)" -> portion=PMB.
export function parseCellLines(rawText, dow, planDate, category) {
  const items = [];
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [
      {
        plan_date: planDate,
        day_of_week: dow,
        category,
        menu_name: "",
        portion_target: "all",
        is_holiday: false,
        sort_order: 0,
      },
    ];
  }

  lines.forEach((line, idx) => {
    let portion = "all";
    let cleaned = line;
    const match = line.match(/\(([^)]+)\)\s*$/);
    if (match) {
      const tag = match[1].trim().toUpperCase();
      if (tag === "PMB" || tag === "PMK") {
        portion = tag;
        cleaned = line.replace(/\s*\([^)]+\)\s*$/, "").trim();
      }
    }
    items.push({
      plan_date: planDate,
      day_of_week: dow,
      category,
      menu_name: cleaned,
      portion_target: portion,
      is_holiday: false,
      sort_order: idx,
    });
  });

  return items;
}

export function joinCellItems(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  if (items.some((item) => item.is_holiday)) return "";
  return items
    .filter((item) => item.menu_name)
    .map((item) =>
      item.portion_target && item.portion_target !== "all"
        ? `${item.menu_name} (${item.portion_target})`
        : item.menu_name
    )
    .join("\n");
}

export function isCellHoliday(items) {
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every((item) => item.is_holiday);
}

export function groupItemsByDayCategory(items) {
  const map = new Map();
  for (const item of items || []) {
    const key = `${item.day_of_week}|${item.category}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }
  return map;
}

export function monthLabel(month) {
  const labels = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return labels[month - 1] || String(month);
}

function smartTitleCase(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLocaleLowerCase("id-ID");
  return lower.charAt(0).toLocaleUpperCase("id-ID") + lower.slice(1);
}

function formatItemForCopy(item) {
  if (!item || !item.menu_name) return "";
  const baseText = smartTitleCase(item.menu_name);
  if (!baseText) return "";
  if (item.portion_target && item.portion_target !== "all") {
    return `${baseText} (${item.portion_target})`;
  }
  return baseText;
}

export function formatDayMenuForCopy(planOrItems, dayOfWeek) {
  const items = Array.isArray(planOrItems)
    ? planOrItems
    : Array.isArray(planOrItems?.items)
      ? planOrItems.items
      : [];

  const dayItems = items.filter((item) => item.day_of_week === dayOfWeek);
  if (dayItems.length === 0) return "";

  const isHoliday = dayItems.every((item) => item.is_holiday);
  if (isHoliday) return "LIBUR";

  const buckets = new Map();
  for (const item of dayItems) {
    if (!buckets.has(item.category)) buckets.set(item.category, []);
    buckets.get(item.category).push(item);
  }

  const categoryParts = [];
  for (const cat of MENU_PLAN_CATEGORIES) {
    const list = buckets.get(cat.key);
    if (!list || list.length === 0) continue;
    const sorted = [...list].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const text = sorted
      .map((item) => formatItemForCopy(item))
      .filter(Boolean)
      .join(" / ");
    if (text) categoryParts.push(text);
  }

  return categoryParts.join(", ");
}

export async function copyTextToClipboard(text) {
  if (!text) return false;
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_err) {
      // fall through to legacy approach
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch (_err) {
    return false;
  }
}
