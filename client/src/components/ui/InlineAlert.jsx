import { AppIcon, APP_ICON_WEIGHT } from "./appIcons.jsx";

const ICON_BY_TONE = {
  info: "activity",
  success: "statusFull",
  warning: "statusPartial",
  danger: "statusPartial",
};

export default function InlineAlert({
  tone = "info",
  title,
  children,
  className = "",
}) {
  const role = tone === "danger" || tone === "error" ? "alert" : "status";

  return (
    <div className={["ui-inline-alert", `ui-inline-alert-${tone}`, className].filter(Boolean).join(" ")} role={role}>
      <span className="ui-inline-alert-icon">
        <AppIcon name={ICON_BY_TONE[tone] || ICON_BY_TONE.info} size={18} weight={APP_ICON_WEIGHT.summary} />
      </span>
      <div className="ui-inline-alert-copy">
        {title ? <strong>{title}</strong> : null}
        {children ? <span>{children}</span> : null}
      </div>
    </div>
  );
}
