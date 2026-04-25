import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import MenuReportDetail from "../components/MenuReportDetail.jsx";
import MenuReportForm from "../components/MenuReportForm.jsx";
import MenuReportTable from "../components/MenuReportTable.jsx";
import Toast from "../components/Toast.jsx";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "../components/ui/appIcons.jsx";
import {
  createMenuReport,
  deleteMenuReport,
  fetchMenuReportById,
  fetchMenuReports,
  updateMenuReport,
} from "../api/menuReportApi.js";

export default function MenuReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [toast, setToast] = useState({ kind: null, message: null });
  const isAdmin = user?.role === "admin";

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await fetchMenuReports();
      setReports(data);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat data menu: " + err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const summary = useMemo(() => {
    const latestMenu = reports[0] || null;
    const latestMenuNames = latestMenu
      ? [
          latestMenu.menu_name_1,
          latestMenu.menu_name_2,
          latestMenu.menu_name_3,
          latestMenu.menu_name_4,
          latestMenu.menu_name_5,
        ]
          .filter(Boolean)
          .join(", ") || latestMenu.menu_name
      : null;

    return {
      totalMenus: reports.length,
      latestMenu: latestMenu
        ? `${latestMenuNames} (${latestMenu.menu_date})`
        : "-",
    };
  }, [reports]);

  const handleAdd = () => {
    if (!isAdmin) return;
    setSelectedReport(null);
    setFormOpen(true);
  };

  const handleView = async (report) => {
    try {
      const detail = await fetchMenuReportById(report.id);
      setSelectedReport(detail);
      setDetailOpen(true);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat detail menu: " + err.message,
      });
    }
  };

  const handleEdit = async (report) => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      const detail = await fetchMenuReportById(report.id);
      setSelectedReport(detail);
      setFormOpen(true);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat data menu: " + err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (report) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(`Hapus menu "${report.menu_name}"?`);
    if (!confirmed) return;

    try {
      await deleteMenuReport(report.id);
      setReports((prev) => prev.filter((item) => item.id !== report.id));
      setToast({
        kind: "success",
        message: "Data menu berhasil dihapus.",
      });
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menghapus data menu: " + err.message,
      });
    }
  };

  const getDuplicateReportsByDate = (menuDate, excludedId = null) =>
    reports
      .filter(
        (item) => item.menu_date === menuDate && (excludedId == null || item.id !== excludedId)
      )
      .sort((a, b) => b.id - a.id);

  const handleSubmit = async (payload) => {
    if (!isAdmin) return;
    try {
      setSaving(true);

      const duplicateReports = getDuplicateReportsByDate(payload.menu_date, selectedReport?.id);
      const hasDuplicateDate = duplicateReports.length > 0;
      const duplicateCount = duplicateReports.length + (selectedReport?.id ? 1 : 0);

      if (hasDuplicateDate) {
        const confirmed = window.confirm(
          `Ada ${duplicateCount} data menu pada tanggal ${payload.menu_date}. Data lama akan diganti dengan input terbaru dan duplikasi lain pada tanggal ini akan dihapus. Lanjutkan?`
        );

        if (!confirmed) {
          return;
        }
      }

      if (selectedReport?.id) {
        await updateMenuReport(selectedReport.id, payload);

        if (hasDuplicateDate) {
          await Promise.all(duplicateReports.map((report) => deleteMenuReport(report.id)));
        }

        setToast({
          kind: "success",
          message: hasDuplicateDate
            ? "Data duplikat tanggal menu berhasil diganti dengan input terbaru."
            : "Data menu berhasil diperbarui.",
        });
      } else {
        if (hasDuplicateDate) {
          const [latestDuplicate, ...otherDuplicates] = duplicateReports;
          await updateMenuReport(latestDuplicate.id, payload);
          if (otherDuplicates.length > 0) {
            await Promise.all(otherDuplicates.map((report) => deleteMenuReport(report.id)));
          }
        } else {
          await createMenuReport(payload);
        }

        setToast({
          kind: "success",
          message: hasDuplicateDate
            ? "Data duplikat tanggal menu berhasil diganti dengan input terbaru."
            : "Data menu berhasil ditambahkan.",
        });
      }

      setFormOpen(false);
      setSelectedReport(null);
      await loadReports();
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menyimpan data menu: " + err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="feature-page-card">
        <div className="page-title gap-4">
          <div className="min-w-0">
            <h2>Laporan Menu</h2>
            <p>Lihat daftar menu dan kandungan gizi yang pernah diinput.</p>
          </div>

          {isAdmin ? (
            <div className="page-actions action-toolbar-card w-full sm:w-auto">
              <button
                type="button"
                className="submit-btn action-btn-primary-solid w-full sm:w-auto"
                onClick={handleAdd}
                disabled={saving}
              >
                + Tambah menu
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2">
          <SummaryMetricCard
            label="Total data menu"
            value={summary.totalMenus.toLocaleString("id-ID")}
            icon="totalData"
            tone="blue"
          />
          <div className="summary-card home-feature-card home-feature-card-strong">
            <div className="home-feature-icon-wrap">
              <div className="summary-metric-icon summary-metric-icon-blue">
                <AppIcon name="menu" weight={APP_ICON_WEIGHT.summary} />
              </div>
            </div>
            <div className="home-feature-main">
              <span className="summary-card-label">Menu terbaru</span>
              <strong className="home-feature-title text-base">{summary.latestMenu}</strong>
            </div>
          </div>
        </div>

        <div className="feature-data-panel mt-4">
          <MenuReportTable
            reports={reports}
            loading={loading}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canManage={isAdmin}
          />
        </div>
      </section>

      <Toast kind={toast.kind} message={toast.message} />

      {isAdmin ? (
        <MenuReportForm
          open={formOpen}
          initialData={selectedReport}
          loading={saving}
          onClose={() => {
            if (saving) return;
            setFormOpen(false);
            setSelectedReport(null);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      <MenuReportDetail
        open={detailOpen}
        data={selectedReport}
        onClose={() => {
          setDetailOpen(false);
          setSelectedReport(null);
        }}
      />
    </>
  );
}
