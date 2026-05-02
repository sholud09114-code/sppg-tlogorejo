import { useMemo, useState } from "react";
import Toast from "../components/Toast.jsx";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import { StickyFormHeader } from "../components/ui/FormPatterns.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "../components/ui/appIcons.jsx";
import { fetchWeeklySummary } from "../api/dailyReportApi.js";
import { fetchFoodWasteReports, getCachedFoodWasteReports } from "../api/foodWasteApi.js";
import { REPORT_CATEGORY_ORDER as CATEGORY_ORDER } from "../shared/constants/reportConstants.js";
import {
  formatDateLong,
  formatMoney,
  formatNumber,
  formatWeight,
} from "../shared/utils/formatters.js";
import {
  generateOperationalAnomalies,
  generateOperationalRecommendations,
} from "../shared/utils/operationalRecommendations.js";

const HIGH_WASTE_PERCENT = 5;
const EMPTY_REPORTS = [];
const RECOMMENDATION_PRIORITY = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
};
const ANOMALY_RECOMMENDATION_DEDUP = {
  "shopping-over-budget": ["review-shopping-budget"],
  "daily-without-shopping": ["review-shopping-budget"],
  "high-food-waste": ["review-food-waste"],
  "daily-without-menu": ["complete-menu-report"],
};

