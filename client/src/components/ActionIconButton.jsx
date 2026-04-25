import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

const ICON_MAP = {
  view: "view",
  edit: "edit",
  delete: "delete",
  history: "history",
};

export default function ActionIconButton({
  type = "button",
  action = "view",
  label,
  className = "",
  ...props
}) {
  const iconName = ICON_MAP[action] || "view";
  const mergedClassName = [
    "action-icon-btn",
    `action-icon-btn-${action}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={mergedClassName}
      aria-label={label}
      data-tooltip={label}
      {...props}
    >
      <AppIcon name={iconName} size={18} weight={APP_ICON_WEIGHT.action} />
      <span className="action-icon-btn-label">{label}</span>
    </button>
  );
}
