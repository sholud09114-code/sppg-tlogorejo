import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

export default function HomeEmptyCard({
  eyebrow,
  title = "Data belum diisi",
  description,
  actionLabel,
  onAction,
  icon = "empty",
}) {
  return (
    <div className="summary-card home-feature-card home-action-card home-empty-card">
      <div className="home-feature-icon-wrap">
        <div className="summary-metric-icon summary-metric-icon-blue">
          <AppIcon name={icon} weight={APP_ICON_WEIGHT.summary} />
        </div>
      </div>
      <div className="home-feature-main">
        {eyebrow ? <span className="summary-card-label">{eyebrow}</span> : null}
        <strong className="home-feature-title">{title}</strong>
        {description ? <span className="home-summary-helper">{description}</span> : null}
      </div>
      {actionLabel && onAction ? (
        <button type="button" className="submit-btn home-link-btn" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
