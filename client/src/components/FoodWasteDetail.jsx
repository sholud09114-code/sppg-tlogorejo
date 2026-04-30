import { formatDate, formatPortions, formatWeight } from "../shared/utils/formatters.js";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

function formatWastePerPortion(totalKg, totalPortions) {
  const numericTotalKg = Number(totalKg || 0);
  const numericTotalPortions = Number(totalPortions || 0);
  if (!Number.isFinite(numericTotalKg) || !Number.isFinite(numericTotalPortions) || numericTotalPortions <= 0) {
    return "0 kg/porsi";
  }

  return `${(numericTotalKg / numericTotalPortions).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })} kg/porsi`;
}

export default function FoodWasteDetail({ open, data, onClose }) {
  if (!open || !data) return null;

  const wasteRows = [
    ["Sumber karbohidrat", data.carb_source],
    ["Sumber protein", data.protein_source],
    ["Sayur", data.vegetable],
    ["Buah", data.fruit],
  ];

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card report-modal-card rich-detail-card w-full max-w-5xl rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="rich-detail-shell">
          <div className="rich-detail-hero">
            <div className="rich-detail-hero-main">
              <div className="rich-detail-hero-icon">
                <AppIcon name="foodWaste" size={24} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-hero-copy">
                <span className="rich-detail-eyebrow">Detail sisa pangan</span>
                <h3>{formatDate(data.report_date)}</h3>
                <p>Ringkasan total porsi, total sisa pangan, dan komposisi bahan sisa.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rich-detail-close-btn">
              Tutup
            </button>
          </div>

          <div className="rich-detail-summary-grid food-waste-detail-summary-grid">
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
                <AppIcon name="beneficiaries" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-summary-copy">
                <span>Total porsi</span>
                <strong>{formatPortions(data.total_portions)}</strong>
              </div>
            </div>
            <div className="rich-detail-summary-card">
              <div className="rich-detail-summary-icon tone-amber">
                <AppIcon name="foodWaste" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-summary-copy">
                <span>Total sisa pangan</span>
                <strong>{formatWeight(data.total_kg)}</strong>
              </div>
            </div>
            <div className="rich-detail-summary-card">
              <div className="rich-detail-summary-icon tone-emerald">
                <AppIcon name="calculator" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-summary-copy">
                <span>Sisa per porsi</span>
                <strong>{formatWastePerPortion(data.total_kg, data.total_portions)}</strong>
              </div>
            </div>
          </div>

          <section className="rich-detail-section">
            <div className="rich-detail-section-head">
              <div>
                <span className="rich-detail-group-kicker">Komposisi</span>
                <h4>Rincian bahan sisa</h4>
              </div>
            </div>
            <div className="food-waste-detail-grid">
              {wasteRows.map(([label, value]) => (
                <div className="food-waste-detail-item" key={label}>
                  <span>{label}</span>
                  <strong>{formatWeight(value)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="rich-detail-section">
            <div className="rich-detail-section-head">
              <div>
                <span className="rich-detail-group-kicker">Catatan</span>
                <h4>Menu / keterangan bahan sisa</h4>
              </div>
            </div>
            <div className="rich-detail-note">{data.menu_notes || "-"}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
