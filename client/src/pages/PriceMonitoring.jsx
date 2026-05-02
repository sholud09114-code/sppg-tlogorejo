import { useEffect, useMemo, useState } from "react";
import PriceMonitoringModal from "../components/PriceMonitoringModal.jsx";
import LoadingMessage from "../components/LoadingMessage.jsx";
import Toast from "../components/Toast.jsx";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "../components/ui/appIcons.jsx";
import {
  fetchItemMasters,
  fetchPriceIncreaseDetection,
  fetchShoppingReports,
  getCachedItemMasters,
  getCachedShoppingReports,
} from "../api/shoppingReportApi.js";
import { formatDateLong, formatMoney } from "../shared/utils/formatters.js";

const HIGH_INCREASE_PERCENT = 10;
const EMPTY_PRICE_ROWS = [];
const EMPTY_PRICE_SUMMARY = {};
const PRICE_FILTERS = [
  { id: "all", label: "Semua" },
  { id: "high", label: "Naik tinggi" },
  { id: "up", label: "Naik" },
  { id: "stable", label: "Stabil" },
  { id: "down", label: "Turun" },
  { id: "no-history", label: "Tanpa histori" },
];

function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function formatPercent(value) {
  if (value == null) return "-";
  return `${Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function getPriceStatusClass(status) {
  return String(status || "tanpa histori").replace(/\s+/g, "-");
}

function isHighIncrease(row, minPercent = HIGH_INCREASE_PERCENT) {
  return row.status === "naik" && Number(row.selisih_persen || 0) >= minPercent;
}

export default function PriceMonitoring() {
  const [defaultReportDate] = useState(getTodayISO);
  const [itemMasters, setItemMasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ kind: null, message: null });
  const [monitoringRequest, setMonitoringRequest] = useState(null);
  const [initialDetectionLoaded, setInitialDetectionLoaded] = useState(false);
  const [detectionFilters, setDetectionFilters] = useState({
    report_date: "",
    only_increased: false,
    min_percent_increase: "",
  });
  const [detectionLoading, setDetectionLoading] = useState(false);
  const [detectionData, setDetectionData] = useState(null);
  const [activePriceFilter, setActivePriceFilter] = useState("all");

  useEffect(() => {
    const cachedMasterItems = getCachedItemMasters();
    const cachedShoppingReports = getCachedShoppingReports();

    if (cachedMasterItems) {
      setItemMasters(cachedMasterItems);
    }

    if (cachedShoppingReports) {
      const latestShoppingDate =
        cachedShoppingReports?.[0]?.report_date || defaultReportDate;
      setDetectionFilters((prev) => ({
        ...prev,
        report_date: latestShoppingDate,
      }));
    }

    if (cachedMasterItems && cachedShoppingReports) {
      setLoading(false);
    }

    Promise.all([
      fetchItemMasters({ force: Boolean(cachedMasterItems) }),
      fetchShoppingReports({ force: Boolean(cachedShoppingReports) }),
    ])
      .then(([masterItems, shoppingReports]) => {
        const latestShoppingDate =
          shoppingReports?.[0]?.report_date || defaultReportDate;

        setItemMasters(masterItems);
        setDetectionFilters((prev) => ({
          ...prev,
          report_date: latestShoppingDate,
        }));
        setLoading(false);
      })
      .catch((err) => {
        setToast({
          kind: "danger",
          message: "Gagal memuat data monitoring harga: " + err.message,
        });
        setLoading(false);
      });
  }, [defaultReportDate]);

  const loadDetectionData = async ({
    reportDate,
    onlyIncreased = false,
    minPercentIncrease = "",
  }) => {
    if (!reportDate) {
      setToast({
        kind: "warning",
        message: "Tanggal laporan wajib diisi untuk deteksi kenaikan harga.",
      });
      return;
    }

    const minPercentRaw = minPercentIncrease;
    const minPercentValue = minPercentRaw === "" ? "" : Number(minPercentRaw);

    if (
      minPercentRaw !== "" &&
      (!Number.isFinite(minPercentValue) || minPercentValue < 0)
    ) {
      setToast({
        kind: "warning",
        message: "Minimum persen kenaikan tidak boleh negatif.",
      });
      return;
    }

    try {
      setDetectionLoading(true);
      const data = await fetchPriceIncreaseDetection({
        reportDate,
        onlyIncreased,
        minPercentIncrease: minPercentRaw,
      });
      setDetectionData(data);
      setActivePriceFilter(onlyIncreased ? "up" : "all");
      setToast({ kind: null, message: null });
    } catch (err) {
      setDetectionData(null);
      setToast({
        kind: "danger",
        message: "Gagal memuat deteksi kenaikan harga: " + err.message,
      });
    } finally {
      setDetectionLoading(false);
    }
  };

  const handleDetectionSubmit = async (event) => {
    event.preventDefault();
    await loadDetectionData({
      reportDate: detectionFilters.report_date,
      onlyIncreased: detectionFilters.only_increased,
      minPercentIncrease: detectionFilters.min_percent_increase,
    });
  };

  useEffect(() => {
    if (loading || initialDetectionLoaded || !detectionFilters.report_date) return;

    loadDetectionData({
      reportDate: detectionFilters.report_date,
      onlyIncreased: false,
      minPercentIncrease: "",
    });
    setInitialDetectionLoaded(true);
  }, [initialDetectionLoaded, loading, detectionFilters.report_date]);

  const detectionSummary = detectionData?.summary || EMPTY_PRICE_SUMMARY;
  const detectionRows = detectionData?.rows || EMPTY_PRICE_ROWS;
  const highIncreaseThreshold = Number(detectionFilters.min_percent_increase || HIGH_INCREASE_PERCENT);
  const highIncreaseCount = useMemo(
    () => detectionRows.filter((row) => isHighIncrease(row, highIncreaseThreshold)).length,
    [detectionRows, highIncreaseThreshold]
  );
  const visibleDetectionRows = useMemo(() => {
    return detectionRows.filter((row) => {
      if (activePriceFilter === "high") return isHighIncrease(row, highIncreaseThreshold);
      if (activePriceFilter === "up") return row.status === "naik";
      if (activePriceFilter === "stable") return row.status === "tetap";
      if (activePriceFilter === "down") return row.status === "turun";
      if (activePriceFilter === "no-history") return row.status === "tanpa histori";
      return true;
    });
  }, [activePriceFilter, detectionRows, highIncreaseThreshold]);

  const priceFilterCounts = useMemo(
    () => ({
      all: detectionRows.length,
      high: highIncreaseCount,
      up: Number(detectionSummary.increased_count || 0),
      stable: Number(detectionSummary.unchanged_count || 0),
      down: Number(detectionSummary.decreased_count || 0),
      "no-history": Number(detectionSummary.no_history_count || 0),
    }),
    [detectionRows.length, detectionSummary, highIncreaseCount]
  );

  const openMonitoringForRow = (row) => {
    const rowItemName = row.nama_barang_query || row.nama_barang || "";
    const rowItemCode = row.master_item_id ? row.kode_barang : "";

    if (!row.master_item_id && !rowItemName) {
      setToast({
        kind: "warning",
        message: "Data barang ini belum cukup untuk membuka monitoring harga otomatis.",
      });
      return;
    }

    setMonitoringRequest({
      itemId: row.master_item_id,
      itemCode: rowItemCode,
      itemName: rowItemName,
      startDate: row.monitoring_range?.start_date || detectionFilters.report_date,
      endDate: row.monitoring_range?.end_date || detectionFilters.report_date,
      queryLabel:
        row.master_item_id && rowItemCode
          ? [row.kode_barang, row.nama_barang].filter(Boolean).join(" - ")
          : rowItemName,
    });

    document.getElementById("price-monitoring-trend-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <>
      <section className="feature-page-card price-monitoring-page">
        <div className="price-monitoring-hero">
          <div className="price-monitoring-hero-copy">
            <span className="weekly-section-icon">
              <AppIcon name="priceMonitoring" size={24} weight={APP_ICON_WEIGHT.summary} />
            </span>
            <div className="min-w-0">
              <h2>Monitoring Harga</h2>
              <p>Pantau perubahan harga barang, deteksi kenaikan, dan buka riwayat harga dari laporan belanja.</p>
            </div>
          </div>
          <div className="price-monitoring-hero-meta">
            <span>Tanggal deteksi</span>
            <strong>{detectionFilters.report_date ? formatDateLong(detectionFilters.report_date) : "Belum dipilih"}</strong>
          </div>
        </div>

        <div className="price-monitoring-layout">
          {loading ? <LoadingMessage>Memuat master barang...</LoadingMessage> : null}

          <section className="price-detection-panel">
            <div className="price-section-head">
              <div>
                <h3>Deteksi kenaikan harga</h3>
                <p>Periksa semua item belanja pada satu tanggal dan bandingkan dengan harga sebelumnya.</p>
              </div>
            </div>

            <form className="price-filter-panel" onSubmit={handleDetectionSubmit}>
              <div className="filter-field">
                <label htmlFor="price_detection_date">Tanggal laporan</label>
                <input
                  id="price_detection_date"
                  type="date"
                  value={detectionFilters.report_date}
                  onChange={(event) =>
                    setDetectionFilters((prev) => ({
                      ...prev,
                      report_date: event.target.value,
                    }))
                  }
                  disabled={detectionLoading}
                />
              </div>

              <div className="filter-field">
                <label htmlFor="price_detection_min_percent">Minimum persen kenaikan</label>
                <input
                  id="price_detection_min_percent"
                  type="number"
                  min="0"
                  step="0.01"
                  value={detectionFilters.min_percent_increase}
                  onChange={(event) =>
                    setDetectionFilters((prev) => ({
                      ...prev,
                      min_percent_increase: event.target.value,
                    }))
                  }
                  placeholder="Opsional"
                  disabled={detectionLoading}
                />
              </div>

              <label className="price-detection-checkbox">
                <input
                  type="checkbox"
                  checked={detectionFilters.only_increased}
                  onChange={(event) =>
                    setDetectionFilters((prev) => ({
                      ...prev,
                      only_increased: event.target.checked,
                    }))
                  }
                  disabled={detectionLoading}
                />
                Hanya tampilkan yang naik
              </label>

              <div className="weekly-filter-action">
                <button
                  type="submit"
                  className="submit-btn w-full sm:w-auto"
                  disabled={detectionLoading}
                >
                  {detectionLoading ? "Memeriksa..." : "Periksa"}
                </button>
              </div>
            </form>

            {detectionData && (
              <div className="price-monitoring-results">
                <div className="price-kpi-grid">
                  <SummaryMetricCard
                    className="price-monitoring-mobile-summary-card"
                    label="Item diperiksa"
                    value={Number(detectionSummary.total_checked || 0).toLocaleString("id-ID")}
                    icon="database"
                    tone="blue"
                  />
                  <SummaryMetricCard
                    className="price-monitoring-mobile-summary-card"
                    label="Naik harga"
                    value={Number(detectionSummary.increased_count || 0).toLocaleString("id-ID")}
                    icon="trendingUp"
                    tone="amber"
                  />
                  <SummaryMetricCard
                    className="price-monitoring-mobile-summary-card"
                    label="Naik signifikan"
                    value={highIncreaseCount.toLocaleString("id-ID")}
                    helper={`>= ${highIncreaseThreshold.toLocaleString("id-ID")}%`}
                    icon="statusPartial"
                    tone="amber"
                  />
                  <SummaryMetricCard
                    className="price-monitoring-mobile-summary-card"
                    label="Stabil"
                    value={Number(detectionSummary.unchanged_count || 0).toLocaleString("id-ID")}
                    icon="activity"
                    tone="blue"
                  />
                </div>

                <div className="daily-filter-chips price-filter-chips" aria-label="Filter status harga">
                  {PRICE_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      className={activePriceFilter === filter.id ? "active" : ""}
                      onClick={() => setActivePriceFilter(filter.id)}
                    >
                      <span>{filter.label}</span>
                      <strong>{priceFilterCounts[filter.id] || 0}</strong>
                    </button>
                  ))}
                </div>

                {visibleDetectionRows.length > 0 ? (
                  <div className="price-detection-list">
                    {visibleDetectionRows.map((row) => {
                      const statusClass = getPriceStatusClass(row.status);
                      const highIncrease = isHighIncrease(row, highIncreaseThreshold);
                      const canOpenHistory =
                        row.status !== "tanpa histori" &&
                        (row.master_item_id || row.nama_barang_query || row.nama_barang);

                      return (
                        <article
                          className={`price-detection-card ${statusClass} ${highIncrease ? "high-increase" : ""}`}
                          key={`${row.report_item_id}-${row.kode_barang}-${row.nama_barang}`}
                        >
                          <div className="price-detection-main">
                            <span className={`price-status-badge ${statusClass}`}>{row.status}</span>
                            <div>
                              <strong>{row.nama_barang || "Barang tanpa nama"}</strong>
                              <span>{row.kode_barang || "Tanpa kode"} | {row.laporan_menu || "-"}</span>
                            </div>
                          </div>

                          <div className="price-detection-values">
                            <div>
                              <span>Sebelumnya</span>
                              <strong>{row.harga_sebelumnya == null ? "-" : formatMoney(row.harga_sebelumnya)}</strong>
                              <small>{row.tanggal_sebelumnya ? formatDateLong(row.tanggal_sebelumnya) : "Tanpa histori"}</small>
                            </div>
                            <div>
                              <span>Sekarang</span>
                              <strong>{formatMoney(row.harga_sekarang)}</strong>
                              <small>{formatMoney(row.selisih_nominal || 0)} | {formatPercent(row.selisih_persen)}</small>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="status-quick-btn price-history-btn"
                            onClick={() => openMonitoringForRow(row)}
                            disabled={!canOpenHistory}
                          >
                            <AppIcon name="history" size={16} weight={APP_ICON_WEIGHT.action} />
                            Riwayat
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    Tidak ada item yang cocok dengan filter harga ini.
                  </div>
                )}
              </div>
            )}
          </section>

          <div id="price-monitoring-trend-section" className="price-history-panel">
            <PriceMonitoringModal
              embedded
              itemMasters={itemMasters}
              externalRequest={monitoringRequest}
            />
          </div>
        </div>
      </section>

      <Toast kind={toast.kind} message={toast.message} />
    </>
  );
}
