import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import BeneficiaryGroupForm from "../components/BeneficiaryGroupForm.jsx";
import BeneficiaryGroupImportModal from "../components/BeneficiaryGroupImportModal.jsx";
import BeneficiaryGroupTable from "../components/BeneficiaryGroupTable.jsx";
import Toast from "../components/Toast.jsx";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import {
  createBeneficiaryGroup,
  deleteBeneficiaryGroup,
  fetchBeneficiaryGroupById,
  fetchBeneficiaryGroups,
  updateBeneficiaryGroup,
} from "../api/reportApi.js";

const GROUP_TYPE_OPTIONS = ["Paud/KB/TK", "SD", "SMP/MTs", "SMK"];

export default function BeneficiaryGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupTypeFilter, setGroupTypeFilter] = useState("all");
  const [toast, setToast] = useState({ kind: null, message: null });
  const isAdmin = user?.role === "admin";

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await fetchBeneficiaryGroups();
      setGroups(data);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat data kelompok: " + err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const filteredGroups = useMemo(() => {
    if (groupTypeFilter === "all") {
      return groups;
    }

    return groups.filter((group) => group.group_type === groupTypeFilter);
  }, [groups, groupTypeFilter]);

  const summary = useMemo(() => {
    const totalPortion = filteredGroups.reduce(
      (sum, item) => sum + Number(item.total_portion || 0),
      0
    );
    const paudTotal = filteredGroups
      .filter((item) => item.group_type === "Paud/KB/TK")
      .reduce((sum, item) => sum + Number(item.total_portion || 0), 0);
    const sdTotal = filteredGroups
      .filter((item) => item.group_type === "SD")
      .reduce((sum, item) => sum + Number(item.total_portion || 0), 0);
    const smpTotal = filteredGroups
      .filter((item) => item.group_type === "SMP/MTs")
      .reduce((sum, item) => sum + Number(item.total_portion || 0), 0);
    const staffTotal = filteredGroups.reduce(
      (sum, item) =>
        sum +
        Number(item.staff_small_portion || 0) +
        Number(item.staff_large_portion || 0),
      0
    );

    return {
      totalGroups: filteredGroups.length,
      totalPortion,
      paudTotal,
      sdTotal,
      smpTotal,
      staffTotal,
    };
  }, [filteredGroups]);

  const handleAdd = () => {
    if (!isAdmin) return;
    setSelectedGroup(null);
    setFormOpen(true);
  };

  const handleEdit = async (group) => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      const detail = await fetchBeneficiaryGroupById(group.id);
      setSelectedGroup(detail);
      setFormOpen(true);
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal memuat detail kelompok: " + err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Hapus data kelompok "${group.group_name}"?`
    );
    if (!confirmed) return;

    try {
      await deleteBeneficiaryGroup(group.id);
      setGroups((prev) => prev.filter((item) => item.id !== group.id));
      setToast({
        kind: "success",
        message: "Data kelompok berhasil dihapus.",
      });
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menghapus data: " + err.message,
      });
    }
  };

  const handleSubmit = async (payload) => {
    if (!isAdmin) return;
    try {
      setSaving(true);

      if (selectedGroup?.id) {
        await updateBeneficiaryGroup(selectedGroup.id, payload);
        setToast({
          kind: "success",
          message: "Data kelompok berhasil diperbarui.",
        });
      } else {
        await createBeneficiaryGroup(payload);
        setToast({
          kind: "success",
          message: "Data kelompok berhasil ditambahkan.",
        });
      }

      setFormOpen(false);
      setSelectedGroup(null);
      await loadGroups();
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menyimpan data: " + err.message,
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
            <h2>Data Kelompok Penerima Manfaat</h2>
            <p>Kelola daftar kelompok dan total porsi yang dilayani.</p>
          </div>

          {isAdmin ? (
            <div className="page-actions action-toolbar-card w-full sm:w-auto">
              <button
                type="button"
                className="action-btn-secondary action-btn-secondary-soft w-full sm:w-auto"
                onClick={() => setImportOpen(true)}
                disabled={saving}
              >
                Import CSV/Excel
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

        <div className="beneficiary-toolbar justify-stretch sm:justify-end">
          <div className="filter-field w-full sm:w-60">
            <label htmlFor="group-type-filter">Jenis Kelompok</label>
            <select
              id="group-type-filter"
              className="w-full"
              value={groupTypeFilter}
              onChange={(e) => setGroupTypeFilter(e.target.value)}
            >
              <option value="all">Semua jenis kelompok</option>
              {GROUP_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="beneficiary-mobile-summary-grid grid w-full gap-3 xl:grid-cols-3">
          <SummaryMetricCard
            className="beneficiary-mobile-summary-card"
            label="Total data kelompok"
            value={summary.totalGroups.toLocaleString("id-ID")}
            icon="totalData"
            tone="blue"
          />
          <SummaryMetricCard
            className="beneficiary-mobile-summary-card"
            label="Total seluruh porsi"
            value={summary.totalPortion.toLocaleString("id-ID")}
            icon="totalAccumulation"
            tone="blue"
            emphasis
          />
          <SummaryMetricCard
            className="beneficiary-mobile-summary-card"
            label="Jumlah KB/TK/PAUD"
            value={summary.paudTotal.toLocaleString("id-ID")}
            icon="beneficiaries"
            tone="blue"
          />
          <SummaryMetricCard
            className="beneficiary-mobile-summary-card"
            label="Jumlah SD"
            value={summary.sdTotal.toLocaleString("id-ID")}
            icon="beneficiaries"
            tone="blue"
          />
          <SummaryMetricCard
            className="beneficiary-mobile-summary-card"
            label="Jumlah SMP"
            value={summary.smpTotal.toLocaleString("id-ID")}
            icon="beneficiaries"
            tone="blue"
          />
          <SummaryMetricCard
            className="beneficiary-mobile-summary-card"
            label="Jumlah Guru/Tendik"
            value={summary.staffTotal.toLocaleString("id-ID")}
            icon="beneficiaries"
            tone="blue"
          />
        </div>

        <div className="feature-data-panel mt-4">
          <BeneficiaryGroupTable
            groups={filteredGroups}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canManage={isAdmin}
          />
        </div>
      </section>

      <Toast kind={toast.kind} message={toast.message} />

      {isAdmin ? (
        <BeneficiaryGroupForm
          open={formOpen}
          initialData={selectedGroup}
          loading={saving}
          onClose={() => {
            if (saving) return;
            setFormOpen(false);
            setSelectedGroup(null);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      {isAdmin ? (
        <BeneficiaryGroupImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={async (result) => {
            setImportOpen(false);
            await loadGroups();
            setToast({
              kind: "success",
              message: `Import berhasil: ${result.imported} data kelompok ditambahkan.`,
            });
          }}
        />
      ) : null}
    </>
  );
}
