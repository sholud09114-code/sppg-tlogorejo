import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import MenuPlanDetail from "../components/MenuPlanDetail.jsx";
import MenuPlanForm from "../components/MenuPlanForm.jsx";
import MenuPlanDailyTable from "../components/MenuPlanDailyTable.jsx";
import MenuPlanImportModal from "../components/MenuPlanImportModal.jsx";
import MenuPlanTable from "../components/MenuPlanTable.jsx";
import Toast from "../components/Toast.jsx";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import {
  ActionToolbar,
  DataPanel,
  PageHeader,
  PageShell,
} from "../components/ui/index.js";
import { AppIcon, APP_ICON_WEIGHT } from "../components/ui/appIcons.jsx";
import {
  createMenuPlan,
  deleteMenuPlan,
  fetchMenuPlanById,
  fetchMenuPlans,
  getCachedMenuPlans,
  updateMenuPlan,
} from "../api/menuPlanApi.js";
import { monthLabel } from "../shared/utils/menuPlanHelpers.js";

export default function MenuPlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState("daily");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [toast, setToast] = useState({ kind: null, message: null });
  const isAdmin = user?.role === "admin";

  const loadPlans = async (mode = viewMode) => {
    const includeItems = mode === "daily";
    const cached = getCachedMenuPlans({ includeItems });
    if (cached) {
      setPlans(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data = await fetchMenuPlans({
        force: Boolean(cached),
        includeItems,
      });
      setPlans(data);
    } catch (err) {
      if (!cached) {
        setToast({
          kind: "danger",
          message: "Gagal memuat rencana menu: " + err.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans(viewMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const summary = useMemo(() => {
    const latest = plans[0];
    return {
      totalPlans: plans.length,
      latestLabel: latest
        ? `${monthLabel(latest.month)} ${latest.year} (Minggu ke-${latest.week_number})`
        : "-",
    };
  }, [plans]);

  const handleAdd = () => {
    if (!isAdmin) return;
    setSelectedPlan(null);
    setFormOpen(true);
  };

  const handleView = async (plan) => {
    try {
      const detail = await fetchMenuPlanById(plan.id);
      setSelectedPlan(detail);
      setDetailOpen(true);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat detail rencana: " + err.message,
      });
    }
  };

  const handleEdit = async (plan) => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      const detail = await fetchMenuPlanById(plan.id);
      setSelectedPlan(detail);
      setFormOpen(true);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat rencana menu: " + err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Hapus rencana menu ${monthLabel(plan.month)} ${plan.year} minggu ke-${plan.week_number}?`
    );
    if (!confirmed) return;

    try {
      await deleteMenuPlan(plan.id);
      setPlans((prev) => prev.filter((item) => item.id !== plan.id));
      setToast({ kind: "success", message: "Rencana menu berhasil dihapus." });
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menghapus rencana menu: " + err.message,
      });
    }
  };

  const handleSubmit = async (payload) => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      if (selectedPlan?.id) {
        await updateMenuPlan(selectedPlan.id, payload);
        setToast({ kind: "success", message: "Rencana menu berhasil diperbarui." });
      } else {
        await createMenuPlan(payload);
        setToast({ kind: "success", message: "Rencana menu berhasil dibuat." });
      }
      setFormOpen(false);
      setSelectedPlan(null);
      await loadPlans(viewMode);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menyimpan rencana menu: " + err.message,
      });
    } finally {
      setSaving(false);
    }
  };


  const handleCopyDay = ({ ok, text, dayLabel, planDate }) => {
    if (!text) {
      setToast({ kind: "info", message: "Belum ada menu yang bisa disalin." });
      return;
    }
    if (ok) {
      const dateLabel = planDate ? ` (${planDate})` : "";
      setToast({
        kind: "success",
        message: `Menu ${dayLabel || ""}${dateLabel} disalin: ${text}`,
      });
    } else {
      setToast({
        kind: "danger",
        message: "Gagal menyalin ke clipboard. Salin manual: " + text,
      });
    }
  };
  return (
    <>
      <PageShell className="menu-plans-page">
        <PageHeader
          icon="menuReports"
          title="Rencana Menu"
          description="Susun rencana menu mingguan per kategori untuk dipakai sebagai acuan saat input laporan harian."
          actions={
            isAdmin ? (
              <ActionToolbar className="w-full sm:w-auto">
                <button
                  type="button"
                  className="action-btn-secondary button-with-icon w-full sm:w-auto"
                  onClick={() => setImportOpen(true)}
                  disabled={saving}
                >
                  <AppIcon name="import" size={18} weight={APP_ICON_WEIGHT.action} />
                  <span>Import dari gambar</span>
                </button>
                <button
                  type="button"
                  className="submit-btn action-btn-primary-solid button-with-icon w-full sm:w-auto"
                  onClick={handleAdd}
                  disabled={saving}
                >
                  <AppIcon name="add" size={18} weight={APP_ICON_WEIGHT.action} />
                  <span>Tambah rencana</span>
                </button>
              </ActionToolbar>
            ) : null
          }
        />

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2">
          <SummaryMetricCard
            label="Total rencana"
            value={summary.totalPlans.toLocaleString("id-ID")}
            icon="totalData"
            tone="blue"
          />
          <SummaryMetricCard
            label="Rencana terbaru"
            value={summary.latestLabel}
            icon="menu"
            tone="green"
          />
        </div>

        <div className="menu-plan-view-toggle" role="tablist" aria-label="Mode tampilan rencana menu">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "daily"}
            className={`menu-plan-view-toggle-btn ${viewMode === "daily" ? "active" : ""}`}
            onClick={() => setViewMode("daily")}
          >
            <AppIcon name="daily" size={16} weight={APP_ICON_WEIGHT.action} />
            <span>Per hari</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "weekly"}
            className={`menu-plan-view-toggle-btn ${viewMode === "weekly" ? "active" : ""}`}
            onClick={() => setViewMode("weekly")}
          >
            <AppIcon name="weekly" size={16} weight={APP_ICON_WEIGHT.action} />
            <span>Per minggu</span>
          </button>
        </div>

        <DataPanel>
          {viewMode === "daily" ? (
            <MenuPlanDailyTable
              plans={plans}
              loading={loading}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              canManage={isAdmin}
              onCopyDay={handleCopyDay}
            />
          ) : (
            <MenuPlanTable
              plans={plans}
              loading={loading}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              canManage={isAdmin}
            />
          )}
        </DataPanel>
      </PageShell>

      <Toast kind={toast.kind} message={toast.message} />

      {isAdmin ? (
        <MenuPlanForm
          open={formOpen}
          initialData={selectedPlan}
          loading={saving}
          onClose={() => {
            if (saving) return;
            setFormOpen(false);
            setSelectedPlan(null);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      {isAdmin ? (
        <MenuPlanImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onApply={(draft) => {
            setImportOpen(false);
            setSelectedPlan({
              id: null,
              year: draft.year,
              month: draft.month,
              week_number: draft.week_number,
              start_date: draft.start_date,
              end_date: draft.end_date,
              notes: draft.notes,
              items: draft.items,
            });
            setFormOpen(true);
          }}
        />
      ) : null}

      <MenuPlanDetail
        open={detailOpen}
        data={selectedPlan}
        onCopyDay={handleCopyDay}
        onClose={() => {
          setDetailOpen(false);
          setSelectedPlan(null);
        }}
      />
    </>
  );
}
