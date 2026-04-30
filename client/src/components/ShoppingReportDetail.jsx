import { formatDate, formatMoney, formatNumber } from "../shared/utils/formatters.js";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

export default function ShoppingReportDetail({ open, data, onClose }) {
  if (!open || !data) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card report-modal-card rich-detail-card w-full max-w-6xl rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="rich-detail-shell">
          <div className="rich-detail-hero">
            <div className="rich-detail-hero-main">
              <div className="rich-detail-hero-icon">
                <AppIcon name="shoppingReports" size={24} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-hero-copy">
                <span className="rich-detail-eyebrow">Detail laporan belanja</span>
                <h3>{formatDate(data.report_date)}</h3>
                <p>Ringkasan anggaran, realisasi belanja, dan rincian item pembelian.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rich-detail-close-btn">
              Tutup
            </button>
          </div>

          <div className="rich-detail-summary-grid shopping-detail-summary-grid">
            <div className="rich-detail-summary-card">
              <div className="rich-detail-summary-icon tone-blue">
                <AppIcon name="date" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-summary-copy">
                <span>Tanggal</span>
                <strong>{formatDate(data.report_date)}</strong>
              </div>
            </div>
            <div className="rich-detail-summary-card">
              <div className="rich-detail-summary-icon tone-violet">
                <AppIcon name="menu" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-summary-copy">
                <span>Nama menu</span>
                <strong>{data.menu_name || "-"}</strong>
              </div>
            </div>
            <div className="rich-detail-summary-card">
              <div className="rich-detail-summary-icon tone-amber">
                <AppIcon name="budget" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-summary-copy">
                <span>Pagu harian</span>
                <strong>{formatMoney(data.daily_budget)}</strong>
              </div>
            </div>
            <div className="rich-detail-summary-card">
              <div className="rich-detail-summary-icon tone-emerald">
                <AppIcon name="money" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-summary-copy">
                <span>Total belanja</span>
                <strong>{formatMoney(data.total_spending)}</strong>
              </div>
            </div>
          </div>

          <div className="rich-detail-summary-grid shopping-detail-secondary-grid">
            <div className="rich-detail-summary-card">
              <div className="rich-detail-summary-icon tone-blue">
                <AppIcon name="calculator" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-summary-copy">
                <span>Selisih</span>
                <strong>{formatMoney(data.difference_amount)}</strong>
              </div>
            </div>
            <div className="rich-detail-summary-card">
              <div className="rich-detail-summary-icon tone-muted">
                <AppIcon name="docs" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-summary-copy">
                <span>Catatan</span>
                <strong>{data.notes || "-"}</strong>
              </div>
            </div>
          </div>

          <section className="rich-detail-section">
            <div className="rich-detail-section-head">
              <div>
                <span className="rich-detail-group-kicker">Item</span>
                <h4>Rincian belanja</h4>
              </div>
              <span className="rich-detail-group-count">{(data.items || []).length} item</span>
            </div>
            <div className="table-wrap overflow-x-auto rounded-2xl">
              <table className="data-table rich-detail-table min-w-[920px]">
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
                      <td className="text-center">
                        <span className="table-index-badge">{index + 1}</span>
                      </td>
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
          </section>
        </div>
      </div>
    </div>
  );
}