function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function addDaysISO(baseDate, amount) {
  const date = new Date(`${baseDate}T00:00:00`);
  date.setDate(date.getDate() + amount);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function getDefaultRange() {
  const endDate = getTodayISO();
  return {
    start_date: addDaysISO(endDate, -6),
    end_date: endDate,
  };
}

function getMenuNames(report) {
  return [
    report.menu_name_1,
    report.menu_name_2,
    report.menu_name_3,
    report.menu_name_4,
    report.menu_name_5,
  ].filter(Boolean);
}

function renderMenuNames(report) {
  const names = getMenuNames(report);
  if (!names.length) return <span className="weekly-muted">Belum ada nama menu</span>;

  return (
    <div className="weekly-menu-list weekly-chip-list">
      {names.map((name) => (
        <span key={`${report.id}-${name}`}>{name}</span>
      ))}
    </div>
  );
}

function formatCompactNutrition(report, portionSize) {
  const prefix = portionSize === "small" ? "small" : "large";
  return `${formatNumber(report[`${prefix}_energy`])} kkal | P ${formatNumber(
    report[`${prefix}_protein`]
  )}g | L ${formatNumber(report[`${prefix}_fat`])}g | K ${formatNumber(
    report[`${prefix}_carbohydrate`]
  )}g`;
}

function getWastePercentage(report) {
  const totalKg = Number(report?.total_kg || 0);
  const portions = Number(report?.total_portions || 0);
  if (!Number.isFinite(totalKg) || !Number.isFinite(portions) || portions <= 0) return 0;
  return (totalKg / portions) * 100;
}

function filterReportsByDateRange(reports, startDate, endDate) {
  return reports.filter((report) => {
    const reportDate = String(report.report_date || "");
    return reportDate >= startDate && reportDate <= endDate;
  });
}

function DashboardSection({ icon, title, description, metrics, children, empty }) {
  return (
    <section className="weekly-dashboard-section">
      <div className="weekly-dashboard-section-head">
        <span className="weekly-section-icon">
          <AppIcon name={icon} size={22} weight={APP_ICON_WEIGHT.summary} />
        </span>
        <div className="min-w-0">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      {metrics?.length ? (
        <div className="weekly-section-metrics">
          {metrics.map((metric) => (
            <div className={`weekly-mini-metric ${metric.warning ? "warning" : ""}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {empty ? <div className="empty-state weekly-empty-state">{empty}</div> : children}
    </section>
  );
}

function RecommendationCard({ recommendation }) {
  return (
    <article className={`operational-recommendation-card ${recommendation.level}`}>
      <span className="operational-recommendation-icon">
        <AppIcon name={recommendation.icon} size={18} weight={APP_ICON_WEIGHT.summary} />
      </span>
      <div className="operational-recommendation-copy">
        <span>{recommendation.level}</span>
        <strong>{recommendation.title}</strong>
        <p>{recommendation.description}</p>
      </div>
      {recommendation.ctaLabel ? (
        <span className="operational-recommendation-cta passive">{recommendation.ctaLabel}</span>
      ) : null}
    </article>
  );
}

function AnomalyCard({ anomaly, onNavigate }) {
  return (
    <article className={`operational-anomaly-card ${anomaly.level}`}>
      <span className="operational-anomaly-icon">
        <AppIcon name={anomaly.icon} size={18} weight={APP_ICON_WEIGHT.summary} />
      </span>
      <div className="operational-anomaly-copy">
        <span>{anomaly.level}</span>
        <strong>{anomaly.title}</strong>
        <p>{anomaly.description}</p>
      </div>
      {anomaly.ctaPage ? (
        <button
          type="button"
          className="operational-anomaly-cta"
          onClick={() => onNavigate?.(anomaly.ctaPage)}
        >
          {anomaly.ctaLabel || "Buka"}
        </button>
      ) : null}
    </article>
  );
}

export default function WeeklyReports({ onNavigate }) {
  const [filters, setFilters] = useState(getDefaultRange);
  const [loading, setLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [foodWasteReports, setFoodWasteReports] = useState([]);
  const [weeklyError, setWeeklyError] = useState(null);
  const [foodWasteError, setFoodWasteError] = useState(null);
  const [foodWasteLoaded, setFoodWasteLoaded] = useState(false);
  const [toast, setToast] = useState({ kind: null, message: null });

  const handleChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!filters.start_date) {
      setToast({ kind: "warning", message: "Tanggal mulai wajib diisi." });
      return;
    }

    if (!filters.end_date) {
      setToast({ kind: "warning", message: "Tanggal selesai wajib diisi." });
      return;
    }

    if (filters.end_date < filters.start_date) {
      setToast({
        kind: "warning",
        message: "Tanggal selesai tidak boleh lebih kecil dari tanggal mulai.",
      });
      return;
    }

    try {
      setLoading(true);
      setWeeklyError(null);
      setFoodWasteError(null);
      setFoodWasteLoaded(false);
      const cachedFoodWaste = getCachedFoodWasteReports();
      const [weeklyResult, wasteResult] = await Promise.allSettled([
        fetchWeeklySummary(filters.start_date, filters.end_date),
        fetchFoodWasteReports({ force: Boolean(cachedFoodWaste) }),
      ]);

      if (weeklyResult.status === "fulfilled") {
        setReportData(weeklyResult.value);
      } else {
        setReportData(null);
        setWeeklyError(weeklyResult.reason?.message || "Gagal memuat weekly summary.");
      }

      if (wasteResult.status === "fulfilled") {
        setFoodWasteReports(filterReportsByDateRange(wasteResult.value, filters.start_date, filters.end_date));
        setFoodWasteLoaded(true);
      } else {
        setFoodWasteReports([]);
        setFoodWasteLoaded(false);
        setFoodWasteError(wasteResult.reason?.message || "Gagal memuat data sisa pangan.");
      }

      setHasSubmitted(true);
      if (weeklyResult.status === "rejected" && wasteResult.status === "rejected") {
        setToast({
          kind: "danger",
          message: "Semua sumber data gagal dimuat. Coba ulangi beberapa saat lagi.",
        });
      } else if (weeklyResult.status === "rejected" || wasteResult.status === "rejected") {
        setToast({
          kind: "warning",
          message: "Sebagian data gagal dimuat. Dashboard menampilkan data yang tersedia.",
        });
      } else {
        setToast({ kind: null, message: null });
      }
    } catch (err) {
      setReportData(null);
      setFoodWasteReports([]);
      setWeeklyError(err.message);
      setFoodWasteError(err.message);
      setFoodWasteLoaded(false);
      setHasSubmitted(true);
      setToast({
        kind: "danger",
        message: "Gagal memuat dashboard agregasi: " + err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const dailySummary = reportData?.daily_reports?.summary || null;
  const menuSummary = reportData?.menu_reports?.summary || null;
  const shoppingSummary = reportData?.shopping_reports?.summary || null;
  const dailyReports = reportData?.daily_reports?.reports || EMPTY_REPORTS;
  const menuReports = reportData?.menu_reports?.reports || EMPTY_REPORTS;
  const shoppingReports = reportData?.shopping_reports?.reports || EMPTY_REPORTS;

  const wasteSummary = useMemo(() => {
    const totalKg = foodWasteReports.reduce((sum, report) => sum + Number(report.total_kg || 0), 0);
    const totalPortions = foodWasteReports.reduce(
      (sum, report) => sum + Number(report.total_portions || 0),
      0
    );
    const highWasteCount = foodWasteReports.filter(
      (report) => getWastePercentage(report) >= HIGH_WASTE_PERCENT
    ).length;

    return {
      totalKg,
      totalPortions,
      totalReports: foodWasteReports.length,
      averagePercent: totalPortions > 0 ? (totalKg / totalPortions) * 100 : 0,
      highWasteCount,
    };
  }, [foodWasteReports]);

  const hasWeeklyData = Boolean(reportData);
  const hasDashboardData = hasWeeklyData || foodWasteLoaded;
  const weeklyUnavailableText = weeklyError ? "Weekly summary gagal dimuat." : null;
  const foodWasteUnavailableText = foodWasteError ? "Data sisa pangan gagal dimuat." : null;

  const anomalies = useMemo(
    () =>
      generateOperationalAnomalies({
        dailyReports: weeklyError ? [] : dailyReports,
        menuReports: weeklyError ? [] : menuReports,
        shoppingReports: weeklyError ? [] : shoppingReports,
        foodWasteReports: foodWasteError ? [] : foodWasteReports,
        checkShoppingCompleteness: !weeklyError,
        pmDropPercent: 15,
        highWastePercent: HIGH_WASTE_PERCENT,
      }),
    [dailyReports, foodWasteError, foodWasteReports, menuReports, shoppingReports, weeklyError]
  );

  const hasPrimaryAnomaly = anomalies.some((anomaly) => anomaly.level !== "success");

  const recommendations = useMemo(
    () =>
      generateOperationalRecommendations({
        startDate: filters.start_date,
        endDate: filters.end_date,
        dailyDays: weeklyError ? null : dailySummary?.total_days,
        menuDays: weeklyError ? null : menuSummary?.total_days,
        highWasteCount: foodWasteError ? 0 : wasteSummary.highWasteCount,
        wasteAveragePercent: foodWasteError ? 0 : wasteSummary.averagePercent,
        overBudgetCount: weeklyError
          ? 0
          : shoppingReports.filter((report) => Number(report.difference_amount || 0) < 0).length,
      }),
    [
      filters.end_date,
      filters.start_date,
      foodWasteError,
      menuSummary?.total_days,
      dailySummary?.total_days,
      shoppingReports,
      wasteSummary.averagePercent,
      wasteSummary.highWasteCount,
      weeklyError,
    ]
  );

  const visibleRecommendations = useMemo(() => {
    const suppressedRecommendationIds = new Set();

    anomalies.forEach((anomaly) => {
      if (anomaly.level === "success") return;

      (ANOMALY_RECOMMENDATION_DEDUP[anomaly.id] || []).forEach((recommendationId) => {
        suppressedRecommendationIds.add(recommendationId);
      });
    });

    return recommendations
      .filter((recommendation) => !suppressedRecommendationIds.has(recommendation.id))
      .sort(
        (left, right) =>
          (RECOMMENDATION_PRIORITY[left.level] ?? 99) -
          (RECOMMENDATION_PRIORITY[right.level] ?? 99)
      )
      .slice(0, 2);
  }, [anomalies, recommendations]);

  const rangeLabel = reportData?.range
    ? `${formatDateLong(reportData.range.start_date)} - ${formatDateLong(reportData.range.end_date)}`
    : `${formatDateLong(filters.start_date)} - ${formatDateLong(filters.end_date)}`;

  return (
    <>
      <section className="feature-page-card weekly-dashboard-page">
        <div className="page-title gap-4">
          <div className="min-w-0">
            <h2>Dashboard agregasi operasional</h2>
            <p>Rekap PM, menu, belanja, dan sisa pangan dalam satu rentang kerja.</p>
          </div>
        </div>

        <form className="weekly-dashboard-form" onSubmit={handleSubmit}>
          <StickyFormHeader className="weekly-dashboard-sticky">
            <div className="daily-editor-command-row weekly-dashboard-command-row">
              <div className="daily-editor-date-field weekly-range-field">
                <label htmlFor="weekly_start_date">Tanggal mulai</label>
                <input
                  id="weekly_start_date"
                  type="date"
                  value={filters.start_date}
                  onChange={(event) => handleChange("start_date", event.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="daily-editor-date-field weekly-range-field">
                <label htmlFor="weekly_end_date">Tanggal selesai</label>
                <input
                  id="weekly_end_date"
                  type="date"
                  value={filters.end_date}
                  onChange={(event) => handleChange("end_date", event.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="daily-editor-metric weekly-range-summary">
                <span>Rentang aktif</span>
                <strong>{rangeLabel}</strong>
              </div>

              <button type="submit" className="submit-btn weekly-dashboard-submit" disabled={loading}>
                <span className="button-with-icon">
                  <AppIcon name="weekly" size={18} weight={APP_ICON_WEIGHT.action} />
                  <span>{loading ? "Memuat..." : "Tampilkan dashboard"}</span>
                </span>
              </button>
            </div>
          </StickyFormHeader>
        </form>

        {!hasSubmitted ? (
          <div className="weekly-dashboard-empty">
            <AppIcon name="weekly" size={30} weight={APP_ICON_WEIGHT.summary} />
            <strong>Pilih rentang laporan</strong>
            <span>Default sudah disiapkan 7 hari terakhir. Klik tampilkan untuk melihat dashboard agregasi.</span>
          </div>
        ) : hasDashboardData ? (
          <div className="weekly-dashboard-content">
            {(weeklyError || foodWasteError) && (
              <section className="weekly-partial-state">
                <AppIcon name="statusPartial" size={20} weight={APP_ICON_WEIGHT.summary} />
                <div>
                  <strong>Data tampil parsial</strong>
                  <span>
                    {weeklyError ? `Weekly summary: ${weeklyError}` : "Weekly summary berhasil dimuat."}
                    {" "}
                    {foodWasteError ? `Sisa pangan: ${foodWasteError}` : "Sisa pangan berhasil dimuat."}
                  </span>
                </div>
              </section>
            )}

            <div className="weekly-kpi-grid">
              <SummaryMetricCard
                label="Total PM"
                value={weeklyError ? "Gagal dimuat" : formatNumber(dailySummary?.total_pm)}
                icon="beneficiaries"
                tone="blue"
                emphasis
                onClick={() => onNavigate?.("daily")}
                title="Klik untuk buka Laporan Harian"
              />
              <SummaryMetricCard
                label="Total belanja"
                value={weeklyError ? "Gagal dimuat" : formatMoney(shoppingSummary?.total_spending)}
                icon="money"
                tone={Number(shoppingSummary?.total_difference || 0) < 0 ? "amber" : "green"}
                onClick={() => onNavigate?.("shopping-reports")}
                title="Klik untuk buka Laporan Belanja"
              />
              <SummaryMetricCard
                label="Sisa pangan"
                value={foodWasteError ? "Gagal dimuat" : formatWeight(wasteSummary.totalKg)}
                helper="Sumber: data Sisa Pangan"
                icon="foodWaste"
                tone={wasteSummary.highWasteCount > 0 ? "amber" : "blue"}
                onClick={() => onNavigate?.("food-waste")}
                title="Klik untuk buka Sisa Pangan"
              />
              <SummaryMetricCard
                label="Hari terlapor"
                value={
                  weeklyError
                    ? "Gagal dimuat"
                    : `${formatNumber(dailySummary?.total_days)} PM / ${formatNumber(menuSummary?.total_days)} menu`
                }
                icon="date"
                tone="blue"
                onClick={() => onNavigate?.("menu-reports")}
                title="Klik untuk buka Laporan Menu"
              />
            </div>

            <section className={`weekly-insight-panel ${hasPrimaryAnomaly ? "has-warning" : ""}`}>
              <div className="weekly-insight-head">
                <span className="weekly-section-icon">
                  <AppIcon
                    name={hasPrimaryAnomaly ? "statusPartial" : "statusFull"}
                    size={22}
                    weight={APP_ICON_WEIGHT.summary}
                  />
                </span>
                <div>
                  <h3>{hasPrimaryAnomaly ? "Anomali operasional" : "Tidak ada anomali utama"}</h3>
                  <p>
                    {hasPrimaryAnomaly
                      ? `${anomalies.length} alert rule-based ditemukan pada rentang ini.`
                      : "Rule dasar tidak menemukan kondisi operasional yang perlu ditandai."}
                  </p>
                </div>
              </div>
              <div className="operational-anomaly-list weekly-anomaly-list">
                {anomalies.slice(0, 4).map((anomaly) => (
                  <AnomalyCard key={anomaly.id} anomaly={anomaly} onNavigate={onNavigate} />
                ))}
              </div>
              {visibleRecommendations.length ? (
                <div className="operational-recommendation-list weekly-recommendation-list">
                  {visibleRecommendations.map((recommendation) => (
                    <RecommendationCard key={recommendation.id} recommendation={recommendation} />
                  ))}
                </div>
              ) : null}
            </section>

            <div className="weekly-dashboard-grid">
              <DashboardSection
                icon="daily"
                title="PM"
                description="Akumulasi penerima manfaat dan porsi harian."
                metrics={[
                  { label: "Hari laporan", value: weeklyError ? "Tidak tersedia" : formatNumber(dailySummary?.total_days) },
                  { label: "Total PM", value: weeklyError ? "Tidak tersedia" : formatNumber(dailySummary?.total_pm) },
                  {
                    label: "Porsi kecil/besar",
                    value: weeklyError
                      ? "Tidak tersedia"
                      : `${formatNumber(
                          dailyReports.reduce((sum, report) => sum + Number(report.total_small_portion || 0), 0)
                        )} / ${formatNumber(
                          dailyReports.reduce((sum, report) => sum + Number(report.total_large_portion || 0), 0)
                        )}`,
                  },
                ]}
                empty={weeklyUnavailableText || (!dailyReports.length ? "Belum ada laporan PM harian pada rentang ini." : null)}
              >
                <div className="weekly-category-grid">
                  {CATEGORY_ORDER.map((category) => (
                    <div className="weekly-category-card" key={category}>
                      <span>{category}</span>
                      <strong>{formatNumber(dailySummary?.by_category?.[category])}</strong>
                    </div>
                  ))}
                </div>
                <div className="weekly-card-list">
                  {dailyReports.map((report) => (
                    <article className="weekly-compact-card" key={`daily-${report.report_id}`}>
                      <div>
                        <strong>{formatDateLong(report.report_date)}</strong>
                        <span>Total PM {formatNumber(report.total_pm)}</span>
                      </div>
                      <div className="weekly-compact-metrics">
                        <span>Kecil {formatNumber(report.total_small_portion)}</span>
                        <span>Besar {formatNumber(report.total_large_portion)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </DashboardSection>

              <DashboardSection
                icon="menuReports"
                title="Menu"
                description="Daftar menu dan indikator gizi utama."
                metrics={[
                  { label: "Hari menu", value: weeklyError ? "Tidak tersedia" : formatNumber(menuSummary?.total_days) },
                  { label: "Entri menu", value: weeklyError ? "Tidak tersedia" : formatNumber(menuSummary?.total_reports) },
                ]}
                empty={weeklyUnavailableText || (!menuReports.length ? "Belum ada laporan menu pada rentang ini." : null)}
              >
                <div className="weekly-card-list">
                  {menuReports.map((report) => (
                    <article className="weekly-compact-card weekly-menu-card" key={`menu-${report.id}`}>
                      <div>
                        <strong>{formatDateLong(report.menu_date)}</strong>
                        {renderMenuNames(report)}
                      </div>
                      <div className="weekly-nutrition-compact">
                        <span>Kecil: {formatCompactNutrition(report, "small")}</span>
                        <span>Besar: {formatCompactNutrition(report, "large")}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </DashboardSection>

              <DashboardSection
                icon="shoppingReports"
                title="Belanja"
                description="Kontrol total belanja, pagu, dan selisih."
                metrics={[
                  { label: "Hari belanja", value: weeklyError ? "Tidak tersedia" : formatNumber(shoppingSummary?.total_days) },
                  { label: "Total belanja", value: weeklyError ? "Tidak tersedia" : formatMoney(shoppingSummary?.total_spending) },
                  {
                    label: "Selisih pagu",
                    value: weeklyError ? "Tidak tersedia" : formatMoney(shoppingSummary?.total_difference),
                    warning: Number(shoppingSummary?.total_difference || 0) < 0,
                  },
                ]}
                empty={weeklyUnavailableText || (!shoppingReports.length ? "Belum ada laporan belanja pada rentang ini." : null)}
              >
                <div className="weekly-card-list">
                  {shoppingReports.map((report) => {
                    const overBudget = Number(report.difference_amount || 0) < 0;
                    return (
                      <article
                        className={`weekly-compact-card ${overBudget ? "weekly-card-warning" : ""}`}
                        key={`shopping-${report.id}`}
                      >
                        <div>
                          <strong>{formatDateLong(report.report_date)}</strong>
                          <span>{report.menu_name || "Menu belum tersedia"}</span>
                        </div>
                        <div className="weekly-compact-metrics">
                          <span>Belanja {formatMoney(report.total_spending)}</span>
                          <span className={overBudget ? "weekly-danger-text" : ""}>
                            Selisih {formatMoney(report.difference_amount)}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </DashboardSection>

              <DashboardSection
                icon="foodWaste"
                title="Sisa pangan"
                description="Ringkasan sisa pangan dari data sisa yang sudah ada."
                metrics={[
                  { label: "Hari sisa", value: foodWasteError ? "Tidak tersedia" : formatNumber(wasteSummary.totalReports) },
                  { label: "Total sisa", value: foodWasteError ? "Tidak tersedia" : formatWeight(wasteSummary.totalKg) },
                  {
                    label: "Rata-rata",
                    value: foodWasteError ? "Tidak tersedia" : `${wasteSummary.averagePercent.toFixed(2)}%`,
                    warning: wasteSummary.highWasteCount > 0,
                  },
                ]}
                empty={foodWasteUnavailableText || (!foodWasteReports.length ? "Belum ada data sisa pangan pada rentang ini." : null)}
              >
                <div className="weekly-card-list">
                  {foodWasteReports.map((report) => {
                    const percentage = getWastePercentage(report);
                    const highWaste = percentage >= HIGH_WASTE_PERCENT;
                    return (
                      <article
                        className={`weekly-compact-card ${highWaste ? "weekly-card-warning" : ""}`}
                        key={`waste-${report.id}`}
                      >
                        <div>
                          <strong>{formatDateLong(report.report_date)}</strong>
                          <span>{report.menu_notes || "Catatan menu belum tersedia"}</span>
                        </div>
                        <div className="weekly-compact-metrics">
                          <span>Sisa {formatWeight(report.total_kg)}</span>
                          <span className={highWaste ? "weekly-danger-text" : ""}>
                            {percentage.toFixed(2)}%
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </DashboardSection>
            </div>
          </div>
        ) : (
          <div className="empty-state mt-4">Data laporan tidak tersedia untuk rentang ini.</div>
        )}
      </section>

      <Toast kind={toast.kind} message={toast.message} />
    </>
  );
}
