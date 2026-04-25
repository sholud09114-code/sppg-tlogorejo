import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import ItemMasterModal from "../components/ItemMasterModal.jsx";
import ShoppingReportDetail from "../components/ShoppingReportDetail.jsx";
import ShoppingReportForm from "../components/ShoppingReportForm.jsx";
import ShoppingReportTable from "../components/ShoppingReportTable.jsx";
import Toast from "../components/Toast.jsx";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import {
  createItemMaster,
  fetchMenuReports,
  createShoppingReport,
  deleteItemMaster,
  deleteShoppingReport,
  fetchItemMasters,
  fetchShoppingReportById,
  fetchShoppingReports,
  updateItemMaster,
  updateShoppingReport,
} from "../api/reportApi.js";

function formatMoney(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function getDifferenceTone(value) {
  const amount = Number(value || 0);
  if (amount > 0) return "positive";
  if (amount < 0) return "negative";
  return "neutral";
}

export default function ShoppingReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterItems, setMasterItems] = useState([]);
  const [menuReports, setMenuReports] = useState([]);
  const [masterLoading, setMasterLoading] = useState(true);
  const [masterModalOpen, setMasterModalOpen] = useState(false);
  const [masterSaving, setMasterSaving] = useState(false);
  const [selectedMasterItem, setSelectedMasterItem] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [toast, setToast] = useState({ kind: null, message: null });
  const isAdmin = user?.role === "admin";

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await fetchShoppingReports();
      setReports(data);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat laporan belanja: " + err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMasterItems = async () => {
    try {
      setMasterLoading(true);
      const data = await fetchItemMasters();
      setMasterItems(data);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat master barang: " + err.message,
      });
    } finally {
      setMasterLoading(false);
    }
  };

  const loadMenuReports = async () => {
    try {
      const data = await fetchMenuReports();
      setMenuReports(data);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat referensi laporan menu: " + err.message,
      });
    }
  };

  useEffect(() => {
    loadReports();
    loadMasterItems();
    loadMenuReports();
  }, []);

  const summary = useMemo(() => {
    return reports.reduce(
      (acc, report) => ({
        totalReports: acc.totalReports + 1,
        totalSpending: acc.totalSpending + Number(report.total_spending || 0),
        totalBudget: acc.totalBudget + Number(report.daily_budget || 0),
        totalDifference: acc.totalDifference + Number(report.difference_amount || 0),
      }),
      {
        totalReports: 0,
        totalSpending: 0,
        totalBudget: 0,
        totalDifference: 0,
      }
    );
  }, [reports]);

  const handleAdd = () => {
    if (!isAdmin) return;
    setSelectedReport(null);
    setFormOpen(true);
  };

  const handleView = async (report) => {
    try {
      const detail = await fetchShoppingReportById(report.id);
      setSelectedReport(detail);
      setDetailOpen(true);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat detail belanja: " + err.message,
      });
    }
  };

  const handleEdit = async (report) => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      const detail = await fetchShoppingReportById(report.id);
      setSelectedReport(detail);
      setFormOpen(true);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat data belanja: " + err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (report) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Hapus laporan belanja "${report.menu_name}" tanggal ${report.report_date}?`
    );
    if (!confirmed) return;

    try {
      await deleteShoppingReport(report.id);
      setReports((prev) => prev.filter((item) => item.id !== report.id));
      setToast({
        kind: "success",
        message: "Laporan belanja berhasil dihapus.",
      });
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menghapus laporan belanja: " + err.message,
      });
    }
  };

  const handleSubmit = async (payload) => {
    if (!isAdmin) return;
    try {
      setSaving(true);

      if (selectedReport?.id) {
        await updateShoppingReport(selectedReport.id, payload);
        setToast({
          kind: "success",
          message: "Laporan belanja berhasil diperbarui.",
        });
      } else {
        await createShoppingReport(payload);
        setToast({
          kind: "success",
          message: "Laporan belanja berhasil ditambahkan.",
        });
      }

      setFormOpen(false);
      setSelectedReport(null);
      await loadReports();
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menyimpan laporan belanja: " + err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMasterItem = async (payload) => {
    if (!isAdmin) return;
    try {
      setMasterSaving(true);
      await createItemMaster(payload);
      setToast({
        kind: "success",
        message: "Master barang berhasil ditambahkan.",
      });
      setSelectedMasterItem(null);
      await loadMasterItems();
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menambah master barang: " + err.message,
      });
    } finally {
      setMasterSaving(false);
    }
  };

  const handleUpdateMasterItem = async (id, payload) => {
    if (!isAdmin) return;
    try {
      setMasterSaving(true);
      await updateItemMaster(id, payload);
      setToast({
        kind: "success",
        message: "Master barang berhasil diperbarui.",
      });
      setSelectedMasterItem(null);
      await loadMasterItems();
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memperbarui master barang: " + err.message,
      });
    } finally {
      setMasterSaving(false);
    }
  };

  const handleDeleteMasterItem = async (item) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(`Hapus master barang "${item.item_name}"?`);
    if (!confirmed) return;

    try {
      await deleteItemMaster(item.id);
      setToast({
        kind: "success",
        message: "Master barang berhasil dihapus.",
      });
      if (selectedMasterItem?.id === item.id) {
        setSelectedMasterItem(null);
      }
      await loadMasterItems();
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menghapus master barang: " + err.message,
      });
    }
  };

  return (
    <>
      <section className="feature-page-card">
        <div className="page-title gap-4">
          <div className="min-w-0">
            <h2>Laporan Belanja</h2>
            <p>Lihat akumulasi laporan belanja harian dan input data manual.</p>
          </div>

          {isAdmin ? (
            <div className="page-actions action-toolbar-card w-full flex-wrap sm:w-auto sm:flex-nowrap">
              <button
                type="button"
                className="action-btn-secondary action-btn-secondary-soft w-full sm:w-auto"
                onClick={() => {
                  setSelectedMasterItem(null);
                  setMasterModalOpen(true);
                }}
                disabled={masterSaving}
              >
                Master Barang
              </button>
              <button
                type="button"
                className="submit-btn action-btn-primary-solid w-full sm:w-auto"
                onClick={handleAdd}
                disabled={saving}
              >
                + Tambah data
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetricCard
            label="Total laporan belanja"
            value={formatNumber(summary.totalReports)}
            icon="receipt"
            tone="blue"
          />
          <SummaryMetricCard
            label="Total akumulasi belanja"
            value={formatMoney(summary.totalSpending)}
            icon="money"
            tone="blue"
          />
          <SummaryMetricCard
            label="Total pagu"
            value={formatMoney(summary.totalBudget)}
            icon="budget"
            tone="blue"
          />
          <SummaryMetricCard
            className={`shopping-summary-difference-card shopping-summary-difference-card-${getDifferenceTone(
              summary.totalDifference
            )}`}
            label="Total selisih"
            value={formatMoney(summary.totalDifference)}
            icon="calculator"
            tone="blue"
          />
        </div>

        <div className="feature-data-panel mt-4">
          <ShoppingReportTable
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
        <ShoppingReportForm
          open={formOpen}
          initialData={selectedReport}
          itemMasters={masterItems.filter((item) => item.is_active)}
          menuReports={menuReports}
          loading={saving}
          onClose={() => {
            if (saving) return;
            setFormOpen(false);
            setSelectedReport(null);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      {isAdmin ? (
        <ItemMasterModal
          open={masterModalOpen}
          items={masterItems}
          loading={masterLoading}
          saving={masterSaving}
          selectedItem={selectedMasterItem}
          onClose={() => {
            if (masterSaving) return;
            setMasterModalOpen(false);
            setSelectedMasterItem(null);
          }}
          onCreate={handleCreateMasterItem}
          onUpdate={handleUpdateMasterItem}
          onEdit={setSelectedMasterItem}
          onDelete={handleDeleteMasterItem}
        />
      ) : null}

      <ShoppingReportDetail
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
