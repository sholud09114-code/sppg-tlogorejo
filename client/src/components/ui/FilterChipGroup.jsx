export default function FilterChipGroup({
  filters = [],
  active,
  counts = {},
  onChange,
  ariaLabel,
  className = "",
}) {
  return (
    <div
      className={["daily-filter-chips", "ui-filter-chip-group", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={ariaLabel}
    >
      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          className={active === filter.id ? "active" : ""}
          onClick={() => onChange?.(filter.id)}
          disabled={filter.disabled}
        >
          <span>{filter.label}</span>
          {filter.count != null || counts[filter.id] != null ? (
            <strong>{filter.count ?? counts[filter.id] ?? 0}</strong>
          ) : null}
        </button>
      ))}
    </div>
  );
}
