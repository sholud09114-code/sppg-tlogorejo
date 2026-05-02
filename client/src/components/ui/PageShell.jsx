export default function PageShell({ as: Component = "section", className = "", children }) {
  return <Component className={["feature-page-card", className].filter(Boolean).join(" ")}>{children}</Component>;
}
