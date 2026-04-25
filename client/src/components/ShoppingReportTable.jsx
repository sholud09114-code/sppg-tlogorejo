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

export default function ShoppingReportTable({
  reports,
  loading,
  onView,
  onEdit,
  onDelete,
  canManage = true,
}) {
  if (loading) {
    return <div className="loading">Memuat laporan belanja...</div>;
  }

  if (!reports.length) {
    return (
      <div className="empty-state rounded-2xl px-4 py-8">
        Belum ada laporan belanja yang tersimpan.
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
                <div className="mobile-data-card-title">{formatDate(report.report_date)}</div>
                <div className="mobile-data-card-subtitle">{report.menu_name || "-"}</div>
              </div>
              <span className="table-index-badge">{index + 1}</span>
            </div>
            <div className="mobile-metric-grid">
              <div className="mobile-metric mobile-metric-emphasis">
                <span>Total belanja</span>
                <strong>{formatMoney(report.total_spending)}</strong>
              </div>
              <div className="mobile-metric">
                <span>Pagu</span>
                <strong>{formatMoney(report.daily_budget)}</strong>
              </div>
              <div className="mobile-metric">
                <span>Selisih</span>
                <strong
                  className={`shopping-difference-badge shopping-difference-badge-${getDifferenceTone(
                    report.difference_amount
                  )}`}
                >
                  {formatMoney(report.difference_amount)}
                </strong>
              </div>
              <div className="mobile-metric">
                <span>Item</span>
                <strong>{formatNumber(report.item_count)}</strong>
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
          <table className="data-table shopping-report-table min-w-[1260px]">
            <thead>
              <tr>
                <th className="col-no text-center">No</th>
                <th className="col-date text-left">Tanggal</th>
                <th className="col-menu text-left">Nama Menu</th>
                <th className="col-money text-right">Total Belanja</th>
                <th className="col-money text-right">Pagu Harian</th>
                <th className="col-money text-right">Selisih</th>
                <th className="col-count text-right">Jumlah Item</th>
                <th className="col-actions text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report, index) => (
                <tr key={report.id}>
                  <td className="col-no text-center">
                    <span className="table-index-badge">{index + 1}</span>
                  </td>
                  <td className="col-date text-left">
                    <span className="shopping-date-cell">{formatDate(report.report_date)}</span>
                  </td>
                  <td className="col-menu text-left">
                    <div className="shopping-menu-cell">{report.menu_name || "-"}</div>
                  </td>
                  <td className="col-money text-right">
                    <span className="shopping-money-cell">{formatMoney(report.total_spending)}</span>
                  </td>
                  <td className="col-money text-right">
                    <span className="shopping-money-cell">{formatMoney(report.daily_budget)}</span>
                  </td>
                  <td className="col-money text-right">
                    <span
                      className={`shopping-difference-badge shopping-difference-badge-${getDifferenceTone(
                        report.difference_amount
                      )}`}
                    >
                      {formatMoney(report.difference_amount)}
                    </span>
                  </td>
                  <td className="col-count text-right">
                    <span className="shopping-count-cell">{formatNumber(report.item_count)}</span>
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
