import { formatDate, formatPortions, formatWeight } from "../shared/utils/formatters.js";

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

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card w-full max-w-3xl rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div>
            <h3>Detail sisa pangan</h3>
            <p>Ringkasan data sisa pangan yang tersimpan.</p>
          </div>
          <button type="button" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Tanggal</span>
            <strong>{formatDate(data.report_date)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Total porsi</span>
            <strong>{formatPortions(data.total_portions)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Total sisa pangan</span>
            <strong>{formatWeight(data.total_kg)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Sisa pangan per porsi</span>
            <strong>{formatWastePerPortion(data.total_kg, data.total_portions)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Sumber Karbohidrat</span>
            <strong>{formatWeight(data.carb_source)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Sumber Protein</span>
            <strong>{formatWeight(data.protein_source)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Sayur</span>
            <strong>{formatWeight(data.vegetable)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4 md:col-span-2 xl:col-span-1">
            <span className="summary-card-label">Buah</span>
            <strong>{formatWeight(data.fruit)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4 md:col-span-2 xl:col-span-2">
            <span className="summary-card-label">Menu / Keterangan bahan sisa</span>
            <strong className="text-base leading-relaxed">{data.menu_notes || "-"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
