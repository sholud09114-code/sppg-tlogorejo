import { useState } from "react";
import Toast from "../components/Toast.jsx";
import { fetchWeeklySummary } from "../api/reportApi.js";

const CATEGORY_ORDER = ["PAUD/TK/KB", "SD", "SMP", "SMK"];

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

function formatMoney(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function renderNutritionBlock(report, portionSize) {
  const prefix = portionSize === "small" ? "small" : "large";

  return (
    <div className="weekly-nutrition-list">
      <span>Energi: {formatNumber(report[`${prefix}_energy`])} kkal</span>
      <span>Protein: {formatNumber(report[`${prefix}_protein`])} g</span>
      <span>Lemak: {formatNumber(report[`${prefix}_fat`])} g</span>
      <span>Karbohidrat: {formatNumber(report[`${prefix}_carbohydrate`])} g</span>
      <span>Serat: {formatNumber(report[`${prefix}_fiber`])} g</span>
    </div>
  );
}

export default function WeeklyReports() {
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [reportData, setReportData] = useState(null);
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
      const data = await fetchWeeklySummary(filters.start_date, filters.end_date);
      setReportData(data);
      setHasSubmitted(true);
      setToast({ kind: null, message: null });
    } catch (err) {
      setReportData(null);
      setHasSubmitted(true);
      setToast({
        kind: "danger",
        message: "Gagal memuat laporan mingguan: " + err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const dailySummary = reportData?.daily_reports?.summary || null;
  const menuSummary = reportData?.menu_reports?.summary || null;
  const shoppingSummary = reportData?.shopping_reports?.summary || null;

  return (
    <>
      <section className="feature-page-card">
        <div className="page-title gap-4">
          <div className="min-w-0">
            <h2>Laporan mingguan</h2>
            <p>Lihat akumulasi laporan harian, menu, dan belanja pada rentang tanggal fleksibel.</p>
          </div>
        </div>

        <form className="weekly-filter-panel" onSubmit={handleSubmit}>
          <div className="filter-field">
            <label htmlFor="weekly_start_date">Tanggal mulai</label>
            <input
              id="weekly_start_date"
              type="date"
              value={filters.start_date}
              onChange={(event) => handleChange("start_date", event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="filter-field">
            <label htmlFor="weekly_end_date">Tanggal selesai</label>
            <input
              id="weekly_end_date"
              type="date"
              value={filters.end_date}
              onChange={(event) => handleChange("end_date", event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="weekly-filter-action">
            <button type="submit" className="submit-btn w-full sm:w-auto" disabled={loading}>
              {loading ? "Memuat..." : "Tampilkan laporan"}
            </button>
          </div>
        </form>

        {!hasSubmitted ? (
          <div className="empty-state mt-4">
            Pilih tanggal mulai dan tanggal selesai untuk menampilkan laporan mingguan atau 2 mingguan.
          </div>
        ) : reportData ? (
          <>
          <div className="weekly-summary-grid mt-4">
            <div className="summary-card">
              <span className="summary-card-label">Rentang laporan</span>
              <strong className="text-base">
                {formatDateLong(reportData.range.start_date)} - {formatDateLong(reportData.range.end_date)}
              </strong>
            </div>
            <div className="summary-card">
              <span className="summary-card-label">Total PM keseluruhan</span>
              <strong>{formatNumber(dailySummary?.total_pm)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-card-label">Hari dengan laporan PM</span>
              <strong>{formatNumber(dailySummary?.total_days)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-card-label">Total akumulasi belanja</span>
              <strong>{formatMoney(shoppingSummary?.total_spending)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-card-label">Total pagu</span>
              <strong>{formatMoney(shoppingSummary?.total_budget)}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-card-label">Total selisih</span>
              <strong>{formatMoney(shoppingSummary?.total_difference)}</strong>
            </div>
          </div>

          <section className="weekly-section">
            <div className="page-title weekly-section-head">
              <div>
                <h2>Ringkasan PM Harian</h2>
                <p>Akumulasi penerima manfaat pada rentang tanggal yang dipilih.</p>
              </div>
            </div>

            <div className="weekly-summary-grid compact">
              {CATEGORY_ORDER.map((category) => (
                <div className="summary-card" key={category}>
                  <span className="summary-card-label">{category}</span>
                  <strong>{formatNumber(dailySummary?.by_category?.[category])}</strong>
                </div>
              ))}
            </div>

            {reportData.daily_reports.reports.length > 0 ? (
              <div className="data-table-scroll-shell scroll-affordance mt-3" data-scroll-hint="Geser tabel">
                <div className="table-wrap">
                <table className="data-table min-w-[1080px]">
                  <thead>
                    <tr>
                      <th className="text-left">Tanggal</th>
                      <th className="text-right">Total PM</th>
                      <th className="text-right">Porsi Kecil</th>
                      <th className="text-right">Porsi Besar</th>
                      <th className="text-right">PAUD/TK/KB</th>
                      <th className="text-right">SD</th>
                      <th className="text-right">SMP</th>
                      <th className="text-right">SMK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.daily_reports.reports.map((report) => (
                      <tr key={`daily-${report.report_id}`}>
                        <td className="text-left">{formatDateLong(report.report_date)}</td>
                        <td className="text-right">{formatNumber(report.total_pm)}</td>
                        <td className="text-right">{formatNumber(report.total_small_portion)}</td>
                        <td className="text-right">{formatNumber(report.total_large_portion)}</td>
                        <td className="text-right">{formatNumber(report.by_category?.["PAUD/TK/KB"])}</td>
                        <td className="text-right">{formatNumber(report.by_category?.SD)}</td>
                        <td className="text-right">{formatNumber(report.by_category?.SMP)}</td>
                        <td className="text-right">{formatNumber(report.by_category?.SMK)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ) : (
              <div className="empty-state mt-3">Belum ada laporan PM harian pada rentang ini.</div>
            )}
          </section>

          <section className="weekly-section">
            <div className="page-title weekly-section-head">
              <div>
                <h2>Ringkasan Menu</h2>
                <p>Daftar menu per tanggal beserta ringkasan kandungan gizi jika tersedia.</p>
              </div>
            </div>

            <div className="weekly-summary-grid compact">
              <div className="summary-card">
                <span className="summary-card-label">Hari dengan data menu</span>
                <strong>{formatNumber(menuSummary?.total_days)}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-card-label">Jumlah entri menu</span>
                <strong>{formatNumber(menuSummary?.total_reports)}</strong>
              </div>
            </div>

            {reportData.menu_reports.reports.length > 0 ? (
              <div className="data-table-scroll-shell scroll-affordance mt-3" data-scroll-hint="Geser tabel">
                <div className="table-wrap">
                <table className="data-table min-w-[1180px]">
                  <thead>
                    <tr>
                      <th className="text-left">Tanggal</th>
                      <th className="text-left">Nama Menu</th>
                      <th className="text-left">Gizi Porsi Kecil</th>
                      <th className="text-left">Gizi Porsi Besar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.menu_reports.reports.map((report) => (
                      <tr key={`menu-${report.id}`}>
                        <td className="text-left">{formatDateLong(report.menu_date)}</td>
                        <td className="text-left">
                          <div className="weekly-menu-list">
                            {[
                              report.menu_name_1,
                              report.menu_name_2,
                              report.menu_name_3,
                              report.menu_name_4,
                              report.menu_name_5,
                            ]
                              .filter(Boolean)
                              .map((name) => (
                                <span key={`${report.id}-${name}`}>{name}</span>
                              ))}
                          </div>
                        </td>
                        <td className="text-left">{renderNutritionBlock(report, "small")}</td>
                        <td className="text-left">{renderNutritionBlock(report, "large")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ) : (
              <div className="empty-state mt-3">Belum ada laporan menu pada rentang ini.</div>
            )}
          </section>

          <section className="weekly-section">
            <div className="page-title weekly-section-head">
              <div>
                <h2>Ringkasan Belanja</h2>
                <p>Akumulasi pagu, belanja, dan selisih per tanggal laporan belanja.</p>
              </div>
            </div>

            <div className="weekly-summary-grid compact">
              <div className="summary-card">
                <span className="summary-card-label">Hari dengan laporan belanja</span>
                <strong>{formatNumber(shoppingSummary?.total_days)}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-card-label">Jumlah entri belanja</span>
                <strong>{formatNumber(shoppingSummary?.total_reports)}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-card-label">Total belanja</span>
                <strong>{formatMoney(shoppingSummary?.total_spending)}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-card-label">Total pagu</span>
                <strong>{formatMoney(shoppingSummary?.total_budget)}</strong>
              </div>
              <div className="summary-card">
                <span className="summary-card-label">Total selisih</span>
                <strong>{formatMoney(shoppingSummary?.total_difference)}</strong>
              </div>
            </div>

            {reportData.shopping_reports.reports.length > 0 ? (
              <div className="data-table-scroll-shell scroll-affordance mt-3" data-scroll-hint="Geser tabel">
                <div className="table-wrap">
                  <table className="data-table min-w-[1080px]">
                    <thead>
                      <tr>
                        <th className="text-left">Tanggal</th>
                        <th className="text-left">Nama Menu</th>
                        <th className="text-right">Porsi Kecil</th>
                        <th className="text-right">Porsi Besar</th>
                        <th className="text-right">Total Belanja</th>
                        <th className="text-right">Pagu</th>
                        <th className="text-right">Selisih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.shopping_reports.reports.map((report) => (
                        <tr key={`shopping-${report.id}`}>
                          <td className="text-left">{formatDateLong(report.report_date)}</td>
                          <td className="text-left">{report.menu_name || "-"}</td>
                          <td className="text-right">{formatNumber(report.small_portion_count)}</td>
                          <td className="text-right">{formatNumber(report.large_portion_count)}</td>
                          <td className="text-right">{formatMoney(report.total_spending)}</td>
                          <td className="text-right">{formatMoney(report.daily_budget)}</td>
                          <td className="text-right">{formatMoney(report.difference_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="empty-state mt-3">Belum ada laporan belanja pada rentang ini.</div>
            )}
          </section>
          </>
        ) : (
          <div className="empty-state mt-4">Data laporan tidak tersedia untuk rentang ini.</div>
        )}
      </section>

      <Toast kind={toast.kind} message={toast.message} />
    </>
  );
}
