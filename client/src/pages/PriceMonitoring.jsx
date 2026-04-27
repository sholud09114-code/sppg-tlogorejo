import { useEffect, useState } from "react";
import PriceMonitoringModal from "../components/PriceMonitoringModal.jsx";
import ActionIconButton from "../components/ActionIconButton.jsx";
import LoadingMessage from "../components/LoadingMessage.jsx";
import Toast from "../components/Toast.jsx";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import {
  fetchItemMasters,
  fetchPriceIncreaseDetection,
  fetchShoppingReports,
} from "../api/shoppingReportApi.js";
import { formatDateLong, formatMoney } from "../shared/utils/formatters.js";

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

  useEffect(() => {
    Promise.all([fetchItemMasters(), fetchShoppingReports()])
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

  const detectionSummary = detectionData?.summary || {};

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
      <section className="feature-page-card">
        <div className="page-title gap-4">
          <div className="min-w-0">
            <h2>Monitoring Harga</h2>
            <p>Pantau perubahan harga barang dari waktu ke waktu berdasarkan laporan belanja.</p>
          </div>
        </div>

        {loading ? (
          <LoadingMessage>Memuat master barang...</LoadingMessage>
        ) : (
          <div className="space-y-6">
            <div id="price-monitoring-trend-section">
              <PriceMonitoringModal
                embedded
                itemMasters={itemMasters}
                externalRequest={monitoringRequest}
              />
            </div>

            <section className="weekly-section">
              <div className="page-title weekly-section-head">
                <div>
                  <h2>Deteksi Kenaikan Harga</h2>
                  <p>Periksa semua item belanja pada satu tanggal dan bandingkan dengan harga sebelumnya.</p>
                </div>
              </div>

              <form className="weekly-filter-panel" onSubmit={handleDetectionSubmit}>
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
                <div className="weekly-summary-grid price-monitoring-mobile-summary-grid">
                  <SummaryMetricCard
                    className="price-monitoring-mobile-summary-card"
                    label="Total item diperiksa"
                    value={Number(detectionSummary.total_checked || 0).toLocaleString("id-ID")}
                    icon="database"
                    tone="blue"
                  />
                  <SummaryMetricCard
                    className="price-monitoring-mobile-summary-card"
                    label="Jumlah barang naik"
                    value={Number(detectionSummary.increased_count || 0).toLocaleString("id-ID")}
                    icon="trendingUp"
                    tone="green"
                  />
                  <SummaryMetricCard
                    className="price-monitoring-mobile-summary-card"
                    label="Jumlah barang turun"
                    value={Number(detectionSummary.decreased_count || 0).toLocaleString("id-ID")}
                    icon="trendingDown"
                    tone="amber"
                  />
                  <SummaryMetricCard
                    className="price-monitoring-mobile-summary-card"
                    label="Jumlah barang tetap"
                    value={Number(detectionSummary.unchanged_count || 0).toLocaleString("id-ID")}
                    icon="activity"
                    tone="blue"
                  />
                  <SummaryMetricCard
                    className="price-monitoring-mobile-summary-card"
                    label="Tanpa histori"
                    value={Number(detectionSummary.no_history_count || 0).toLocaleString("id-ID")}
                    icon="database"
                    tone="blue"
                  />
                </div>

                {detectionData.rows.length > 0 ? (
                  <div className="table-wrap">
                    <table className="data-table min-w-[1280px]">
                      <thead>
                        <tr>
                          <th className="text-left">Kode Barang</th>
                          <th className="text-left">Nama Barang</th>
                          <th className="text-left">Tanggal Sebelumnya</th>
                          <th className="text-right">Harga Sebelumnya</th>
                          <th className="text-right">Harga Sekarang</th>
                          <th className="text-right">Selisih Nominal</th>
                          <th className="text-right">Selisih Persen</th>
                          <th className="text-center">Status</th>
                          <th className="text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detectionData.rows.map((row) => (
                          <tr key={`${row.report_item_id}-${row.kode_barang}-${row.nama_barang}`}>
                            <td className="text-left">{row.kode_barang}</td>
                            <td className="text-left">{row.nama_barang}</td>
                            <td className="text-left">{row.tanggal_sebelumnya ? formatDateLong(row.tanggal_sebelumnya) : "-"}</td>
                            <td className="text-right">{row.harga_sebelumnya == null ? "-" : formatMoney(row.harga_sebelumnya)}</td>
                            <td className="text-right">{formatMoney(row.harga_sekarang)}</td>
                            <td className="text-right">{row.selisih_nominal == null ? "-" : formatMoney(row.selisih_nominal)}</td>
                            <td className="text-right">{formatPercent(row.selisih_persen)}</td>
                            <td className="text-center">
                              <span className={`price-status-badge ${row.status.replace(/\s+/g, "-")}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="text-center">
                              <ActionIconButton
                                action="history"
                                label="Lihat Riwayat"
                                onClick={() => openMonitoringForRow(row)}
                                disabled={
                                  row.status === "tanpa histori" ||
                                  (!row.master_item_id && !row.nama_barang_query && !row.nama_barang)
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    Tidak ada item yang cocok dengan filter deteksi kenaikan pada tanggal ini.
                  </div>
                )}
              </div>
            )}
            </section>
          </div>
        )}
      </section>

      <Toast kind={toast.kind} message={toast.message} />
    </>
  );
}
