import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import LoadingMessage from "../components/LoadingMessage.jsx";
import Toast from "../components/Toast.jsx";
import { fetchHomeSummary } from "../api/dailyReportApi.js";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "../components/ui/appIcons.jsx";
import { formatDateLong, formatKg, formatNumber } from "../shared/utils/formatters.js";
import {
  generateOperationalAnomalies,
  generateOperationalRecommendations,
} from "../shared/utils/operationalRecommendations.js";

function HomeActionCard({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  icon = "empty",
  strong = false,
}) {
  return (
    <div className={`summary-card home-feature-card home-action-card ${strong ? "home-feature-card-strong" : "home-empty-card"}`}>
      <div className="home-feature-icon-wrap">
        <div className="summary-metric-icon summary-metric-icon-blue">
          <AppIcon name={icon} weight={APP_ICON_WEIGHT.summary} />
        </div>
      </div>
      <div className="home-feature-main">
        {eyebrow ? <span className="summary-card-label">{eyebrow}</span> : null}
        <strong className="home-feature-title">{title}</strong>
        {description ? <span className="home-summary-helper">{description}</span> : null}
      </div>
      <button type="button" className="submit-btn home-link-btn" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}

function HomeHistoryEmpty({ eyebrow, title, description }) {
  return (
    <div className="home-history-empty">
      {eyebrow ? <span>{eyebrow}</span> : null}
      <strong>{title}</strong>
      <small>{description}</small>
    </div>
  );
}

function HomeStatusPill({ ok, children }) {
  return (
    <span className={`home-status-pill ${ok ? "complete" : "pending"}`}>
      <AppIcon
        name={ok ? "statusFull" : "statusPartial"}
        size={14}
        weight={APP_ICON_WEIGHT.action}
      />
      {children}
    </span>
  );
}

function HomeQuickAction({ icon, title, description, actionLabel, onAction, primary = false }) {
  return (
    <button
      type="button"
      className={`home-quick-action ${primary ? "primary" : ""}`}
      onClick={onAction}
    >
      <span className="home-quick-action-icon">
        <AppIcon name={icon} size={22} weight={APP_ICON_WEIGHT.summary} />
      </span>
      <span className="home-quick-action-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="home-quick-action-cta">{actionLabel}</span>
    </button>
  );
}

function HomeChecklistItem({ icon, title, description, ok, actionLabel, onAction }) {
  return (
    <div className={`home-checklist-item ${ok ? "complete" : "pending"}`}>
      <span className="home-checklist-icon">
        <AppIcon name={icon} size={20} weight={APP_ICON_WEIGHT.summary} />
      </span>
      <span className="home-checklist-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <HomeStatusPill ok={ok}>{ok ? "Lengkap" : "Perlu input"}</HomeStatusPill>
      {actionLabel ? (
        <button type="button" className="home-checklist-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function HomePrimaryCta({ completed, label, description, onClick }) {
  return (
    <button
      type="button"
      className={`home-primary-continue ${completed ? "complete" : ""}`}
      onClick={onClick}
    >
      <span className="home-primary-continue-icon">
        <AppIcon name={completed ? "statusFull" : "send"} size={22} weight={APP_ICON_WEIGHT.summary} />
      </span>
      <span className="home-primary-continue-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="home-primary-continue-cta">{completed ? "Lihat" : "Lanjut"}</span>
    </button>
  );
}

function RecommendationCard({ recommendation, onNavigate }) {
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
      {recommendation.ctaPage ? (
        <button
          type="button"
          className="operational-recommendation-cta"
          onClick={() => onNavigate?.(recommendation.ctaPage)}
        >
          {recommendation.ctaLabel || "Buka"}
        </button>
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

const DAILY_AUTO_OPEN_KEY = "sppg:auto-open-daily-report";

function openDailyInput(onNavigate) {
  window.sessionStorage?.setItem(DAILY_AUTO_OPEN_KEY, "1");
  onNavigate?.("daily");
}

const LEVEL_PRIORITY = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
};

const CHECKLIST_RECOMMENDATION_IDS = new Set([
  "complete-daily-report",
  "complete-menu-report",
  "complete-food-waste",
]);

function sortByLevel(items) {
  return [...items].sort(
    (left, right) => (LEVEL_PRIORITY[left.level] ?? 9) - (LEVEL_PRIORITY[right.level] ?? 9)
  );
}

export default function Home({ onNavigate }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [toast, setToast] = useState({ kind: null, message: null });

  useEffect(() => {
    fetchHomeSummary()
      .then((data) => {
        setSummary(data);
        setToast({ kind: null, message: null });
      })
      .catch((err) => {
        setToast({
          kind: "danger",
          message: "Gagal memuat ringkasan home: " + err.message,
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <LoadingMessage>Memuat ringkasan dashboard...</LoadingMessage>;
  }

  const primaryDate = summary?.today_date;
  const dailyReport = summary?.daily_report;
  const menuReport = summary?.menu_report;
  const foodWaste = summary?.food_waste;
  const todayLong = formatDateLong(primaryDate);
  const yesterdayLong = formatDateLong(summary?.yesterday_date);
  const isAdmin = user?.role === "admin";
  const completedCount = [menuReport, dailyReport, foodWaste].filter(Boolean).length;
  const completionPercent = Math.round((completedCount / 3) * 100);
  const progressCopy =
    completedCount === 3
      ? "Semua data utama hari ini sudah lengkap"
      : `${completedCount} dari 3 tugas utama selesai`;
  const primaryCta = !dailyReport
    ? {
        label: "Lanjutkan pekerjaan hari ini",
        description: "Mulai dari laporan PM hari ini.",
        onClick: () => openDailyInput(onNavigate),
      }
    : !menuReport
    ? {
        label: "Lanjutkan pekerjaan hari ini",
        description: "PM sudah ada. Catat menu hari ini berikutnya.",
        onClick: () => onNavigate?.("menu-reports"),
      }
    : !foodWaste
    ? {
        label: "Lanjutkan pekerjaan hari ini",
        description: "PM dan menu sudah ada. Lengkapi sisa pangan kemarin.",
        onClick: () => onNavigate?.("food-waste"),
      }
    : {
        label: "Pekerjaan utama selesai",
        description: "Semua data utama lengkap. Lihat dashboard mingguan.",
        onClick: () => onNavigate?.("weekly"),
      };
  const foodWastePercent =
    foodWaste && Number(foodWaste.total_portions || 0) > 0
      ? (Number(foodWaste.total_kg || 0) / Number(foodWaste.total_portions || 0)) * 100
      : 0;
  const recommendations = generateOperationalRecommendations({
    dailyReportMissing: !dailyReport,
    menuReportMissing: !menuReport,
    foodWasteMissing: !foodWaste,
    highWaste: foodWastePercent >= 5,
    wasteAveragePercent: foodWastePercent,
  });
  const visibleRecommendations = sortByLevel(
    recommendations.filter((recommendation) => {
      if (CHECKLIST_RECOMMENDATION_IDS.has(recommendation.id)) return false;
      if (completedCount < 3 && recommendation.level === "success") return false;
      return true;
    })
  ).slice(0, 2);
  const rawAnomalies = generateOperationalAnomalies({
    dailyReports: dailyReport ? [dailyReport] : [],
    menuReports: menuReport ? [menuReport] : [],
    foodWasteReports: [],
    dailyWithoutMenu: Boolean(dailyReport && !menuReport),
  });
  const visibleAnomalies = sortByLevel(
    rawAnomalies.filter((anomaly) => completedCount === 3 || anomaly.level !== "success")
  ).slice(0, 2);
  const hasInsightPanel = visibleRecommendations.length > 0 || visibleAnomalies.length > 0;

  return (
    <>
      <div className="home-saas-shell">
        <section className="home-saas-hero">
          <div className="home-saas-hero-copy">
            <div className="home-saas-eyebrow">
              <AppIcon name="activity" size={16} weight={APP_ICON_WEIGHT.summary} />
              Operasional hari ini
            </div>
            <h1>Dashboard SPPG</h1>
            <p>
              Pusat kontrol untuk memantau menu, distribusi penerima manfaat, belanja, dan sisa pangan
              tanpa berpindah konteks terlalu banyak.
            </p>
            <div className="home-saas-meta-row">
              <div className="home-date-chip premium">
                <AppIcon name="date" size={18} weight={APP_ICON_WEIGHT.nav} />
                <span>{todayLong}</span>
              </div>
              <HomeStatusPill ok={completedCount === 3}>
                {progressCopy}
              </HomeStatusPill>
            </div>
          </div>

          <div className="home-command-center">
            <div className="home-command-head">
              <span>Kelengkapan data</span>
              <strong>{completionPercent}%</strong>
            </div>
            <p className="home-command-progress-copy">{progressCopy}</p>
            <div className="home-progress-track">
              <span style={{ width: `${completionPercent}%` }} />
            </div>
            <div className="home-status-grid">
              <HomeStatusPill ok={Boolean(menuReport)}>Menu</HomeStatusPill>
              <HomeStatusPill ok={Boolean(dailyReport)}>PM</HomeStatusPill>
              <HomeStatusPill ok={Boolean(foodWaste)}>Sisa pangan</HomeStatusPill>
            </div>
          </div>
        </section>

        <section className="home-kpi-grid">
          <SummaryMetricCard
            label="Penerima manfaat"
            value={dailyReport ? formatNumber(dailyReport.total_pm) : "-"}
            helper={dailyReport ? "Total PM hari ini" : "Belum ada data PM hari ini"}
            icon="beneficiaries"
            tone="blue"
            emphasis
            className="home-kpi-card"
            onClick={() => onNavigate?.("daily")}
            title="Klik untuk buka Laporan Harian"
          />
          <SummaryMetricCard
            label="Porsi kecil"
            value={dailyReport ? formatNumber(dailyReport.total_small_portion) : "-"}
            helper="Total hari ini"
            icon="package"
            tone="green"
            className="home-kpi-card"
            onClick={() => onNavigate?.("daily")}
            title="Klik untuk buka Laporan Harian"
          />
          <SummaryMetricCard
            label="Porsi besar"
            value={dailyReport ? formatNumber(dailyReport.total_large_portion) : "-"}
            helper="Total hari ini"
            icon="packageOpen"
            tone="amber"
            className="home-kpi-card"
            onClick={() => onNavigate?.("daily")}
            title="Klik untuk buka Laporan Harian"
          />
          <SummaryMetricCard
            label="Sisa pangan"
            value={foodWaste ? formatKg(foodWaste.total_kg, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "-"}
            helper={foodWaste ? `Data ${yesterdayLong}` : "Belum ada data sisa kemarin"}
            icon="foodWaste"
            tone="blue"
            className="home-kpi-card"
            onClick={() => onNavigate?.("food-waste")}
            title="Klik untuk buka Sisa Pangan"
          />
        </section>

        <section className="home-workspace-grid">
          <aside className="home-panel home-panel-premium home-checklist-panel">
            <div className="home-panel-head horizontal">
              <div>
                <div className="home-panel-kicker">Prioritas</div>
                <h2>Prioritas hari ini</h2>
                <p>Tugas utama untuk menjaga data operasional tetap lengkap.</p>
              </div>
            </div>
            <div className="home-checklist-list">
              <HomeChecklistItem
                icon="daily"
                title="Isi laporan PM hari ini"
                description={dailyReport ? `${formatNumber(dailyReport.total_pm)} penerima manfaat tercatat.` : "Laporan PM hari ini belum diisi."}
                ok={Boolean(dailyReport)}
                actionLabel={isAdmin && !dailyReport ? "Isi PM" : "Lihat"}
                onAction={() => (isAdmin && !dailyReport ? openDailyInput(onNavigate) : onNavigate?.("daily"))}
              />
              <HomeChecklistItem
                icon="menuReports"
                title="Catat menu hari ini"
                description={menuReport?.menu_name || "Menu hari ini belum dicatat."}
                ok={Boolean(menuReport)}
                actionLabel={isAdmin && !menuReport ? "Isi menu" : "Lihat"}
                onAction={() => onNavigate?.("menu-reports")}
              />
              <HomeChecklistItem
                icon="foodWaste"
                title="Lengkapi sisa pangan kemarin"
                description={foodWaste ? `${formatKg(foodWaste.total_kg, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} sisa pangan tercatat.` : "Data sisa pangan kemarin belum lengkap."}
                ok={Boolean(foodWaste)}
                actionLabel={isAdmin && !foodWaste ? "Isi sisa" : "Lihat"}
                onAction={() => onNavigate?.("food-waste")}
              />
            </div>
            <HomePrimaryCta
              completed={completedCount === 3}
              label={primaryCta.label}
              description={primaryCta.description}
              onClick={primaryCta.onClick}
            />
          </aside>

          <div className="home-panel home-panel-premium home-primary-workflow">
            <div className="home-panel-head">
              <div className="home-panel-kicker">Sekunder</div>
              <h2>Shortcut fitur lain</h2>
              <p>Shortcut fitur untuk pekerjaan di luar prioritas utama.</p>
            </div>
            <div className="home-quick-action-grid">
              <HomeQuickAction
                icon="shoppingReports"
                title="Laporan belanja"
                description="Input item belanja dan pagu harian."
                actionLabel="Buka"
                onAction={() => onNavigate?.("shopping-reports")}
                primary
              />
              <HomeQuickAction
                icon="weekly"
                title="Dashboard mingguan"
                description="Lihat agregasi PM, menu, belanja, dan sisa."
                actionLabel="Buka"
                onAction={() => onNavigate?.("weekly")}
              />
              <HomeQuickAction
                icon="priceMonitoring"
                title="Monitoring harga"
                description="Pantau kenaikan harga dan riwayat barang."
                actionLabel="Buka"
                onAction={() => onNavigate?.("price-monitoring")}
              />
            </div>
          </div>
        </section>

        {hasInsightPanel ? (
          <section className="home-panel home-panel-premium home-operational-insights">
            <div className="home-panel-head horizontal">
              <div>
                <div className="home-panel-kicker">Insight</div>
                <h2>Perlu perhatian</h2>
                <p>Alert dan rekomendasi tambahan di luar checklist utama.</p>
              </div>
            </div>
            {visibleAnomalies.length ? (
              <div className="operational-anomaly-list home-anomaly-list">
                {visibleAnomalies.map((anomaly) => (
                  <AnomalyCard key={anomaly.id} anomaly={anomaly} onNavigate={onNavigate} />
                ))}
              </div>
            ) : null}
            {visibleRecommendations.length ? (
              <div className="operational-recommendation-list home-recommendation-list">
                {visibleRecommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="home-insight-grid">
          <div className="home-panel home-panel-premium">
            <div className="home-panel-head">
              <div className="home-panel-kicker">Menu</div>
              <h2>Laporan menu terbaru</h2>
            </div>
            {menuReport ? (
              <HomeActionCard
                eyebrow={formatDateLong(menuReport.report_date)}
                title={menuReport.menu_name || "Menu sudah tercatat."}
                description="Gunakan laporan menu untuk acuan belanja dan evaluasi gizi."
                actionLabel="Detail menu"
                onAction={() => onNavigate?.("menu-reports")}
                icon="menu"
                strong
              />
            ) : (
              <HomeHistoryEmpty
                title="Belum ada histori menu hari ini"
                description="Status input menu sudah tersedia di prioritas hari ini."
              />
            )}
          </div>

          <div className="home-panel home-panel-premium">
            <div className="home-panel-head">
              <div className="home-panel-kicker">Kemarin</div>
              <h2>Catatan sisa pangan</h2>
            </div>
            {foodWaste ? (
              <HomeActionCard
                eyebrow={formatDateLong(foodWaste.report_date)}
                title={foodWaste.menu_notes || "Catatan menu belum tersedia."}
                description={`${formatKg(foodWaste.total_kg, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} total sisa pangan tercatat.`}
                actionLabel="Detail"
                onAction={() => onNavigate?.("food-waste")}
                icon="foodWaste"
                strong
              />
            ) : (
              <HomeHistoryEmpty
                eyebrow={yesterdayLong}
                title="Belum ada histori sisa pangan"
                description="Status input sisa pangan sudah tersedia di prioritas hari ini."
              />
            )}
          </div>
        </section>
      </div>

      <Toast kind={toast.kind} message={toast.message} />
    </>
  );
}
