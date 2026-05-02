import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import BeneficiaryGroupForm from "../components/BeneficiaryGroupForm.jsx";
import BeneficiaryGroupImportModal from "../components/BeneficiaryGroupImportModal.jsx";
import BeneficiaryGroupTable from "../components/BeneficiaryGroupTable.jsx";
import Toast from "../components/Toast.jsx";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "../components/ui/appIcons.jsx";
import {
  createBeneficiaryGroup,
  deleteBeneficiaryGroup,
  fetchBeneficiaryGroupById,
  fetchBeneficiaryGroups,
  getCachedBeneficiaryGroups,
  updateBeneficiaryGroup,
} from "../api/beneficiaryGroupApi.js";

const GROUP_TYPE_OPTIONS = ["Paud/KB/TK", "SD", "SMP/MTs", "SMK"];
const GROUP_FILTERS = [
  { id: "all", label: "Semua" },
  { id: "issue", label: "Perlu cek" },
  ...GROUP_TYPE_OPTIONS.map((type) => ({ id: type, label: type })),
];

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function getGroupIssues(group) {
  const issues = [];
  if (!String(group.group_name || "").trim()) issues.push("Nama kosong");
  if (!GROUP_TYPE_OPTIONS.includes(group.group_type)) issues.push("Jenis tidak valid");
  if (Number(group.total_portion || 0) <= 0) issues.push("Total porsi 0");
  return issues;
}

