import EmptyState from "./EmptyState.jsx";
import InlineAlert from "./InlineAlert.jsx";
import LoadingMessage from "../LoadingMessage.jsx";

export default function DataPanel({
  title,
  description,
  className = "",
  bodyClassName = "",
  loading = false,
  loadingMessage = "Memuat data...",
  empty = false,
  emptyTitle,
  emptyDescription,
  error,
  children,
}) {
  return (
    <div className={["feature-data-panel", "ui-data-panel", className].filter(Boolean).join(" ")}>
      {title || description ? (
        <div className="ui-data-panel-head">
          <div className="min-w-0">
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
        </div>
      ) : null}

      <div className={["ui-data-panel-body", bodyClassName].filter(Boolean).join(" ")}>
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
        {loading ? (
          <LoadingMessage>{loadingMessage}</LoadingMessage>
        ) : empty ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
