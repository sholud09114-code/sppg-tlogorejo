import { formatDate, formatNumber } from "../shared/utils/formatters.js";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

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
  const nutritionRows = [
    ["Energi", "energy", "kkal"],
    ["Protein", "protein", "g"],
    ["Lemak", "fat", "g"],
    ["Karbohidrat", "carbohydrate", "g"],
    ["Serat", "fiber", "g"],
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
                <AppIcon name="menuReports" size={24} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-hero-copy">
                <span className="rich-detail-eyebrow">Detail menu</span>
                <h3>{formatDate(data.menu_date)}</h3>
                <p>Ringkasan menu harian dan kandungan gizi porsi kecil serta porsi besar.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rich-detail-close-btn" aria-label="Tutup detail laporan menu">
              Tutup
            </button>
          </div>

          <div className="rich-detail-summary-grid menu-detail-summary-grid">
            <div className="rich-detail-summary-card">
              <div className="rich-detail-summary-icon tone-blue">
                <AppIcon name="date" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-summary-copy">
                <span>Tanggal</span>
                <strong>{formatDate(data.menu_date)}</strong>
              </div>
            </div>
            <div className="rich-detail-summary-card">
              <div className="rich-detail-summary-icon tone-emerald">
                <AppIcon name="calculator" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="rich-detail-summary-copy">
                <span>Total item menu</span>
                <strong>{menuNames.length.toLocaleString("id-ID")}</strong>
              </div>
            </div>
          </div>

          <section className="rich-detail-section">
            <div className="rich-detail-section-head">
              <div>
                <span className="rich-detail-group-kicker">Daftar</span>
                <h4>Nama menu</h4>
              </div>
              <span className="rich-detail-group-count">{menuNames.length} item</span>
            </div>
            <div className="menu-detail-chip-grid">
              {menuNames.map((name, index) => (
                <div
                  key={`${name}-${index}`}
                  className="menu-detail-chip"
                >
                  <span className="table-index-badge">{index + 1}</span>
                  {name}
                </div>
              ))}
            </div>
          </section>

          <section className="rich-detail-section">
            <div className="rich-detail-section-head">
              <div>
                <span className="rich-detail-group-kicker">Gizi</span>
                <h4>Kandungan per porsi</h4>
              </div>
            </div>
            <div className="table-wrap overflow-x-auto rounded-2xl">
              <table className="data-table rich-detail-table min-w-[720px]">
                <thead>
                  <tr>
                    <th className="text-left">Komponen</th>
                    <th className="text-right">Porsi kecil</th>
                    <th className="text-right">Porsi besar</th>
                  </tr>
                </thead>
                <tbody>
                  {nutritionRows.map(([label, key, unit]) => (
                    <tr key={key}>
                      <td className="text-left">{label}</td>
                      <td className="text-right">{formatNumber(data[`small_${key}`])} {unit}</td>
                      <td className="text-right">{formatNumber(data[`large_${key}`])} {unit}</td>
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
