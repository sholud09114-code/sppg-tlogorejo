export default function ShoppingReportHeaderSection({
  form,
  loading,
  onHeaderChange,
  onMenuNameChange,
  onNumberChange,
}) {
  return (
    <section className="data-form-section">
      <div className="data-form-section-head">
        <span className="data-form-step">2.</span>
        <div>
          <h4>Data Laporan</h4>
          <p>Isi tanggal, menu, jumlah porsi, dan catatan laporan belanja.</p>
        </div>
      </div>
      <div className="form-grid grid-cols-1 md:grid-cols-2">
        <div className="form-field">
          <label htmlFor="shopping_report_date">Tanggal laporan</label>
          <input
            id="shopping_report_date"
            type="date"
            className="w-full"
            value={form.report_date}
            onChange={(e) => onHeaderChange("report_date", e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-field">
          <label htmlFor="shopping_menu_name">Nama menu</label>
          <input
            id="shopping_menu_name"
            type="text"
            className="w-full"
            value={form.menu_name}
            onChange={(e) => onMenuNameChange(e.target.value)}
            placeholder="Contoh: Nasi, ayam, sayur"
            disabled={loading}
          />
        </div>
        <div className="form-field">
          <label htmlFor="shopping_small_portion_count">Jumlah porsi kecil</label>
          <input
            id="shopping_small_portion_count"
            type="number"
            className="w-full"
            min="0"
            step="0.01"
            value={form.small_portion_count}
            onChange={(e) => onNumberChange("header", null, "small_portion_count", e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-field">
          <label htmlFor="shopping_large_portion_count">Jumlah porsi besar</label>
          <input
            id="shopping_large_portion_count"
            type="number"
            className="w-full"
            min="0"
            step="0.01"
            value={form.large_portion_count}
            onChange={(e) => onNumberChange("header", null, "large_portion_count", e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-field">
          <label htmlFor="shopping_notes">Catatan</label>
          <input
            id="shopping_notes"
            type="text"
            className="w-full"
            value={form.notes}
            onChange={(e) => onHeaderChange("notes", e.target.value)}
            placeholder="Opsional"
            disabled={loading}
          />
        </div>
      </div>
    </section>
  );
}
