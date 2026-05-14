const CATEGORY_TO_COLUMN = {
  "PAUD/TK/KB": "tk_paud",
  "TK/PAUD": "tk_paud",
  TK: "tk_paud",
  PAUD: "tk_paud",
  SD: "sd",
  MI: "sd",
  SMP: "smp_setara",
  "SMP/MTS": "smp_setara",
  MTS: "smp_setara",
  SMA: "sma_setara",
  SMK: "sma_setara",
  MA: "sma_setara",
  PONPES: "ponpes",
  PONDOK: "ponpes",
  PESANTREN: "ponpes",
  SLB: "slb",
  BALITA: "balita",
  POSYANDU: "balita",
  BUMIL: "bumil",
  "IBU HAMIL": "bumil",
  BUSUI: "busui",
  "IBU MENYUSUI": "busui",
};

export const DAILY_CLIPBOARD_COLUMNS = [
  { key: "tk_paud", label: "TK / PAUD" },
  { key: "sd", label: "SD" },
  { key: "smp_setara", label: "SMP/SETARA" },
  { key: "sma_setara", label: "SMA/SETARA" },
  { key: "ponpes", label: "PONPES" },
  { key: "slb", label: "SLB" },
  { key: "guru_kader", label: "GURU & KADER" },
  { key: "balita", label: "BALITA" },
  { key: "bumil", label: "BUMIL" },
  { key: "busui", label: "BUSUI" },
];

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function resolveColumnKey(detail) {
  const candidates = [
    detail?.category,
    detail?.unit_category,
    detail?.group_type,
    detail?.unit_type,
    detail?.type,
    detail?.unit_name,
    detail?.name,
  ];

  for (const candidate of candidates) {
    const key = normalizeKey(candidate);
    if (!key) continue;
    if (CATEGORY_TO_COLUMN[key]) return CATEGORY_TO_COLUMN[key];
    for (const [token, column] of Object.entries(CATEGORY_TO_COLUMN)) {
      if (key.includes(token)) return column;
    }
  }
  return null;
}

function splitStudentVsStaff(detail) {
  const actual = Number(detail?.actual_pm || 0);
  if (actual <= 0) return { student: 0, staff: 0 };

  const studentTarget =
    Number(detail?.student_small_portion || 0) +
    Number(detail?.student_large_portion || 0);
  const staffTarget =
    Number(detail?.staff_small_portion || 0) +
    Number(detail?.staff_large_portion || 0);
  const total = studentTarget + staffTarget;

  if (total <= 0) {
    return { student: actual, staff: 0 };
  }
  if (staffTarget <= 0) return { student: actual, staff: 0 };
  if (studentTarget <= 0) return { student: 0, staff: actual };

  let student = Math.round((actual * studentTarget) / total);
  if (student > actual) student = actual;
  if (student < 0) student = 0;
  let staff = actual - student;

  if (student > studentTarget) {
    student = studentTarget;
    staff = actual - student;
  }
  if (staff > staffTarget) {
    staff = staffTarget;
    student = actual - staff;
  }

  return { student, staff };
}

export function buildDailyClipboardRow(report) {
  const totals = DAILY_CLIPBOARD_COLUMNS.reduce((acc, col) => {
    acc[col.key] = 0;
    return acc;
  }, {});
  const seenColumns = new Set();

  const details = Array.isArray(report?.details) ? report.details : [];
  for (const detail of details) {
    const columnKey = resolveColumnKey(detail);
    const { student, staff } = splitStudentVsStaff(detail);

    if (columnKey && columnKey !== "guru_kader") {
      totals[columnKey] += student;
      if (student > 0) seenColumns.add(columnKey);
    } else if (columnKey === "guru_kader") {
      totals.guru_kader += student + staff;
      if (student + staff > 0) seenColumns.add("guru_kader");
    } else {
      totals.guru_kader += student;
    }

    if (staff > 0 && columnKey !== "guru_kader") {
      totals.guru_kader += staff;
      seenColumns.add("guru_kader");
    }
  }

  return DAILY_CLIPBOARD_COLUMNS.map((col) => {
    const value = totals[col.key];
    if (!value || value <= 0) return "";
    return String(value);
  });
}

export function formatDailyClipboardText(report) {
  return buildDailyClipboardRow(report).join("\t");
}

function legacyCopyTextToClipboard(text) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    const previousActive = document.activeElement;
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (previousActive && typeof previousActive.focus === "function") {
      previousActive.focus({ preventScroll: true });
    }
    return ok;
  } catch (_err) {
    return false;
  }
}

export async function copyTextToClipboard(text) {
  if (text == null) return false;
  const value = String(text);

  if (legacyCopyTextToClipboard(value)) {
    return true;
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_err) {
      // fall through
    }
  }

  if (
    typeof window !== "undefined" &&
    typeof window.ClipboardItem !== "undefined" &&
    navigator.clipboard?.write
  ) {
    try {
      const item = new window.ClipboardItem({
        "text/plain": new Blob([value], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch (_err) {
      // fall through
    }
  }

  return false;
}

export function copyTextToClipboardSync(text) {
  if (text == null) return false;
  return legacyCopyTextToClipboard(String(text));
}
