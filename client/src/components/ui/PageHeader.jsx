import { AppIcon, APP_ICON_WEIGHT } from "./appIcons.jsx";

export default function PageHeader({
  title,
  description,
  icon,
  actions,
  className = "",
  titleClassName = "",
}) {
  return (
    <div className={["page-title", "gap-4", "ui-page-header", className].filter(Boolean).join(" ")}>
      <div className="ui-page-header-copy min-w-0">
        {icon ? (
          <span className="ui-page-header-icon">
            <AppIcon name={icon} size={24} weight={APP_ICON_WEIGHT.summary} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className={titleClassName}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="ui-page-header-actions">{actions}</div> : null}
    </div>
  );
}
