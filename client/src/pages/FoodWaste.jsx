import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import FoodWasteDetail from "../components/FoodWasteDetail.jsx";
import FoodWasteForm from "../components/FoodWasteForm.jsx";
import ActionIconButton from "../components/ActionIconButton.jsx";
import LoadingMessage from "../components/LoadingMessage.jsx";
import Toast from "../components/Toast.jsx";
import SummaryMetricCard from "../components/ui/SummaryMetricCard.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "../components/ui/appIcons.jsx";
import {
  createFoodWaste,
  deleteFoodWaste,
  fetchFoodWasteReports,
  getCachedFoodWasteReports,
  updateFoodWaste,
} from "../api/foodWasteApi.js";
import { formatDate, formatKgPerPortion, formatPortions, formatWeight } from "../shared/utils/formatters.js";

function getWastePerPortion(report) {
  const totalKg = Number(report?.total_kg || 0);
  const totalPortions = Number(report?.total_portions || 0);
  if (!Number.isFinite(totalKg) || !Number.isFinite(totalPortions) || totalPortions <= 0) {
    return 0;
  }
  return totalKg / totalPortions;
}

function formatWastePerPortion(value) {
  return formatKgPerPortion(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export default function FoodWaste() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [sortOrder, setSortOrder] = useState("date_desc");
  const [toast, setToast] = useState({ kind: null, message: null });
  const isAdmin = user?.role === "admin";

  const loadReports = async () => {
    const cachedReports = getCachedFoodWasteReports();
    if (cachedReports) {
      setReports(cachedReports);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data = await fetchFoodWasteReports({ force: Boolean(cachedReports) });
      setReports(data);
    } catch (err) {
      if (!cachedReports) {
        setToast({
          kind: "danger",
          message: "Gagal memuat data sisa pangan: " + err.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const summary = useMemo(() => {
    const totalKg = reports.reduce((sum, item) => sum + Number(item.total_kg || 0), 0);
    return {
      totalReports: reports.length,
      totalKg,
      averageKg: reports.length > 0 ? totalKg / reports.length : 0,
    };
  }, [reports]);

  const sortedReports = useMemo(() => {
    return [...reports].sort((left, right) => {
      if (sortOrder === "date_desc") {
        return String(right.report_date || "").localeCompare(String(left.report_date || ""));
      }

      if (sortOrder === "date_asc") {
        return String(left.report_date || "").localeCompare(String(right.report_date || ""));
      }

      const leftValue = getWastePerPortion(left);
      const rightValue = getWastePerPortion(right);

      if (leftValue !== rightValue) {
        return sortOrder === "highest" ? rightValue - leftValue : leftValue - rightValue;
      }

      return String(right.report_date || "").localeCompare(String(left.report_date || ""));
    });
  }, [reports, sortOrder]);

  const handleAdd = () => {
    if (!isAdmin) return;
    setSelectedReport(null);
    setFormOpen(true);
  };

  const handleEdit = (report) => {
    if (!isAdmin) return;
    setSelectedReport(report);
    setFormOpen(true);
  };

  const handleView = (report) => {
    setSelectedReport(report);
    setDetailOpen(true);
  };

  const handleDelete = async (report) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Hapus data sisa pangan tanggal ${report.report_date}?`
    );
    if (!confirmed) return;

    try {
      await deleteFoodWaste(report.id);
      setReports((prev) => prev.filter((item) => item.id !== report.id));
      setToast({
        kind: "success",
        message: "Data sisa pangan berhasil dihapus.",
      });
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menghapus data sisa pangan: " + err.message,
      });
    }
  };

  const handleSubmit = async (payload) => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      if (selectedReport?.id) {
        await updateFoodWaste(selectedReport.id, payload);
        setToast({
          kind: "success",
          message: "Data sisa pangan berhasil diperbarui.",
        });
      } else {
        await createFoodWaste(payload);
        setToast({
          kind: "success",
          message: "Data sisa pangan berhasil ditambahkan.",
        });
      }

      setFormOpen(false);
      setSelectedReport(null);
      await loadReports();
    } catch (err) {
      setToast({
        kind: "danger",
        message: "Gagal menyimpan data sisa pangan: " + err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="food-waste-page-card">
        <section className="food-waste-hero">
          <div className="food-waste-hero-copy">
            <div className="food-waste-hero-icon">
              <AppIcon
                name="foodWaste"
                size={34}
                weight={APP_ICON_WEIGHT.hero}
                className="food-waste-hero-icon-svg"
              />
            </div>
            <div className="min-w-0">
              <h2>Sisa Pangan</h2>
              <p>Lihat akumulasi sisa pangan harian dan hubungkan dengan referensi menu.</p>
            </div>
          </div>

          <div className="food-waste-toolbar-card">
            <div className="filter-field food-waste-filter-field">
              <select
                id="food-waste-sort-order"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                disabled={loading}
              >
                <option value="date_desc">Tanggal terbaru ke terlama</option>
                <option value="date_asc">Tanggal terlama ke terbaru</option>
                <option value="highest">Terbanyak ke terendah</option>
                <option value="lowest">Terendah ke terbanyak</option>
              </select>
            </div>
            {isAdmin ? (
              <button
                type="button"
                className="submit-btn food-waste-add-btn"
                onClick={handleAdd}
                disabled={saving}
              >
                + Tambah data
              </button>
            ) : null}
          </div>
        </section>

        <div className="food-waste-summary-grid">
          <SummaryMetricCard
            className="food-waste-summary-card"
            label="Total data"
            value={summary.totalReports.toLocaleString("id-ID")}
            icon="totalData"
            tone="blue"
          />
          <SummaryMetricCard
            className="food-waste-summary-card"
            label="Total akumulasi sisa pangan"
            value={formatWeight(summary.totalKg)}
            icon="totalAccumulation"
            tone="blue"
            emphasis
          />
          <SummaryMetricCard
            className="food-waste-summary-card"
            label="Rata-rata sisa pangan"
            value={formatWeight(summary.averageKg)}
            icon="average"
            tone="blue"
          />
        </div>

        <section className="food-waste-data-panel">
          <div className="food-waste-data-panel-head">
            <h3>Daftar Sisa Pangan</h3>
          </div>

          <div className="food-waste-data-panel-body">
            {loading ? (
              <LoadingMessage>Memuat data sisa pangan...</LoadingMessage>
            ) : reports.length === 0 ? (
              <div className="empty-state rounded-2xl px-4 py-8">
                Belum ada data sisa pangan yang tersimpan.
              </div>
            ) : (
              <>
                <div className="mobile-data-list food-waste-mobile-list">
                  {sortedReports.map((report, index) => (
                    <article className="mobile-data-card food-waste-mobile-card" key={report.id}>
                      <div className="mobile-data-card-head">
                        <div>
                          <div className="mobile-data-card-title">{formatDate(report.report_date)}</div>
                          <div className="mobile-data-card-subtitle">
                            {formatPortions(report.total_portions)} porsi
                          </div>
                        </div>
                        <span className="food-waste-value-badge food-waste-value-badge-index">{index + 1}</span>
                      </div>
                      <div className="mobile-metric-grid food-waste-mobile-metrics">
                        <div className="mobile-metric">
                          <span>Karbohidrat</span>
                          <strong>{formatWeight(report.carb_source)}</strong>
                        </div>
                        <div className="mobile-metric">
                          <span>Protein</span>
                          <strong>{formatWeight(report.protein_source)}</strong>
                        </div>
                        <div className="mobile-metric">
                          <span>Sayur</span>
                          <strong>{formatWeight(report.vegetable)}</strong>
                        </div>
                        <div className="mobile-metric">
                          <span>Buah</span>
                          <strong>{formatWeight(report.fruit)}</strong>
                        </div>
                        <div className="mobile-metric mobile-metric-emphasis">
                          <span>Total</span>
                          <strong>{formatWeight(report.total_kg)}</strong>
                        </div>
                        <div className="mobile-metric">
                          <span>Per porsi</span>
                          <strong>{formatWastePerPortion(getWastePerPortion(report))}</strong>
                        </div>
                      </div>
                      <div className="mobile-data-section">
                        <span className="mobile-data-label">Menu</span>
                        <div className="mobile-data-copy">{report.menu_notes || "-"}</div>
                      </div>
                      <div className="table-actions mobile-table-actions">
                        <ActionIconButton action="view" label="Lihat" onClick={() => handleView(report)} />
                        {isAdmin ? (
                          <>
                            <ActionIconButton action="edit" label="Edit" onClick={() => handleEdit(report)} />
                            <ActionIconButton action="delete" label="Hapus" onClick={() => handleDelete(report)} />
                          </>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="data-table-scroll-shell scroll-affordance desktop-data-table" data-scroll-hint="Geser tabel">
                  <div className="table-wrap overflow-x-auto rounded-2xl">
                    <table className="data-table food-waste-table min-w-[1320px]">
                      <thead>
                        <tr>
                          <th className="food-waste-col-no text-center">No</th>
                          <th className="food-waste-col-date text-left">Tanggal</th>
                          <th className="food-waste-col-portions text-right">Total<br />Porsi</th>
                          <th className="food-waste-col-nutrient text-right">Sumber<br />Karbohidrat</th>
                          <th className="food-waste-col-nutrient text-right">Sumber<br />Protein</th>
                          <th className="food-waste-col-small text-right">Sayur</th>
                          <th className="food-waste-col-small text-right">Buah</th>
                          <th className="food-waste-col-total text-right">Total<br />(kg)</th>
                          <th className="food-waste-col-per-portion text-right">Sisa Pangan<br />per Porsi</th>
                          <th className="food-waste-col-menu text-left">Menu</th>
                          <th className="food-waste-col-actions text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedReports.map((report, index) => (
                          <tr key={report.id}>
                            <td className="food-waste-col-no text-center">
                              <span className="food-waste-value-badge food-waste-value-badge-index">{index + 1}</span>
                            </td>
                            <td className="food-waste-col-date text-left">{formatDate(report.report_date)}</td>
                            <td className="food-waste-col-portions text-right">{formatPortions(report.total_portions)}</td>
                            <td className="food-waste-col-nutrient text-right">{formatWeight(report.carb_source)}</td>
                            <td className="food-waste-col-nutrient text-right">{formatWeight(report.protein_source)}</td>
                            <td className="food-waste-col-small text-right">{formatWeight(report.vegetable)}</td>
                            <td className="food-waste-col-small text-right">{formatWeight(report.fruit)}</td>
                            <td className="food-waste-col-total text-right">
                              <span className="food-waste-value-badge food-waste-value-badge-total">{formatWeight(report.total_kg)}</span>
                            </td>
                            <td className="food-waste-col-per-portion text-right">{formatWastePerPortion(getWastePerPortion(report))}</td>
                            <td className="food-waste-col-menu text-left">
                              <span className="food-waste-menu-clamp">{report.menu_notes || "-"}</span>
                            </td>
                            <td className="food-waste-col-actions text-center">
                              <div className="table-actions">
                                <ActionIconButton action="view" label="Lihat" onClick={() => handleView(report)} />
                                {isAdmin ? (
                                  <>
                                    <ActionIconButton action="edit" label="Edit" onClick={() => handleEdit(report)} />
                                    <ActionIconButton action="delete" label="Hapus" onClick={() => handleDelete(report)} />
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </section>

      <Toast kind={toast.kind} message={toast.message} />

      {isAdmin ? (
        <FoodWasteForm
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

      <FoodWasteDetail
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
