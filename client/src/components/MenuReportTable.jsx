import ActionIconButton from "./ActionIconButton.jsx";
import LoadingMessage from "./LoadingMessage.jsx";
import { formatDate, formatNumber } from "../shared/utils/formatters.js";

function renderMenuNames(report, className = "") {
  const menuNames = [
    report.menu_name_1,
    report.menu_name_2,
    report.menu_name_3,
    report.menu_name_4,
    report.menu_name_5,
  ].filter(Boolean);

  if (!menuNames.length) {
    return report.menu_name || "-";
  }

  return (
    <div className={["menu-report-menu-list", className].filter(Boolean).join(" ")}>
      {menuNames.map((name, index) => (
        <div key={`${report.id}-${index}`}>{name}</div>
      ))}
    </div>
  );
}

function NutritionBreakdown({ values }) {
  return (
    <div className="menu-report-nutrition-breakdown">
      <div className="menu-report-nutrition-row">
        <span>Energi</span>
        <strong>{formatNumber(values.energy)} kkal</strong>
      </div>
      <div className="menu-report-nutrition-row">
        <span>Protein</span>
        <strong>{formatNumber(values.protein)} g</strong>
      </div>
      <div className="menu-report-nutrition-row">
        <span>Lemak</span>
        <strong>{formatNumber(values.fat)} g</strong>
      </div>
      <div className="menu-report-nutrition-row">
        <span>Karbohidrat</span>
        <strong>{formatNumber(values.carbohydrate)} g</strong>
      </div>
      <div className="menu-report-nutrition-row">
        <span>Serat</span>
        <strong>{formatNumber(values.fiber)} g</strong>
      </div>
    </div>
  );
}

export default function MenuReportTable({
  reports,
  loading,
  onView,
  onEdit,
  onDelete,
  canManage = true,
}) {
  if (loading) {
    return <LoadingMessage>Memuat data menu...</LoadingMessage>;
  }

  if (!reports.length) {
    return (
      <div className="empty-state rounded-2xl px-4 py-8">
        Belum ada laporan menu yang tersimpan.
      </div>
    );
  }

  return (
    <>
      <div className="mobile-data-list menu-report-responsive-list">
        {reports.map((report, index) => (
          <article className="mobile-data-card menu-report-mobile-card" key={report.id}>
            <div className="mobile-data-card-head">
              <div>
                <div className="mobile-data-card-title">{formatDate(report.menu_date)}</div>
              </div>
              <span className="table-index-badge">{index + 1}</span>
            </div>
            <div className="mobile-data-section">
              <span className="mobile-data-label">Nama menu</span>
              <div className="mobile-data-copy menu-report-mobile-menu-copy">
                {renderMenuNames(report, "menu-report-mobile-menu-list")}
              </div>
            </div>
            <div className="menu-report-card-nutrition">
              <div className="menu-report-card-nutrition-panel">
                <span className="menu-report-card-nutrition-title">Porsi kecil</span>
                <NutritionBreakdown
                  values={{
                    energy: report.small_energy,
                    protein: report.small_protein,
                    fat: report.small_fat,
                    carbohydrate: report.small_carbohydrate,
                    fiber: report.small_fiber,
                  }}
                />
              </div>
              <div className="menu-report-card-nutrition-panel">
                <span className="menu-report-card-nutrition-title">Porsi besar</span>
                <NutritionBreakdown
                  values={{
                    energy: report.large_energy,
                    protein: report.large_protein,
                    fat: report.large_fat,
                    carbohydrate: report.large_carbohydrate,
                    fiber: report.large_fiber,
                  }}
                />
              </div>
            </div>
            <div className="table-actions mobile-table-actions menu-report-mobile-actions">
              <ActionIconButton action="view" label="Lihat" onClick={() => onView(report)} />
              {canManage ? (
                <>
                  <ActionIconButton action="edit" label="Edit" onClick={() => onEdit(report)} />
                  <ActionIconButton action="delete" label="Hapus" onClick={() => onDelete(report)} />
                </>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div
        className="data-table-scroll-shell scroll-affordance desktop-data-table menu-report-desktop-table menu-report-scroll-shell"
        data-scroll-hint="Geser tabel"
      >
        <div className="table-wrap overflow-x-auto rounded-2xl">
          <table className="data-table menu-report-table">
            <thead>
              <tr>
                <th className="col-no text-center">No</th>
                <th className="col-date text-left">Tanggal</th>
                <th className="col-menu text-left">Nama Menu</th>
                <th className="col-nutrition text-left">Kandungan Gizi Porsi Kecil</th>
                <th className="col-nutrition text-left">Kandungan Gizi Porsi Besar</th>
                <th className="col-actions text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report, index) => (
                <tr key={report.id}>
                  <td className="col-no text-center">
                    <span className="table-index-badge">{index + 1}</span>
                  </td>
                  <td className="col-date text-left">{formatDate(report.menu_date)}</td>
                  <td className="col-menu text-left">
                    <div className="menu-report-menu-cell">{renderMenuNames(report)}</div>
                  </td>
                  <td className="col-nutrition text-left">
                    <NutritionBreakdown
                      values={{
                        energy: report.small_energy,
                        protein: report.small_protein,
                        fat: report.small_fat,
                        carbohydrate: report.small_carbohydrate,
                        fiber: report.small_fiber,
                      }}
                    />
                  </td>
                  <td className="col-nutrition text-left">
                    <NutritionBreakdown
                      values={{
                        energy: report.large_energy,
                        protein: report.large_protein,
                        fat: report.large_fat,
                        carbohydrate: report.large_carbohydrate,
                        fiber: report.large_fiber,
                      }}
                    />
                  </td>
                  <td className="col-actions text-center">
                    <div className="table-actions">
                      <ActionIconButton action="view" label="Lihat" onClick={() => onView(report)} />
                      {canManage ? (
                        <>
                          <ActionIconButton action="edit" label="Edit" onClick={() => onEdit(report)} />
                          <ActionIconButton action="delete" label="Hapus" onClick={() => onDelete(report)} />
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
  );
}
