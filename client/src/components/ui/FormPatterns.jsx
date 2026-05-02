import { AppIcon, APP_ICON_WEIGHT } from "./appIcons.jsx";

export function StickyFormHeader({ className = "", children }) {
  return <div className={`daily-editor-sticky-header ${className}`.trim()}>{children}</div>;
}

export function QuickActionBar({ ariaLabel, className = "", children }) {
  return (
    <div className={`daily-quick-actions ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

export function MobileSubmitBar({ className = "", title, subtitle, children }) {
  return (
    <div className={`mobile-submit-bar ${className}`.trim()}>
      <div className="mobile-submit-bar-copy">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function SummaryPanelCard({
  className = "",
  title,
  icon = "activity",
  rows = [],
  totalLabel,
  totalValue,
  submitLabel,
  loading = false,
  disabled = false,
  disabledReason = "",
  note,
}) {
  return (
    <aside className={`summary-panel ${className}`.trim()}>
      <div className="summary-panel-head">
        <span className="summary-panel-icon">
          <AppIcon name={icon} size={22} weight={APP_ICON_WEIGHT.summary} />
        </span>
        <div>
          <div className="summary-title">{title}</div>
        </div>
      </div>

      <div className="summary-rows">
        {rows.map((row) => (
          <div className="summary-row" key={row.label}>
            <span className="label">{row.label}</span>
            <span className="value">{row.value}</span>
          </div>
        ))}
      </div>

      {totalLabel ? (
        <div className="summary-total">
          <span className="label">{totalLabel}</span>
          <span className="value">{totalValue}</span>
        </div>
      ) : null}

      {submitLabel ? (
        <button
          type="submit"
          className="submit-btn w-full"
          disabled={loading || disabled}
          title={disabled ? disabledReason : undefined}
        >
          <span className="button-with-icon">
            <AppIcon name="send" size={18} weight={APP_ICON_WEIGHT.action} />
            <span>{loading ? "Menyimpan..." : submitLabel}</span>
          </span>
        </button>
      ) : null}

      {note ? <div className="summary-panel-safe-note">{note}</div> : null}
    </aside>
  );
}

export function compactRowClass(baseClass, { active = false, needsReview = false, verified = false } = {}) {
  return [baseClass, active ? "active-row" : "", needsReview ? "needs-review" : "", verified ? "verified-row" : ""]
    .filter(Boolean)
    .join(" ");
}
