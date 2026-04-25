import ActionIconButton from "./ActionIconButton.jsx";

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function renderMenuNames(report) {
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
    <div className="space-y-1">
      {menuNames.map((name, index) => (
        <div key={`${report.id}-${index}`}>{name}</div>
      ))}
    </div>
  );
}

function NutritionBreakdown({ values }) {
  return (
    <div className="min-w-[180px] space-y-1 text-sm">
      <div className="flex flex-wrap items-baseline gap-1">
        <span>Energi:</span>
        <strong>{formatNumber(values.energy)} kkal</strong>
      </div>
      <div className="flex flex-wrap items-baseline gap-1">
        <span>Protein:</span>
        <strong>{formatNumber(values.protein)} g</strong>
      </div>
      <div className="flex flex-wrap items-baseline gap-1">
        <span>Lemak:</span>
        <strong>{formatNumber(values.fat)} g</strong>
      </div>
      <div className="flex flex-wrap items-baseline gap-1">
        <span>Karbohidrat:</span>
        <strong>{formatNumber(values.carbohydrate)} g</strong>
      </div>
      <div className="flex flex-wrap items-baseline gap-1">
        <span>Serat:</span>
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
    return <div className="loading">Memuat data menu...</div>;
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
      <div className="mobile-data-list">
        {reports.map((report, index) => (
          <article className="mobile-data-card" key={report.id}>
            <div className="mobile-data-card-head">
              <div>
                <div className="mobile-data-card-title">{formatDate(report.menu_date)}</div>
                <div className="mobile-data-card-subtitle">Laporan menu harian</div>
              </div>
              <span className="table-index-badge">{index + 1}</span>
            </div>
            <div className="mobile-data-section">
              <span className="mobile-data-label">Nama menu</span>
              <div className="mobile-data-copy">{renderMenuNames(report)}</div>
            </div>
            <div className="mobile-metric-grid">
              <div className="mobile-metric">
                <span>Energi kecil</span>
                <strong>{formatNumber(report.small_energy)} kkal</strong>
              </div>
              <div className="mobile-metric">
                <span>Energi besar</span>
                <strong>{formatNumber(report.large_energy)} kkal</strong>
              </div>
            </div>
            <div className="table-actions mobile-table-actions">
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

      <div className="data-table-scroll-shell scroll-affordance desktop-data-table" data-scroll-hint="Geser tabel">
        <div className="table-wrap overflow-x-auto rounded-2xl">
          <table className="data-table menu-report-table min-w-[1220px]">
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
                  <td className="col-menu text-left">{renderMenuNames(report)}</td>
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