export default function BeneficiaryGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupTypeFilter, setGroupTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState({ kind: null, message: null });
  const isAdmin = user?.role === "admin";

  const loadGroups = async () => {
    const cachedGroups = getCachedBeneficiaryGroups();
    if (cachedGroups) {
      setGroups(cachedGroups);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data = await fetchBeneficiaryGroups({ force: Boolean(cachedGroups) });
      setGroups(data);
    } catch (err) {
      if (!cachedGroups) {
        setToast({
          kind: "danger",
          message: "Gagal memuat data kelompok: " + err.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const filteredGroups = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);

    return groups.filter((group) => {
      if (normalizedSearch) {
        const searchableText = normalizeSearch(`${group.group_name} ${group.group_type}`);
        if (!searchableText.includes(normalizedSearch)) return false;
      }

      if (groupTypeFilter === "issue") return getGroupIssues(group).length > 0;
      if (groupTypeFilter !== "all") return group.group_type === groupTypeFilter;
      return true;
    });
  }, [groups, groupTypeFilter, searchTerm]);

  const summary = useMemo(() => {
    const totalPortion = groups.reduce(
      (sum, item) => sum + Number(item.total_portion || 0),
      0
    );
    const paudTotal = groups
      .filter((item) => item.group_type === "Paud/KB/TK")
      .reduce((sum, item) => sum + Number(item.total_portion || 0), 0);
    const sdTotal = groups
      .filter((item) => item.group_type === "SD")
      .reduce((sum, item) => sum + Number(item.total_portion || 0), 0);
    const smpTotal = groups
      .filter((item) => item.group_type === "SMP/MTs")
      .reduce((sum, item) => sum + Number(item.total_portion || 0), 0);
    const smkTotal = groups
      .filter((item) => item.group_type === "SMK")
      .reduce((sum, item) => sum + Number(item.total_portion || 0), 0);
    const staffTotal = groups.reduce(
      (sum, item) =>
        sum +
        Number(item.staff_small_portion || 0) +
        Number(item.staff_large_portion || 0),
      0
    );
    const issueCount = groups.filter((group) => getGroupIssues(group).length > 0).length;

    return {
      totalGroups: groups.length,
      totalPortion,
      paudTotal,
      sdTotal,
      smpTotal,
      smkTotal,
      staffTotal,
      issueCount,
    };
  }, [groups]);

  const filterCounts = useMemo(() => {
    const counts = {
      all: groups.length,
      issue: groups.filter((group) => getGroupIssues(group).length > 0).length,
    };
    GROUP_TYPE_OPTIONS.forEach((type) => {
      counts[type] = groups.filter((group) => group.group_type === type).length;
    });
    return counts;
  }, [groups]);

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
      <section className="feature-page-card beneficiary-dashboard-page">
        <div className="beneficiary-hero">
          <div className="beneficiary-hero-copy">
            <span className="weekly-section-icon">
              <AppIcon name="beneficiaryGroups" size={24} weight={APP_ICON_WEIGHT.summary} />
            </span>
            <div className="min-w-0">
              <h2>Data Kelompok Penerima Manfaat</h2>
              <p>Kelola master unit, target PM, dan porsi yang akan tersinkron ke laporan harian.</p>
            </div>
          </div>

          {isAdmin ? (
            <div className="beneficiary-hero-actions">
              <button
                type="button"
                className="action-btn-secondary action-btn-secondary-soft w-full sm:w-auto"
                onClick={() => setImportOpen(true)}
                disabled={saving}
              >
                <span className="button-with-icon">
                  <AppIcon name="import" size={17} weight={APP_ICON_WEIGHT.action} />
                  Import CSV/Excel
                </span>
              </button>
              <button
                type="button"
                className="submit-btn action-btn-primary-solid w-full sm:w-auto"
                onClick={handleAdd}
                disabled={saving}
              >
                <span className="button-with-icon">
                  <AppIcon name="beneficiaryGroups" size={17} weight={APP_ICON_WEIGHT.action} />
                  Tambah data
                </span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="beneficiary-kpi-grid">
          <SummaryMetricCard
            className="beneficiary-mobile-summary-card"
            label="Total kelompok"
            value={summary.totalGroups.toLocaleString("id-ID")}
            icon="totalData"
            tone="blue"
          />
          <SummaryMetricCard
            className="beneficiary-mobile-summary-card"
            label="Total target PM"
            value={summary.totalPortion.toLocaleString("id-ID")}
            icon="totalAccumulation"
            tone="blue"
            emphasis
          />
          <SummaryMetricCard
            className="beneficiary-mobile-summary-card"
            label="Guru/Tendik"
            value={summary.staffTotal.toLocaleString("id-ID")}
            icon="beneficiaries"
            tone="blue"
          />
          <SummaryMetricCard
            className="beneficiary-mobile-summary-card"
            label="Perlu cek"
            value={summary.issueCount.toLocaleString("id-ID")}
            helper="Nama kosong / jenis invalid / porsi 0"
            icon="statusPartial"
            tone={summary.issueCount ? "amber" : "green"}
          />
        </div>

        <div className="beneficiary-breakdown-grid">
          {[
            ["PAUD/TK/KB", summary.paudTotal],
            ["SD", summary.sdTotal],
            ["SMP/MTs", summary.smpTotal],
            ["SMK", summary.smkTotal],
          ].map(([label, value]) => (
            <div className="weekly-category-card" key={label}>
              <span>{label}</span>
              <strong>{Number(value || 0).toLocaleString("id-ID")}</strong>
            </div>
          ))}
        </div>

        <div className="beneficiary-control-panel">
          <div className="daily-unit-search beneficiary-search">
            <AppIcon name="search" size={16} weight={APP_ICON_WEIGHT.action} />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Cari nama kelompok atau jenis..."
              aria-label="Cari data kelompok"
            />
            {searchTerm ? (
              <button type="button" onClick={() => setSearchTerm("")} aria-label="Bersihkan pencarian">
                <AppIcon name="close" size={14} weight={APP_ICON_WEIGHT.action} />
              </button>
            ) : null}
          </div>

          <div className="daily-filter-chips beneficiary-filter-chips" aria-label="Filter data kelompok">
            {GROUP_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={groupTypeFilter === filter.id ? "active" : ""}
                onClick={() => setGroupTypeFilter(filter.id)}
              >
                <span>{filter.label}</span>
                <strong>{filterCounts[filter.id] || 0}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="feature-data-panel beneficiary-data-panel mt-4">
          <div className="beneficiary-data-head">
            <div>
              <h3>Daftar kelompok</h3>
              <p>{filteredGroups.length.toLocaleString("id-ID")} dari {groups.length.toLocaleString("id-ID")} data tampil.</p>
            </div>
          </div>
          <BeneficiaryGroupTable
            groups={filteredGroups}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canManage={isAdmin}
            getIssues={getGroupIssues}
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
