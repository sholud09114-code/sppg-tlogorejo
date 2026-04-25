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

export default function ShoppingReportDetail({ open, data, onClose }) {
  if (!open || !data) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card report-modal-card w-full max-w-5xl rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div>
            <h3>Detail laporan belanja</h3>
            <p>Ringkasan header dan item belanja yang tersimpan.</p>
          </div>
          <button type="button" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Tanggal</span>
            <strong>{formatDate(data.report_date)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Nama Menu</span>
            <strong>{data.menu_name}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Pagu Harian</span>
            <strong>{formatMoney(data.daily_budget)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Total Belanja</span>
            <strong>{formatMoney(data.total_spending)}</strong>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Selisih</span>
            <strong>{formatMoney(data.difference_amount)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Catatan</span>
            <strong className="text-base">{data.notes || "-"}</strong>
          </div>
        </div>

        <div className="mt-4 table-wrap overflow-x-auto rounded-2xl">
          <table className="data-table min-w-[920px]">
            <thead>
              <tr>
                <th className="text-center">No</th>
                <th className="text-left">Uraian</th>
                <th className="text-right">Qty</th>
                <th className="text-center">Satuan</th>
                <th className="text-right">Harga</th>
                <th className="text-right">Jumlah</th>
                <th className="text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {(data.items || []).map((item, index) => (
                <tr key={item.id || `${item.description}-${index}`}>
                  <td className="text-center">{index + 1}</td>
                  <td className="text-left">{item.description}</td>
                  <td className="text-right">{formatNumber(item.qty)}</td>
                  <td className="text-center">{item.unit_name || "-"}</td>
                  <td className="text-right">{formatMoney(item.price)}</td>
                  <td className="text-right">{formatMoney(item.amount)}</td>
                  <td className="text-left">{item.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
