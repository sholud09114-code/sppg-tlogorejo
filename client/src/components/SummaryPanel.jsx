const CATEGORY_ORDER = ["PAUD/TK/KB", "SD", "SMP", "SMK"];

export default function SummaryPanel({
  totals,
  totalFilled,
  totalUnits,
  onSubmit,
  loading,
  className = "",
}) {
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <aside className={`summary-panel w-full rounded-2xl p-4 sm:p-5 xl:sticky xl:top-2 ${className}`.trim()}>
      <div className="summary-title">Akumulasi jumlah PM</div>

      <div className="summary-rows">
        {CATEGORY_ORDER.map((cat) => (
          <div className="summary-row" key={cat}>
            <span className="label">{cat}</span>
            <span className="value">
              {(totals[cat] || 0).toLocaleString("id-ID")}
            </span>
          </div>
        ))}
      </div>

      <div className="summary-total">
        <span className="label">Total</span>
        <span className="value">{grand.toLocaleString("id-ID")}</span>
      </div>

      <div className="progress-label">
        {totalFilled} dari {totalUnits} unit diisi
      </div>

      <button
        type="button"
        className="submit-btn w-full"
        onClick={onSubmit}
        disabled={loading}
      >
        {loading ? "Menyimpan..." : "Submit laporan"}
      </button>
    </aside>
  );
}
