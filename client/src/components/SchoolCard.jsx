const STATUS_OPTIONS = [
  { value: "penuh", label: "Dilayani penuh" },
  { value: "libur", label: "Libur" },
  { value: "sebagian", label: "Dilayani sebagian" },
];

function getDefaultSplit(unit, actualPm) {
  const smallTarget = Number(unit.small_target || 0);
  const largeTarget = Number(unit.large_target || 0);
  const totalTarget = smallTarget + largeTarget;
  const actual = Number(actualPm || 0);

  if (actual <= 0 || totalTarget <= 0) {
    return { actualSmall: 0, actualLarge: 0 };
  }

  if (smallTarget <= 0) return { actualSmall: 0, actualLarge: actual };
  if (largeTarget <= 0) return { actualSmall: actual, actualLarge: 0 };

  const rawSmall = (smallTarget / totalTarget) * actual;
  let actualSmall = Math.round(rawSmall);
  actualSmall = Math.max(0, Math.min(actualSmall, actual, smallTarget));
  let actualLarge = actual - actualSmall;

  if (actualLarge > largeTarget) {
    actualLarge = largeTarget;
    actualSmall = actual - actualLarge;
  }

  return { actualSmall, actualLarge };
}

export default function SchoolCard({ unit, entry, onChange }) {
  const smallTarget = Number(unit.small_target || 0);
  const largeTarget = Number(unit.large_target || 0);
  const hasSplitPortion = smallTarget > 0 && largeTarget > 0;

  // handle status button click
  const handleStatus = (status) => {
    let actual = 0;
    let actualSmall = 0;
    let actualLarge = 0;

    if (status === "penuh") {
      actual = unit.default_target;
      actualSmall = smallTarget;
      actualLarge = largeTarget;
    } else if (status === "libur") {
      actual = 0;
    } else if (status === "sebagian") {
      actual = entry.actual_pm || 0;
      if (hasSplitPortion) {
        actualSmall = Number(entry.actual_small_portion || 0);
        actualLarge = Number(entry.actual_large_portion || 0);
      } else {
        const fallback = getDefaultSplit(unit, actual);
        actualSmall = fallback.actualSmall;
        actualLarge = fallback.actualLarge;
      }
    }

    onChange({
      ...entry,
      service_status: status,
      actual_pm: actual,
      actual_small_portion: actualSmall,
      actual_large_portion: actualLarge,
      error: null,
    });
  };

  // handle partial number input with validation
  const handlePartial = (raw) => {
    let error = null;
    let actual;

    if (raw === "") {
      actual = 0;
    } else {
      const val = parseInt(raw, 10);
      if (isNaN(val) || val < 0) {
        error = "Nilai tidak boleh negatif.";
        actual = 0;
      } else if (val > unit.default_target) {
        error = `Tidak boleh melebihi target (${unit.default_target}).`;
        actual = unit.default_target;
      } else {
        actual = val;
      }
    }

    onChange({ ...entry, actual_pm: actual, error });
  };

  const handleSplitPartial = (field, raw) => {
    let error = null;
    const nextSmall =
      field === "actual_small_portion"
        ? raw === ""
          ? 0
          : Number(raw)
        : Number(entry.actual_small_portion || 0);
    const nextLarge =
      field === "actual_large_portion"
        ? raw === ""
          ? 0
          : Number(raw)
        : Number(entry.actual_large_portion || 0);

    if (
      !Number.isFinite(nextSmall) ||
      !Number.isFinite(nextLarge) ||
      nextSmall < 0 ||
      nextLarge < 0
    ) {
      error = "Nilai porsi tidak boleh negatif.";
    } else if (nextSmall > smallTarget) {
      error = `Porsi kecil tidak boleh melebihi ${smallTarget}.`;
    } else if (nextLarge > largeTarget) {
      error = `Porsi besar tidak boleh melebihi ${largeTarget}.`;
    }

    onChange({
      ...entry,
      actual_small_portion: error ? Number(entry.actual_small_portion || 0) : nextSmall,
      actual_large_portion: error ? Number(entry.actual_large_portion || 0) : nextLarge,
      actual_pm: error ? Number(entry.actual_pm || 0) : nextSmall + nextLarge,
      error,
    });
  };

  return (
    <div className="school-card rounded-2xl p-3 sm:p-4">
      <div className="school-card-head">
        <span className="name">{unit.name}</span>
        <span className="target">
          Target: <strong>{unit.default_target}</strong> PM
        </span>
      </div>

      <div className="status-group flex-col sm:flex-row">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = entry.service_status === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={`status-btn min-h-10 ${isActive ? "active " + opt.value : ""}`}
              onClick={() => handleStatus(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {entry.service_status === "sebagian" &&
        (hasSplitPortion ? (
          <div className="partial-input-grid">
            <div className="partial-input-wrap">
              <label htmlFor={`partial-small-${unit.id}`}>Porsi kecil:</label>
              <input
                id={`partial-small-${unit.id}`}
                type="number"
                className="w-full sm:w-24"
                min="0"
                max={smallTarget}
                value={entry.actual_small_portion ?? ""}
                onChange={(e) =>
                  handleSplitPartial("actual_small_portion", e.target.value)
                }
                placeholder="0"
              />
              <span className="hint">maks {smallTarget}</span>
            </div>
            <div className="partial-input-wrap">
              <label htmlFor={`partial-large-${unit.id}`}>Porsi besar:</label>
              <input
                id={`partial-large-${unit.id}`}
                type="number"
                className="w-full sm:w-24"
                min="0"
                max={largeTarget}
                value={entry.actual_large_portion ?? ""}
                onChange={(e) =>
                  handleSplitPartial("actual_large_portion", e.target.value)
                }
                placeholder="0"
              />
              <span className="hint">maks {largeTarget}</span>
            </div>
          </div>
        ) : (
          <div className="partial-input-wrap">
            <label htmlFor={`partial-${unit.id}`}>Jumlah aktual:</label>
            <input
              id={`partial-${unit.id}`}
              type="number"
              className="w-full sm:w-24"
              min="0"
              max={unit.default_target}
              value={entry.actual_pm || ""}
              onChange={(e) => handlePartial(e.target.value)}
              placeholder="0"
            />
            <span className="hint">maks {unit.default_target}</span>
          </div>
        ))}

      {entry.error && <div className="error-message">{entry.error}</div>}
    </div>
  );
}
