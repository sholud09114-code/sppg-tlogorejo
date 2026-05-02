const DEFAULT_HIGH_WASTE_PERCENT = 5;
const DEFAULT_PM_DROP_PERCENT = 15;

function getDateRangeDayCount(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / 86400000) + 1;
}

function createRecommendation({
  id,
  level,
  icon,
  title,
  description,
  ctaLabel,
  ctaPage,
}) {
  return { id, level, icon, title, description, ctaLabel, ctaPage };
}

export function generateOperationalRecommendations(data = {}) {
  const recommendations = [];
  const highWastePercent = Number(data.highWastePercent || DEFAULT_HIGH_WASTE_PERCENT);
  const missingDailyCount = Number(data.missingDailyCount || 0);
  const expectedDailyDays =
    data.expectedDailyDays == null
      ? getDateRangeDayCount(data.startDate, data.endDate)
      : Number(data.expectedDailyDays || 0);
  const hasDailyDays = data.dailyDays != null;
  const hasMenuDays = data.menuDays != null;
  const dailyDays = Number(data.dailyDays || 0);
  const menuDays = Number(data.menuDays || 0);
  const highWasteCount = Number(data.highWasteCount || 0);
  const overBudgetCount = Number(data.overBudgetCount || 0);
  const wasteAveragePercent = Number(data.wasteAveragePercent || 0);

  if (data.dailyReportMissing || missingDailyCount > 0 || (hasDailyDays && expectedDailyDays && dailyDays < expectedDailyDays)) {
    const count = missingDailyCount || Math.max(Number(expectedDailyDays || 0) - dailyDays, 1);
    recommendations.push(
      createRecommendation({
        id: "complete-daily-report",
        level: count > 1 ? "critical" : "warning",
        icon: "daily",
        title: "Lengkapi laporan PM",
        description:
          count > 1
            ? `${count} hari laporan PM belum lengkap pada rentang ini.`
            : "Laporan PM belum diisi untuk tanggal utama.",
        ctaLabel: "Buka laporan",
        ctaPage: "daily",
      })
    );
  }

  if (data.menuReportMissing || (hasMenuDays && expectedDailyDays && menuDays < expectedDailyDays)) {
    const count = Math.max(Number(expectedDailyDays || 0) - menuDays, 1);
    recommendations.push(
      createRecommendation({
        id: "complete-menu-report",
        level: "warning",
        icon: "menuReports",
        title: "Isi laporan menu",
        description:
          count > 1
            ? `${count} hari belum punya laporan menu pada rentang ini.`
            : "Laporan menu belum tersedia untuk tanggal utama.",
        ctaLabel: "Buka menu",
        ctaPage: "menu-reports",
      })
    );
  }

  if (data.foodWasteMissing) {
    recommendations.push(
      createRecommendation({
        id: "complete-food-waste",
        level: "info",
        icon: "foodWaste",
        title: "Lengkapi sisa pangan",
        description: "Data sisa pangan belum tersedia, evaluasi porsi belum bisa lengkap.",
        ctaLabel: "Buka sisa",
        ctaPage: "food-waste",
      })
    );
  }

  if (data.highWaste || highWasteCount > 0 || wasteAveragePercent >= highWastePercent) {
    recommendations.push(
      createRecommendation({
        id: "review-food-waste",
        level: "warning",
        icon: "foodWaste",
        title: "Evaluasi menu dan porsi",
        description:
          highWasteCount > 0
            ? `${highWasteCount} hari memiliki sisa pangan tinggi.`
            : `Rata-rata sisa pangan mencapai ${wasteAveragePercent.toFixed(2)}%.`,
        ctaLabel: "Cek sisa",
        ctaPage: "food-waste",
      })
    );
  }

  if (data.overBudget || overBudgetCount > 0) {
    recommendations.push(
      createRecommendation({
        id: "review-shopping-budget",
        level: overBudgetCount > 1 ? "critical" : "warning",
        icon: "shoppingReports",
        title: "Cek item belanja",
        description:
          overBudgetCount > 1
            ? `${overBudgetCount} laporan belanja melebihi pagu.`
            : "Ada belanja yang melebihi pagu, cek item dan harga.",
        ctaLabel: "Cek belanja",
        ctaPage: "shopping-reports",
      })
    );
  }

  if (!recommendations.length) {
    recommendations.push(
      createRecommendation({
        id: "stable-operation",
        level: "success",
        icon: "statusFull",
        title: "Operasional stabil",
        description: "Tidak ada rekomendasi prioritas dari rule dasar saat ini.",
      })
    );
  }

  return recommendations;
}

