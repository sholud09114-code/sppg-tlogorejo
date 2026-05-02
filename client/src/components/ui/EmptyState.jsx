import { AppIcon, APP_ICON_WEIGHT } from "./appIcons.jsx";

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}) {
  return (
    <div className={["empty-state", "ui-empty-state", className].filter(Boolean).join(" ")}>
      {icon ? (
        <span className="ui-empty-state-icon">
          <AppIcon name={icon} size={24} weight={APP_ICON_WEIGHT.summary} />
        </span>
      ) : null}
      {title ? <strong>{title}</strong> : null}
      {description ? <span>{description}</span> : null}
      {action ? <div className="ui-empty-state-action">{action}</div> : null}
    </div>
  );
}
