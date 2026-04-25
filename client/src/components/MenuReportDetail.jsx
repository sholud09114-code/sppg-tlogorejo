import { formatDate, formatNumber } from "../shared/utils/formatters.js";

function getMenuNames(data) {
  const menuNames = [
    data.menu_name_1,
    data.menu_name_2,
    data.menu_name_3,
    data.menu_name_4,
    data.menu_name_5,
  ].filter(Boolean);

  if (menuNames.length) {
    return menuNames;
  }

  return data.menu_name ? [data.menu_name] : [];
}

export default function MenuReportDetail({ open, data, onClose }) {
  if (!open || !data) return null;

  const menuNames = getMenuNames(data);

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card w-full max-w-2xl rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div>
            <h3>Detail menu</h3>
            <p>Ringkasan kandungan gizi menu yang tersimpan.</p>
          </div>
          <button type="button" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Tanggal</span>
            <strong className="text-xl leading-snug">{formatDate(data.menu_date)}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4 md:col-span-2">
            <span className="summary-card-label">Nama Menu</span>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-5">
              {menuNames.map((name, index) => (
                <div
                  key={`${name}-${index}`}
                  className="rounded-xl bg-[#fcfbf8] px-3 py-2 text-sm font-medium text-[#2f2d27]"
                >
                  {name}
                </div>
              ))}
            </div>
          </div>

          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Porsi Kecil</span>
            <div className="mt-3 space-y-2 text-sm">
              <div className="text-sm">
                <span className="text-[#5f5e5a]">Energi: </span>
                <strong className="text-sm">{formatNumber(data.small_energy)} kkal</strong>
              </div>
              <div className="text-sm">
                <span className="text-[#5f5e5a]">Protein: </span>
                <strong className="text-sm">{formatNumber(data.small_protein)} g</strong>
              </div>
              <div className="text-sm">
                <span className="text-[#5f5e5a]">Lemak: </span>
                <strong className="text-sm">{formatNumber(data.small_fat)} g</strong>
              </div>
              <div className="text-sm">
                <span className="text-[#5f5e5a]">Karbohidrat: </span>
                <strong className="text-sm">{formatNumber(data.small_carbohydrate)} g</strong>
              </div>
              <div className="text-sm">
                <span className="text-[#5f5e5a]">Serat: </span>
                <strong className="text-sm">{formatNumber(data.small_fiber)} g</strong>
              </div>
            </div>
          </div>

          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Porsi Besar</span>
            <div className="mt-3 space-y-2 text-sm">
              <div className="text-sm">
                <span className="text-[#5f5e5a]">Energi: </span>
                <strong className="text-sm">{formatNumber(data.large_energy)} kkal</strong>
              </div>
              <div className="text-sm">
                <span className="text-[#5f5e5a]">Protein: </span>
                <strong className="text-sm">{formatNumber(data.large_protein)} g</strong>
              </div>
              <div className="text-sm">
                <span className="text-[#5f5e5a]">Lemak: </span>
                <strong className="text-sm">{formatNumber(data.large_fat)} g</strong>
              </div>
              <div className="text-sm">
                <span className="text-[#5f5e5a]">Karbohidrat: </span>
                <strong className="text-sm">{formatNumber(data.large_carbohydrate)} g</strong>
              </div>
              <div className="text-sm">
                <span className="text-[#5f5e5a]">Serat: </span>
                <strong className="text-sm">{formatNumber(data.large_fiber)} g</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
