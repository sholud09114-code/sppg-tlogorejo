import { collectWeeklyReportData } from "../weekly-reports/weeklyReport.repository.js";
import { getReportSettings } from "../weekly-reports/reportSettings.repository.js";
import { listDocumentationPhotos } from "../documentation/documentation.repository.js";

const ID_MONTHS = [
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
const ID_DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

function formatIdDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${ID_MONTHS[m - 1]} ${y}`;
}

function formatIdDateShort(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${m}/${y}`;
}

function formatPeriodLabel(startIso, endIso) {
  if (!startIso || !endIso) return "";
  const [, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  if (sm === em) {
    return `${sd} – ${ed} ${ID_MONTHS[em - 1]} ${ey}`;
  }
  return `${formatIdDate(startIso)} – ${formatIdDate(endIso)}`;
}

function dayLabel(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  return ID_DAYS[date.getDay()];
}

function splitLines(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function safeParseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const TARGET_LABEL = {
  "PAUD/TK/KB": "Siswa TK/PAUD/RA",
  SD: "Siswa SD/MI",
  SMP: "Siswa SMP/MTs",
  SMK: "Siswa SMA/MA/SMK",
};

const TARGET_ORDER = ["PAUD/TK/KB", "SD", "SMP", "SMK"];

function buildTargets(targetByCategory) {
  const rows = TARGET_ORDER.map((key) => ({
    category: TARGET_LABEL[key] || key,
    total: Number(targetByCategory?.[key] || 0),
  }));

  const extras = [
    { category: "Siswa keagamaan lainnya", total: "-" },
    { category: "Sekolah Luar Biasa", total: "-" },
    { category: "Ibu hamil (bumil)", total: "-" },
    { category: "Ibu menyusui (busui)", total: "-" },
    { category: "Anak balita", total: "-" },
  ];

  return [...rows, ...extras];
}

function totalTargetNumber(targets) {
  return targets.reduce((sum, row) => {
    const v = Number(row.total);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
}

function buildDailyRecipients(data, kecamatanLabel) {
  return data.dailyTables.map((day) => ({
    date: day.date,
    dayLabel: dayLabel(day.date),
    dateLabel: formatIdDate(day.date),
    totalBeneficiaries: Number(day.total_pm || 0),
    rows: day.rows.map((row, index) => {
      const isLibur =
        String(row.service_status || "").toLowerCase() === "libur" ||
        Number(row.actual_pm || 0) <= 0;
      return {
        no: index + 1,
        district: kecamatanLabel || "",
        schoolName: row.unit_name || "",
        address: row.unit_address || "",
        recipientCount: isLibur ? "Libur" : Number(row.actual_pm || 0),
      };
    }),
  }));
}

function servedSchoolsByDate(data) {
  return new Map(
    data.dailyTables.map((day) => [
      day.date,
      day.rows
        .filter(
          (row) =>
            String(row.service_status || "").toLowerCase() !== "libur" &&
            Number(row.actual_pm || 0) > 0
        )
        .map((row) => row.unit_name)
        .filter(Boolean),
    ])
  );
}

function servedSchoolsByDateFromDraft(draft) {
  return new Map(
    (draft.dailyRecipients || []).map((day) => [
      day.date,
      (day.rows || [])
        .filter((row) => String(row.recipientCount || "").toLowerCase() !== "libur")
        .filter((row) => Number(row.recipientCount || 0) > 0)
        .map((row) => row.schoolName)
        .filter(Boolean),
    ])
  );
}

function buildMenus(data, kabupatenLabel) {
  const schoolsByDate = servedSchoolsByDate(data);
  return data.dates.map((iso, index) => {
    const menu = data.menuByDate.get(iso);
    const items = menu
      ? [
          menu.menu_name_1,
          menu.menu_name_2,
          menu.menu_name_3,
          menu.menu_name_4,
          menu.menu_name_5,
        ].filter(Boolean)
      : [];
    return {
      no: index + 1,
      city: kabupatenLabel || "",
      schools: schoolsByDate.get(iso) || [],
      date: iso,
      dateLabel: `${dayLabel(iso)}, ${formatIdDateShort(iso)}`,
      menuItems: items.length > 0 ? items : menu?.menu_name ? [menu.menu_name] : [],
      note: "",
    };
  });
}

async function getMenuDocumentationByDate(startDate, endDate) {
  const photos = await listDocumentationPhotos({
    photoType: "menu_daily",
    startDate,
    endDate,
    limit: 1000,
  }).catch(() => []);
  const byDate = new Map();
  for (const photo of photos) {
    if (!photo.photo_date || byDate.has(photo.photo_date)) continue;
    byDate.set(photo.photo_date, photo);
  }
  return byDate;
}

function buildMenuPhotosScaffold(data, documentationByDate = new Map()) {
  const schoolsByDate = servedSchoolsByDate(data);
  return data.dates.map((iso, index) => ({
    id: documentationByDate.get(iso)?.id || null,
    no: index + 1,
    schools: schoolsByDate.get(iso) || [],
    date: iso,
    dateLabel: formatIdDateShort(iso),
    imageUrl: documentationByDate.get(iso)?.gdrive_file_id ? "auto-documentation" : "",
    gdriveFileId: documentationByDate.get(iso)?.gdrive_file_id || null,
    gdriveViewUrl: documentationByDate.get(iso)?.gdrive_view_url || null,
    source: documentationByDate.has(iso) ? "documentation" : "manual",
    sortOrder: index,
  }));
}

export async function applyDocumentationMenuPhotos(draft) {
  if (!draft?.range?.start_date || !draft?.range?.end_date) return draft;
  const schoolsByDate = servedSchoolsByDateFromDraft(draft);
  if (Array.isArray(draft.menus)) {
    draft.menus = draft.menus.map((menu) => ({
      ...menu,
      schools: schoolsByDate.get(menu.date) || menu.schools || [],
    }));
  }
  if (Array.isArray(draft.menuPhotos)) {
    draft.menuPhotos = draft.menuPhotos.map((photo) => ({
      ...photo,
      schools: schoolsByDate.get(photo.date) || photo.schools || [],
    }));
  }

  const documentationByDate = await getMenuDocumentationByDate(
    draft.range.start_date,
    draft.range.end_date
  );
  if (!documentationByDate.size) return draft;

  const menuPhotos = Array.isArray(draft.menuPhotos) ? draft.menuPhotos : [];
  draft.menuPhotos = menuPhotos.map((photo) => {
    if (!photo?.date || photo.gdriveFileId || photo.filename) return photo;
    const documentation = documentationByDate.get(photo.date);
    if (!documentation?.gdrive_file_id) return photo;
    return {
      ...photo,
      id: photo.id || documentation.id,
      imageUrl: photo.imageUrl || "auto-documentation",
      gdriveFileId: documentation.gdrive_file_id,
      gdriveViewUrl: documentation.gdrive_view_url || null,
      source: "documentation",
    };
  });
  return draft;
}

export async function buildWeeklyDraft({ startDate, endDate }) {
  const [settings, data] = await Promise.all([
    getReportSettings(),
    collectWeeklyReportData({ startDate, endDate }),
  ]);

  const periodLabel = formatPeriodLabel(startDate, endDate);
  const persiapan = safeParseJson(settings.narasi_persiapan_json, []);
  const targets = buildTargets(data.targetByCategory);
  const menuDocumentationByDate = await getMenuDocumentationByDate(startDate, endDate);

  const draft = {
    status: "draft",
    report: {
      title: "LAPORAN PELAKSANAAN",
      programName: "PROGRAM MAKAN BERGIZI GRATIS",
      sppgName: settings.sppg_name || "",
      sppgId: settings.sppg_id || "",
      foundationName: settings.yayasan_name || "",
      periodLabel,
      kecamatan: settings.kecamatan || "",
      city: settings.kabupaten || "",
      province: settings.provinsi || "",
    },
    range: {
      start_date: startDate,
      end_date: endDate,
    },
    chapters: {
      background: settings.narasi_latar_belakang || "",
      goals: splitLines(settings.narasi_tujuan),
      targets,
      targetTotal: totalTargetNumber(targets),
      preparation: Array.isArray(persiapan) ? persiapan : [],
      implementation:
        `Program makan bergizi gratis di beberapa sekolah di Kecamatan ${settings.kecamatan || ""} dapat memberikan berbagai lesson learned atau pembelajaran penting, antara lain:`.trim(),
      lessons: splitLines(settings.narasi_pelaksanaan_lessons),
      problems: splitLines(settings.narasi_kendala),
      solutions: splitLines(settings.narasi_penanganan),
      followUps: splitLines(settings.narasi_rencana_lanjut),
      closing: settings.narasi_penutup || "",
    },
    dailyRecipients: buildDailyRecipients(data, settings.kecamatan || ""),
    menus: buildMenus(data, settings.kabupaten || ""),
    activityPhotos: [],
    menuPhotos: buildMenuPhotosScaffold(data, menuDocumentationByDate),
    signatures: {
      placeDate: `${settings.kecamatan || ""}, ${formatIdDate(endDate)}`,
      leftTitle: `Ketua ${settings.yayasan_name || ""}`.trim(),
      leftName: settings.ketua_yayasan_name || "",
      rightTitle:
        `K.A Satuan Pemenuhan Gizi ${settings.sppg_name || ""}`.trim(),
      rightName: settings.kepala_sppg_name || "",
    },
  };

  return draft;
}

export const draftHelpers = {
  formatIdDate,
  formatIdDateShort,
  formatPeriodLabel,
  dayLabel,
};