function createAnomaly({
  id,
  level,
  icon,
  title,
  description,
  ctaLabel,
  ctaPage,
}) {
  return { id, level, icon, title, description, ctaLabel, ctaPage };
}

function normalizeReportDate(report, fields) {
  for (const field of fields) {
    if (report?.[field]) return String(report[field]);
  }
  return "";
}

function getPmDropAnomaly(dailyReports, thresholdPercent) {
  const sortedReports = [...(dailyReports || [])]
    .filter((report) => normalizeReportDate(report, ["report_date"]) && Number(report.total_pm || 0) > 0)
    .sort((left, right) => normalizeReportDate(left, ["report_date"]).localeCompare(normalizeReportDate(right, ["report_date"])));

  if (sortedReports.length < 2) return null;

  const latest = sortedReports[sortedReports.length - 1];
  const previous = sortedReports[sortedReports.length - 2];
  const latestPm = Number(latest.total_pm || 0);
  const previousPm = Number(previous.total_pm || 0);
  const previousDrop = previousPm > 0 ? ((previousPm - latestPm) / previousPm) * 100 : 0;

  if (previousDrop >= thresholdPercent) {
    return createAnomaly({
      id: "pm-drop-previous",
      level: previousDrop >= thresholdPercent * 2 ? "critical" : "warning",
      icon: "daily",
      title: "PM turun signifikan",
      description: `PM terbaru turun ${previousDrop.toFixed(1)}% dibanding laporan sebelumnya.`,
      ctaLabel: "Cek PM",
      ctaPage: "daily",
    });
  }

  const previousReports = sortedReports.slice(0, -1);
  const averagePm =
    previousReports.reduce((sum, report) => sum + Number(report.total_pm || 0), 0) /
    previousReports.length;
  const averageDrop = averagePm > 0 ? ((averagePm - latestPm) / averagePm) * 100 : 0;

  if (averageDrop >= thresholdPercent) {
    return createAnomaly({
      id: "pm-drop-average",
      level: averageDrop >= thresholdPercent * 2 ? "critical" : "warning",
      icon: "daily",
      title: "PM di bawah rata-rata",
      description: `PM terbaru ${averageDrop.toFixed(1)}% di bawah rata-rata range.`,
      ctaLabel: "Cek PM",
      ctaPage: "daily",
    });
  }

  return null;
}

