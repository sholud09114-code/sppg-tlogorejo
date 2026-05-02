export default function ActionToolbar({ className = "", children }) {
  return (
    <div className={["page-actions", "action-toolbar-card", "ui-action-toolbar", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
