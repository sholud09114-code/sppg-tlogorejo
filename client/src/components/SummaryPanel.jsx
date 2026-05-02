import { REPORT_CATEGORY_ORDER as CATEGORY_ORDER } from "../shared/constants/reportConstants.js";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

export default function SummaryPanel({
  totals,
  totalFilled,
  totalUnits,
  onSubmit,
  loading,
  disabled = false,
  disabledReason = "",
  className = "",
}) {
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <aside className={`summary-panel w-full rounded-2xl p-4 sm:p-5 xl:sticky xl:top-2 ${className}`.trim()}>
      <div className="summary-panel-head">
        <span className="summary-panel-icon">
          <AppIcon name="activity" size={22} weight={APP_ICON_WEIGHT.summary} />
        </span>
        <div>
          <div className="summary-title">Akumulasi jumlah PM</div>
        </div>
      </div>

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
        disabled={loading || disabled}
        title={disabled ? disabledReason : undefined}
      >
        <span className="button-with-icon">
          <AppIcon name="send" size={18} weight={APP_ICON_WEIGHT.action} />
          <span>{loading ? "Menyimpan..." : "Submit laporan"}</span>
        </span>
      </button>
      <div className="summary-panel-safe-note">
        Pastikan semua data sudah sesuai sebelum submit.
      </div>
    </aside>
  );
}
