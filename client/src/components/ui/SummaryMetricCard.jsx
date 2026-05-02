import { AppIcon, APP_ICON_WEIGHT } from "./appIcons.jsx";

export default function SummaryMetricCard({
  label,
  value,
  helper,
  icon,
  tone = "blue",
  emphasis = false,
  className = "",
  onClick,
  title,
}) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      className={[
        "summary-card",
        "summary-metric-card",
        emphasis ? "summary-metric-card-emphasis" : "",
        onClick ? "summary-metric-card-interactive" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      title={title}
      aria-label={title || (onClick ? `Buka ${label}` : undefined)}
    >
      <div className={`summary-metric-icon summary-metric-icon-${tone}`}>
        <AppIcon name={icon} weight={APP_ICON_WEIGHT.summary} />
      </div>
      <div className="summary-metric-content">
        <span className="summary-card-label">{label}</span>
        <strong>{value}</strong>
        {helper ? <span className="summary-metric-helper">{helper}</span> : null}
      </div>
    </Component>
  );
}
