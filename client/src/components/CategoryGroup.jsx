import SchoolCard from "./SchoolCard.jsx";

const EMPTY_ENTRY = { service_status: null, actual_pm: 0, error: null };

export default function CategoryGroup({ category, units, entries, onEntryChange }) {
  return (
    <section className="category-group space-y-2">
      <div className="category-header">
        <span className="cat-title">{category}</span>
        <span className="cat-count">{units.length} unit</span>
      </div>
      {units.map((u, index) => (
        <SchoolCard
          key={u.id}
          unit={u}
          index={index + 1}
          entry={entries[u.id] || EMPTY_ENTRY}
          onChange={(newEntry) => onEntryChange(u.id, newEntry)}
        />
      ))}
    </section>
  );
}
