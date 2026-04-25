import { AppIcon, APP_ICON_WEIGHT } from "./appIcons.jsx";

export default function SummaryMetricCard({
  label,
  value,
  helper,
  icon,
  tone = "blue",
  emphasis = false,
  className = "",
}) {
  return (
    <div
      className={[
        "summary-card",
        "summary-metric-card",
        emphasis ? "summary-metric-card-emphasis" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`summary-metric-icon summary-metric-icon-${tone}`}>
        <AppIcon name={icon} weight={APP_ICON_WEIGHT.summary} />
      </div>
      <div className="summary-metric-content">
        <span className="summary-card-label">{label}</span>
        <strong>{value}</strong>
        {helper ? <span className="summary-metric-helper">{helper}</span> : null}
      </div>
    </div>
  );
}
