import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import HomeEmptyCard from "../components/HomeEmptyCard.jsx";
import Toast from "../components/Toast.jsx";
import { fetchHomeSummary } from "../api/reportApi.js";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "../components/ui/appIcons.jsx";

function formatDateLong(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatWeight(value) {
  return `${Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`;
}

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
    return <div className="loading">Memuat ringkasan dashboard...</div>;
  }

  const primaryDate = summary?.today_date;
  const dailyReport = summary?.daily_report;
  const menuReport = summary?.menu_report;
  const foodWaste = summary?.food_waste;
  const todayLong = formatDateLong(primaryDate);
  const yesterdayLong = formatDateLong(summary?.yesterday_date);
  const isAdmin = user?.role === "admin";

  return (
    <>
      <div className="home-welcome-row">
        <div className="home-welcome-copy">
          <h1>Selamat datang kembali, Admin!</h1>
          <p>Ringkasan cepat untuk memantau operasional harian.</p>
        </div>
        <div className="home-date-chip">
          <AppIcon name="date" size={20} weight={APP_ICON_WEIGHT.nav} />
          <span>{todayLong}</span>
        </div>
      </div>

      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-hero-badge">Hari ini</div>
          <h2>{todayLong}</h2>
          <p>
            Ringkasan cepat untuk menu hari ini, penerima manfaat hari ini, dan sisa pangan hari kemarin.
          </p>
        </div>
        <div className="home-hero-visual" aria-hidden="true">
          <div className="home-illustration-leaf home-illustration-leaf-left" />
          <div className="home-illustration-leaf home-illustration-leaf-right" />
          <div className="home-clipboard">
            <div className="home-clipboard-clip" />
            <div className="home-clipboard-lines">
              <span />
              <span />
            </div>
            <div className="home-clipboard-bars">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>

      <div className="home-section">
        <div className="home-panel">
          <div className="home-panel-head">
            <h2>Laporan Hari Ini</h2>
            <p>Pantau dan kelola laporan operasional harian dengan mudah.</p>
          </div>
          {menuReport ? (
            <HomeActionCard
              eyebrow={formatDateLong(menuReport.report_date)}
              title={menuReport.menu_name || "Belum ada data menu."}
              description="Menu hari ini sudah tercatat di laporan menu."
              actionLabel="Lihat Laporan Menu"
              onAction={() => onNavigate?.("menu-reports")}
              icon="menu"
              strong
            />
          ) : (
            <HomeEmptyCard
              title="Data belum diisi"
              description="Menu hari ini belum diisi. Tambahkan laporan menu untuk melengkapi dashboard."
              actionLabel={isAdmin ? "Isi Laporan Menu" : null}
              onAction={isAdmin ? () => onNavigate?.("menu-reports") : null}
            />
          )}
        </div>
      </div>

      <div className="home-section">
        <div className="home-panel">
          <div className="home-panel-head">
            <div className="home-panel-kicker">Hari ini</div>
            <h2>Penerima Manfaat</h2>
            <p>Ringkasan dari Laporan Harian untuk hari ini.</p>
          </div>
          {dailyReport ? (
            <div className="home-summary-grid">
              <SummaryMetricCard
                label="Total penerima manfaat"
                value={formatNumber(dailyReport.total_pm)}
                helper="penerima"
                icon="beneficiaries"
                tone="blue"
                emphasis
                className="home-metric-card-blue"
              />
              <SummaryMetricCard
                label="Total porsi kecil"
                value={formatNumber(dailyReport.total_small_portion)}
                helper="porsi"
                icon="package"
                tone="green"
                className="home-metric-card-green"
              />
              <SummaryMetricCard
                label="Total porsi besar"
                value={formatNumber(dailyReport.total_large_portion)}
                helper="porsi"
                icon="package"
                tone="amber"
                className="home-metric-card-amber"
              />
            </div>
          ) : (
            <HomeEmptyCard
              eyebrow={todayLong}
              title="Data belum diisi"
              description="Laporan Harian hari ini belum diisi. Isi data penerima manfaat agar ringkasan tampil."
              actionLabel={isAdmin ? "Isi Laporan Harian" : null}
              onAction={isAdmin ? () => onNavigate?.("daily") : null}
            />
          )}
        </div>
      </div>

      <div className="home-section">
        <div className="home-panel">
          <div className="home-panel-head">
            <div className="home-panel-kicker">Kemarin</div>
            <h2>Sisa Pangan Hari Kemarin</h2>
            <p>Diambil dari data sisa pangan untuk hari kemarin.</p>
          </div>
          {foodWaste ? (
            <div className="home-summary-grid home-summary-grid-two">
              <SummaryMetricCard
                label="Total sisa pangan"
                value={formatWeight(foodWaste.total_kg)}
                helper="kilogram"
                icon="foodWaste"
                tone="blue"
                emphasis
                className="home-metric-card-blue"
              />
              <div className="summary-card home-feature-card home-feature-card-strong">
                <div className="home-feature-icon-wrap">
                  <div className="summary-metric-icon summary-metric-icon-blue">
                    <AppIcon name="foodWaste" weight={APP_ICON_WEIGHT.summary} />
                  </div>
                </div>
                <div className="home-feature-main">
                  <span className="summary-card-label">{formatDateLong(foodWaste.report_date)}</span>
                  <strong className="home-feature-title">{foodWaste.menu_notes || "Menu belum tersedia."}</strong>
                </div>
              </div>
            </div>
          ) : (
            <HomeEmptyCard
              eyebrow={yesterdayLong}
              title="Data belum diisi"
              description="Data sisa pangan kemarin belum diisi. Lengkapi agar pemantauan home lebih akurat."
              actionLabel={isAdmin ? "Isi Sisa Pangan" : null}
              onAction={isAdmin ? () => onNavigate?.("food-waste") : null}
            />
          )}
        </div>
      </div>

      <Toast kind={toast.kind} message={toast.message} />
    </>
  );
}