export function generateOperationalAnomalies(data = {}) {
  const anomalies = [];
  const highWastePercent = Number(data.highWastePercent || DEFAULT_HIGH_WASTE_PERCENT);
  const pmDropPercent = Number(data.pmDropPercent || DEFAULT_PM_DROP_PERCENT);
  const dailyReports = Array.isArray(data.dailyReports) ? data.dailyReports : [];
  const menuReports = Array.isArray(data.menuReports) ? data.menuReports : [];
  const shoppingReports = Array.isArray(data.shoppingReports) ? data.shoppingReports : [];
  const foodWasteReports = Array.isArray(data.foodWasteReports) ? data.foodWasteReports : [];

  const pmDropAnomaly = getPmDropAnomaly(dailyReports, pmDropPercent);
  if (pmDropAnomaly) anomalies.push(pmDropAnomaly);

  const overBudgetCount = data.overBudget
    ? 1
    : shoppingReports.filter((report) => Number(report.difference_amount || 0) < 0).length;
  if (overBudgetCount > 0) {
    anomalies.push(
      createAnomaly({
        id: "shopping-over-budget",
        level: overBudgetCount > 1 ? "critical" : "warning",
        icon: "shoppingReports",
        title: "Belanja melebihi pagu",
        description:
          overBudgetCount > 1
            ? `${overBudgetCount} laporan belanja di atas pagu.`
            : "Ada laporan belanja yang melewati pagu harian.",
        ctaLabel: "Cek belanja",
        ctaPage: "shopping-reports",
      })
    );
  }

  const highWasteCount = data.highWaste
    ? 1
    : foodWasteReports.filter((report) => {
        const totalKg = Number(report.total_kg || 0);
        const portions = Number(report.total_portions || 0);
        if (!Number.isFinite(totalKg) || !Number.isFinite(portions) || portions <= 0) return false;
        return (totalKg / portions) * 100 >= highWastePercent;
      }).length;
  if (highWasteCount > 0) {
    anomalies.push(
      createAnomaly({
        id: "high-food-waste",
        level: highWasteCount > 1 ? "critical" : "warning",
        icon: "foodWaste",
        title: "Sisa pangan tinggi",
        description:
          highWasteCount > 1
            ? `${highWasteCount} hari sisa pangan melewati ${highWastePercent}%.`
            : `Sisa pangan melewati ${highWastePercent}% dari total porsi.`,
        ctaLabel: "Cek sisa",
        ctaPage: "food-waste",
      })
    );
  }

  const menuDates = new Set(menuReports.map((report) => normalizeReportDate(report, ["menu_date", "report_date"])));
  const shoppingDates = new Set(shoppingReports.map((report) => normalizeReportDate(report, ["report_date"])));
  const dailyDates = dailyReports.map((report) => normalizeReportDate(report, ["report_date"])).filter(Boolean);
  const dailyWithoutMenuCount = data.dailyWithoutMenu
    ? 1
    : dailyDates.filter((date) => !menuDates.has(date)).length;
  if (dailyWithoutMenuCount > 0) {
    anomalies.push(
      createAnomaly({
        id: "daily-without-menu",
        level: "warning",
        icon: "menuReports",
        title: "PM ada, menu belum ada",
        description:
          dailyWithoutMenuCount > 1
            ? `${dailyWithoutMenuCount} hari punya laporan PM tanpa laporan menu.`
            : "Laporan PM sudah ada, tetapi menu pada tanggal yang sama belum ada.",
        ctaLabel: "Cek menu",
        ctaPage: "menu-reports",
      })
    );
  }

  const shouldCheckShoppingCompleteness =
    Boolean(data.dailyWithoutShopping) || data.checkShoppingCompleteness || shoppingReports.length > 0;
  const dailyWithoutShoppingCount = data.dailyWithoutShopping
    ? 1
    : shouldCheckShoppingCompleteness
    ? dailyDates.filter((date) => !shoppingDates.has(date)).length
    : 0;
  if (dailyWithoutShoppingCount > 0) {
    anomalies.push(
      createAnomaly({
        id: "daily-without-shopping",
        level: dailyWithoutShoppingCount > 1 ? "critical" : "warning",
        icon: "shoppingReports",
        title: "PM ada, belanja belum ada",
        description:
          dailyWithoutShoppingCount > 1
            ? `${dailyWithoutShoppingCount} hari punya laporan PM tanpa laporan belanja.`
            : "Laporan PM sudah ada, tetapi laporan belanja belum tersedia.",
        ctaLabel: "Cek belanja",
        ctaPage: "shopping-reports",
      })
    );
  }

  if (!anomalies.length) {
    anomalies.push(
      createAnomaly({
        id: "no-main-anomaly",
        level: "success",
        icon: "statusFull",
        title: "Tidak ada anomali utama",
        description: "Rule dasar tidak menemukan kondisi operasional yang perlu ditandai.",
      })
    );
  }

  return anomalies;
}
