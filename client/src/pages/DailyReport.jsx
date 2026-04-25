import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import DateInput from "../components/DateInput.jsx";
import CategoryGroup from "../components/CategoryGroup.jsx";
import DailyReportDetailModal from "../components/DailyReportDetailModal.jsx";
import DailyReportImportModal from "../components/DailyReportImportModal.jsx";
import DailyReportTable from "../components/DailyReportTable.jsx";
import SummaryPanel from "../components/SummaryPanel.jsx";
import Toast from "../components/Toast.jsx";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "../components/ui/appIcons.jsx";
import {
  deleteReport,
  fetchUnits,
  fetchReportByDate,
  fetchReportsForPrint,
  listReports,
  saveReport,
} from "../api/reportApi.js";

const CATEGORY_ORDER = ["PAUD/TK/KB", "SD", "SMP", "SMK"];

// get today's date as YYYY-MM-DD in local time zone
function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function formatDateLong(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPrintHtml(reports) {
  const sections = reports
    .map((report) => {
      const rows = report.details
        .map(
          (detail, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(detail.category)}</td>
              <td>${escapeHtml(detail.unit_name)}</td>
              <td>${Number(detail.target_pm || 0).toLocaleString("id-ID")}</td>
              <td>${escapeHtml(detail.service_status)}</td>
              <td>${Number(detail.actual_pm || 0).toLocaleString("id-ID")}</td>
            </tr>`
        )
        .join("");

      return `
        <section class="print-report-section">
          <div class="print-report-header">
            <div>
              <h2>Laporan Harian ${escapeHtml(formatDateLong(report.report_date))}</h2>
              <p>Total PM: ${Number(report.total_pm || 0).toLocaleString("id-ID")}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Kategori</th>
                <th>Kelompok</th>
                <th>Target</th>
                <th>Status</th>
                <th>Aktual</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`;
    })
    .join("");

  return `<!doctype html>
  <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <title>Cetak Laporan Harian</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #1a1a1a; }
        h1 { margin: 0 0 8px; font-size: 24px; text-align: center; }
        p { margin: 0 0 16px; text-align: center; }
        .print-report-section { margin-top: 28px; page-break-inside: avoid; }
        .print-report-section + .print-report-section { page-break-before: always; }
        .print-report-header { margin-bottom: 12px; text-align: center; }
        h2 { margin: 0 0 6px; font-size: 18px; text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #cfcfcf; padding: 8px; text-align: center; font-size: 12px; }
        th { background: #f3f3f3; }
      </style>
    </head>
    <body>
      <h1>SPPG Tlogorejo</h1>
      <p>Rekap laporan penerima manfaat harian</p>
      ${sections}
    </body>
  </html>`;
}

function deriveEntrySplit(unit, detail) {
  const actualPm = Number(detail.actual_pm || 0);
  const targetSmall = Number(
    detail.target_small_portion ?? unit.small_target ?? 0
  );
  const targetLarge = Number(
    detail.target_large_portion ?? unit.large_target ?? 0
  );
  const providedSmall = Number(detail.actual_small_portion || 0);
  const providedLarge = Number(detail.actual_large_portion || 0);

  if (providedSmall + providedLarge === actualPm) {
    return {
      actual_small_portion: providedSmall,
      actual_large_portion: providedLarge,
    };
  }

  const totalTarget = targetSmall + targetLarge;
  if (actualPm <= 0 || totalTarget <= 0) {
    return { actual_small_portion: 0, actual_large_portion: 0 };
  }

  if (targetSmall <= 0) {
    return { actual_small_portion: 0, actual_large_portion: actualPm };
  }

  if (targetLarge <= 0) {
    return { actual_small_portion: actualPm, actual_large_portion: 0 };
  }

  const rawSmall = (targetSmall / totalTarget) * actualPm;
  let actualSmall = Math.round(rawSmall);
  actualSmall = Math.max(0, Math.min(actualSmall, actualPm, targetSmall));
  const actualLarge = actualPm - actualSmall;

  return {
    actual_small_portion: actualSmall,
    actual_large_portion: actualLarge,
  };
}

export default function DailyReport() {
  const { user } = useAuth();
  const [units, setUnits] = useState([]);
  const [entries, setEntries] = useState({});
  const [date, setDate] = useState(getTodayISO());
  const [toast, setToast] = useState({ kind: null, message: null });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailReport, setDetailReport] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printRange, setPrintRange] = useState({
    date_from: getTodayISO(),
    date_to: getTodayISO(),
  });
  const [printing, setPrinting] = useState(false);
  const isAdmin = user?.role === "admin";

  const loadReportList = async () => {
    try {
      setReportsLoading(true);
      const data = await listReports(100);
      setReports(data);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat daftar laporan: " + err.message,
      });
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits()
      .then((data) => {
        setUnits(data);
        setFetching(false);
      })
      .catch((err) => {
        setToast({
          kind: "danger",
          message: "Gagal memuat daftar unit: " + err.message,
        });
        setFetching(false);
      });

    loadReportList();
  }, []);

  useEffect(() => {
    if (!units.length || !editorOpen) return;
    fetchReportByDate(date)
      .then((report) => {
        if (report.exists) {
          const newEntries = {};
          report.details.forEach((d) => {
            const unit = units.find((item) => item.id === d.unit_id) || {};
            const split = deriveEntrySplit(unit, d);
            newEntries[d.unit_id] = {
              service_status: d.service_status,
              actual_pm: d.actual_pm,
              actual_small_portion: split.actual_small_portion,
              actual_large_portion: split.actual_large_portion,
              error: null,
            };
          });
          setEntries(newEntries);
          setToast({
            kind: "info",
            message: "Laporan untuk tanggal ini sudah ada — mode edit aktif.",
          });
        } else {
          setEntries({});
          setToast({ kind: null, message: null });
        }
      })
      .catch((err) => {
        setToast({
          kind: "danger",
          message: "Gagal memuat laporan: " + err.message,
        });
      });
  }, [date, units.length, editorOpen]);

  const handleEntryChange = (unitId, newEntry) => {
    setEntries((prev) => ({ ...prev, [unitId]: newEntry }));
  };

  const grouped = useMemo(() => {
    const out = {};
    CATEGORY_ORDER.forEach((c) => {
      out[c] = [];
    });
    units.forEach((u) => {
      if (out[u.category]) out[u.category].push(u);
    });
    return out;
  }, [units]);

  const totals = useMemo(() => {
    const out = { "PAUD/TK/KB": 0, SD: 0, SMP: 0, SMK: 0 };
    units.forEach((u) => {
      const e = entries[u.id];
      if (e && e.service_status) out[u.category] += Number(e.actual_pm) || 0;
    });
    return out;
  }, [units, entries]);

  const totalFilled = useMemo(
    () => units.filter((u) => entries[u.id]?.service_status).length,
    [units, entries]
  );

  const isAllFullSelected = useMemo(
    () =>
      units.length > 0 &&
      units.every(
        (unit) =>
          entries[unit.id]?.service_status === "penuh" &&
          Number(entries[unit.id]?.actual_pm || 0) === Number(unit.default_target)
      ),
    [units, entries]
  );

  const reportSummary = useMemo(() => {
    const totalPm = reports.reduce(
      (sum, report) => sum + Number(report.total_pm || 0),
      0
    );

    return {
      totalReports: reports.length,
      totalPm,
    };
  }, [reports]);

  const openNewReport = () => {
    if (!isAdmin) return;
    setDate(getTodayISO());
    setEntries({});
    setEditorOpen(true);
    setToast({ kind: null, message: null });
  };

  const openEditReport = (reportDate) => {
    if (!isAdmin) return;
    setDate(reportDate);
    setEditorOpen(true);
  };

  const handleViewReport = async (report) => {
    try {
      const detail = await fetchReportByDate(report.report_date);
      if (!detail.exists) {
        setToast({
          kind: "warning",
          message: "Detail laporan tidak ditemukan.",
        });
        return;
      }

      setDetailReport(detail);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat detail laporan: " + err.message,
      });
    }
  };

  const handleDeleteReport = async (report) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Hapus laporan tanggal ${formatDateLong(report.report_date)}?`
    );
    if (!confirmed) return;

    try {
      await deleteReport(report.id);
      await loadReportList();

      if (editorOpen && date === report.report_date) {
        setEditorOpen(false);
        setEntries({});
      }

      if (detailReport?.id === report.id) {
        setDetailReport(null);
      }

      setToast({
        kind: "success",
        message: "Laporan harian berhasil dihapus.",
      });
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menghapus laporan: " + err.message,
      });
    }
  };

  const handleFillAllFull = () => {
    if (!isAdmin) return;
    const filledEntries = {};
    units.forEach((unit) => {
      filledEntries[unit.id] = {
        service_status: "penuh",
        actual_pm: unit.default_target,
        actual_small_portion: Number(unit.small_target || 0),
        actual_large_portion: Number(unit.large_target || 0),
        error: null,
      };
    });
    setEntries(filledEntries);
  };

  const handleImportedReports = async (result) => {
    if (!isAdmin) return;
    setImportModalOpen(false);
    await loadReportList();
    setToast({
      kind: "success",
      message: `Import berhasil. ${result.imported_count.toLocaleString("id-ID")} tanggal diproses, ${result.created_count.toLocaleString("id-ID")} baru dan ${result.updated_count.toLocaleString("id-ID")} diperbarui.`,
    });
  };

  const handlePrint = async () => {
    if (!printRange.date_from || !printRange.date_to) {
      setToast({
        kind: "warning",
        message: "Pilih tanggal awal dan akhir laporan terlebih dahulu.",
      });
      return;
    }

    if (printRange.date_from > printRange.date_to) {
      setToast({
        kind: "warning",
        message: "Tanggal akhir tidak boleh lebih kecil dari tanggal awal.",
      });
      return;
    }

    try {
      setPrinting(true);
      const data = await fetchReportsForPrint(
        printRange.date_from,
        printRange.date_to
      );

      if (!data.length) {
        setToast({
          kind: "warning",
          message: "Tidak ada laporan pada rentang tanggal tersebut.",
        });
        return;
      }

      const printWindow = window.open("", "_blank", "width=1024,height=768");
      if (!printWindow) {
        setToast({
          kind: "danger",
          message: "Popup cetak diblokir browser.",
        });
        return;
      }

      printWindow.document.open();
      printWindow.document.write(buildPrintHtml(data));
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      setPrintModalOpen(false);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menyiapkan cetak: " + err.message,
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleSubmit = async () => {
    if (!isAdmin) return;
    const missing = units.filter((u) => !entries[u.id]?.service_status).length;
    if (missing > 0) {
      setToast({
        kind: "warning",
        message: `Masih ada ${missing} unit yang belum diisi. Lengkapi semua status sebelum submit.`,
      });
      return;
    }

    const hasErr = units.some((u) => entries[u.id]?.error);
    if (hasErr) {
      setToast({
        kind: "danger",
        message: "Perbaiki error pada form sebelum submit.",
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        report_date: date,
        details: units.map((u) => ({
          unit_id: u.id,
          target_pm: u.default_target,
          target_small_portion: Number(u.small_target || 0),
          target_large_portion: Number(u.large_target || 0),
          service_status: entries[u.id].service_status,
          actual_pm: entries[u.id].actual_pm || 0,
          actual_small_portion: entries[u.id].actual_small_portion || 0,
          actual_large_portion: entries[u.id].actual_large_portion || 0,
        })),
      };
      const result = await saveReport(payload);
      await loadReportList();
      setToast({
        kind: "success",
        message: `${result.updated ? "Diperbarui" : "Tersimpan"} — laporan ${date} dengan total ${result.total_pm.toLocaleString("id-ID")} PM.`,
      });
      setEditorOpen(false);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menyimpan: " + err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <section className="feature-page-card">
        <div className="loading">Memuat data kelompok...</div>
      </section>
    );
  }

  return (
    <>
      <section className="feature-page-card">
        <div className="page-title gap-4">
          <div className="min-w-0">
            <h2>Laporan penerima manfaat (PM) harian</h2>
            <p>Lihat riwayat laporan dan input pelayanan harian per tanggal.</p>
          </div>
          <div className="page-actions action-toolbar-card action-toolbar-card-wide w-full sm:w-auto">
            <div className="action-toolbar-secondary w-full sm:w-auto">
              {isAdmin ? (
                <button
                  type="button"
                  className="action-btn-secondary action-btn-secondary-soft w-full sm:w-auto"
                  onClick={() => setImportModalOpen(true)}
                  disabled={loading || reportsLoading}
                >
                  <span className="button-with-icon">
                    <AppIcon name="import" size={18} weight={APP_ICON_WEIGHT.nav} className="button-icon" />
                    <span>Import CSV/Excel</span>
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                className="action-btn-secondary action-btn-secondary-soft w-full sm:w-auto"
                onClick={() => setPrintModalOpen(true)}
                disabled={loading || reportsLoading}
              >
                <span className="button-with-icon">
                  <AppIcon name="print" size={18} weight={APP_ICON_WEIGHT.nav} className="button-icon" />
                  <span>Cetak</span>
                </span>
              </button>
            </div>
            {isAdmin ? (
              <button
                type="button"
                className="submit-btn action-btn-primary-solid"
                onClick={openNewReport}
                disabled={loading}
              >
                <span className="button-with-icon">
                  <AppIcon name="daily" size={18} weight={APP_ICON_WEIGHT.nav} className="button-icon" />
                  <span>+ Tambah laporan</span>
                </span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2">
          <SummaryMetricCard
            label="Total laporan harian"
            value={reportSummary.totalReports.toLocaleString("id-ID")}
            icon="totalData"
            tone="blue"
          />
          <SummaryMetricCard
            label="Akumulasi total pelayanan"
            value={reportSummary.totalPm.toLocaleString("id-ID")}
            icon="beneficiaries"
            tone="blue"
            emphasis
          />
        </div>

        <div className="feature-data-panel mt-4">
          <DailyReportTable
            reports={reports}
            loading={reportsLoading}
            onView={handleViewReport}
            onEdit={openEditReport}
            onDelete={handleDeleteReport}
            canManage={isAdmin}
          />
        </div>
      </section>

      {detailReport && (
        <DailyReportDetailModal
          report={detailReport}
          onClose={() => setDetailReport(null)}
        />
      )}

      {isAdmin && editorOpen && (
        <div className="modal-backdrop p-3 sm:p-4" role="presentation">
          <div className="modal-card report-modal-card w-full max-w-6xl rounded-2xl p-4 sm:p-5" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="min-w-0 flex-1">
                <h3>Form input laporan harian</h3>
                <p>Isi seluruh kelompok untuk tanggal laporan yang dipilih.</p>
                <div className="quick-action-panel mt-4">
                  <div className="quick-action-copy">
                    <strong>Isi cepat</strong>
                    <p>
                      Gunakan aksi ini jika pada tanggal tersebut semua sekolah
                      dilayani dengan porsi penuh.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`w-full sm:w-auto ${
                      isAllFullSelected ? "status-quick-btn active" : "status-quick-btn"
                    }`}
                    onClick={handleFillAllFull}
                    disabled={loading}
                  >
                    Semua sekolah dilayani penuh
                  </button>
                </div>
              </div>
              <div className="page-actions page-actions-stack report-header-actions w-full sm:w-auto">
                <DateInput value={date} onChange={setDate} />
                <button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    if (loading) return;
                    setEditorOpen(false);
                  }}
                  disabled={loading}
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="report-modal-grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="groups space-y-4">
                {CATEGORY_ORDER.map(
                  (cat) =>
                    grouped[cat]?.length > 0 && (
                      <CategoryGroup
                        key={cat}
                        category={cat}
                        units={grouped[cat]}
                        entries={entries}
                        onEntryChange={handleEntryChange}
                      />
                    )
                )}
              </div>

              <SummaryPanel
                totals={totals}
                totalFilled={totalFilled}
                totalUnits={units.length}
                onSubmit={handleSubmit}
                loading={loading}
                className="desktop-summary-panel"
              />
            </div>

            <div className="mobile-submit-bar">
              <div className="mobile-submit-bar-copy">
                <strong>{Object.values(totals).reduce((sum, value) => sum + value, 0).toLocaleString("id-ID")} PM</strong>
                <span>
                  {totalFilled} dari {units.length} unit diisi
                </span>
              </div>
              <button
                type="button"
                className="submit-btn mobile-submit-btn"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Menyimpan..." : "Simpan laporan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {printModalOpen && (
        <div className="modal-backdrop p-3 sm:p-4" role="presentation">
          <div className="modal-card w-full max-w-2xl rounded-2xl p-4 sm:p-5" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="min-w-0">
                <h3>Cetak laporan harian</h3>
                <p>Pilih rentang tanggal laporan yang ingin dicetak.</p>
              </div>
              <button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => {
                  if (printing) return;
                  setPrintModalOpen(false);
                }}
                disabled={printing}
              >
                Tutup
              </button>
            </div>

            <div className="form-grid grid-cols-1 md:grid-cols-2">
              <div className="form-field">
                <label htmlFor="print-date-from">Dari tanggal</label>
                <input
                  id="print-date-from"
                  type="date"
                  className="w-full"
                  value={printRange.date_from}
                  onChange={(e) =>
                    setPrintRange((prev) => ({
                      ...prev,
                      date_from: e.target.value,
                    }))
                  }
                  disabled={printing}
                />
              </div>
              <div className="form-field">
                <label htmlFor="print-date-to">Sampai tanggal</label>
                <input
                  id="print-date-to"
                  type="date"
                  className="w-full"
                  value={printRange.date_to}
                  onChange={(e) =>
                    setPrintRange((prev) => ({
                      ...prev,
                      date_to: e.target.value,
                    }))
                  }
                  disabled={printing}
                />
              </div>
            </div>

            <div className="modal-actions mt-4">
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                disabled={printing}
              >
                Batal
              </button>
              <button
                type="button"
                className="submit-btn"
                onClick={handlePrint}
                disabled={printing}
              >
                {printing ? "Menyiapkan..." : "Cetak laporan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin ? (
        <DailyReportImportModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImported={handleImportedReports}
          units={units}
        />
      ) : null}

      <Toast kind={toast.kind} message={toast.message} />
    </>
  );
}
