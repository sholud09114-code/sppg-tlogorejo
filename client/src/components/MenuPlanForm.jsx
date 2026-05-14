import { useEffect, useMemo, useState } from "react";
import {
  MENU_PLAN_CATEGORIES,
  MENU_PLAN_DAYS,
  addDays,
  buildEmptyItems,
  groupItemsByDayCategory,
  isCellHoliday,
  joinCellItems,
  monthLabel,
  parseCellLines,
  parseIsoDate,
  startOfWeekMonday,
  toIsoDate,
  weekNumberOfMonth,
} from "../shared/utils/menuPlanHelpers.js";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

const HOLIDAY_PLACEHOLDER = "LIBUR";

function buildInitialState(initialData) {
  if (initialData) {
    return {
      year: initialData.year,
      month: initialData.month,
      week_number: initialData.week_number,
      start_date: initialData.start_date,
      end_date: initialData.end_date,
      notes: initialData.notes ?? "",
      items: initialData.items || [],
    };
  }

  const today = new Date();
  const monday = startOfWeekMonday(today);
  const startIso = toIsoDate(monday);
  const endIso = toIsoDate(addDays(monday, 5));
  return {
    year: monday.getFullYear(),
    month: monday.getMonth() + 1,
    week_number: weekNumberOfMonth(monday),
    start_date: startIso,
    end_date: endIso,
    notes: "",
    items: buildEmptyItems(monday),
  };
}

function regenerateItemsForRange(startIso, currentItems) {
  const start = parseIsoDate(startIso);
  if (!start) return currentItems;
  const grouped = groupItemsByDayCategory(currentItems);

  const next = [];
  MENU_PLAN_DAYS.forEach((day, dayIndex) => {
    const dateForDay = addDays(start, dayIndex);
    const planDate = toIsoDate(dateForDay);
    MENU_PLAN_CATEGORIES.forEach((cat, catIndex) => {
      const key = `${day.dow}|${cat.key}`;
      const existing = grouped.get(key) || [];
      if (existing.length === 0) {
        next.push({
          plan_date: planDate,
          day_of_week: day.dow,
          category: cat.key,
          menu_name: "",
          portion_target: "all",
          is_holiday: false,
          sort_order: catIndex,
        });
      } else {
        existing.forEach((item, idx) => {
          next.push({
            ...item,
            plan_date: planDate,
            day_of_week: day.dow,
            sort_order: idx,
          });
        });
      }
    });
  });

  return next;
}

export default function MenuPlanForm({
  open,
  initialData,
  loading,
  onClose,
  onSubmit,
}) {
  const [state, setState] = useState(() => buildInitialState(initialData));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setState(buildInitialState(initialData));
      setError("");
    }
  }, [open, initialData]);

  const grouped = useMemo(() => groupItemsByDayCategory(state.items), [state.items]);
  const dayDates = useMemo(() => {
    const start = parseIsoDate(state.start_date);
    if (!start) return [];
    return MENU_PLAN_DAYS.map((day, idx) => toIsoDate(addDays(start, idx)));
  }, [state.start_date]);

  const handleFieldChange = (key, value) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleStartDateChange = (value) => {
    setState((prev) => {
      const start = parseIsoDate(value);
      if (!start) {
        return { ...prev, start_date: value };
      }
      const end = addDays(start, 5);
      return {
        ...prev,
        start_date: value,
        end_date: toIsoDate(end),
        year: start.getFullYear(),
        month: start.getMonth() + 1,
        week_number: weekNumberOfMonth(start),
        items: regenerateItemsForRange(value, prev.items),
      };
    });
  };

  const updateCellItems = (dow, category, nextItemsForCell) => {
    setState((prev) => {
      const filtered = prev.items.filter(
        (item) => !(item.day_of_week === dow && item.category === category)
      );
      return {
        ...prev,
        items: [...filtered, ...nextItemsForCell],
      };
    });
  };

  const handleCellTextChange = (dow, planDate, category, rawText) => {
    const items = parseCellLines(rawText, dow, planDate, category);
    updateCellItems(dow, category, items);
  };

  const handleHolidayToggle = (dow, planDate) => {
    setState((prev) => {
      const filtered = prev.items.filter((item) => item.day_of_week !== dow);
      const dayItems = prev.items.filter((item) => item.day_of_week === dow);
      const isHoliday = dayItems.length > 0 && dayItems.every((item) => item.is_holiday);
      const nextDayItems = MENU_PLAN_CATEGORIES.map((cat, idx) => ({
        plan_date: planDate,
        day_of_week: dow,
        category: cat.key,
        menu_name: isHoliday ? "" : HOLIDAY_PLACEHOLDER,
        portion_target: "all",
        is_holiday: !isHoliday,
        sort_order: idx,
      }));
      return { ...prev, items: [...filtered, ...nextDayItems] };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    const start = parseIsoDate(state.start_date);
    const end = parseIsoDate(state.end_date);
    if (!start || !end) {
      setError("Tanggal mulai/selesai tidak valid.");
      return;
    }
    if (start > end) {
      setError("Tanggal mulai tidak boleh setelah tanggal selesai.");
      return;
    }

    const cleanItems = state.items
      .filter((item) => item.menu_name?.trim() || item.is_holiday)
      .map((item) => ({
        ...item,
        menu_name: item.is_holiday
          ? HOLIDAY_PLACEHOLDER
          : (item.menu_name || "").trim(),
      }));

    onSubmit({
      year: Number(state.year),
      month: Number(state.month),
      week_number: Number(state.week_number),
      start_date: state.start_date,
      end_date: state.end_date,
      notes: state.notes ? state.notes.trim() : null,
      items: cleanItems,
    });
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card menu-plan-modal w-full max-w-6xl rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-plan-form-title"
      >
        <form onSubmit={handleSubmit} className="menu-plan-form-shell">
          <div className="menu-plan-form-head">
            <div>
              <span className="rich-detail-eyebrow">Rencana Menu</span>
              <h3 id="menu-plan-form-title">
                {monthLabel(state.month)} {state.year} - Minggu ke-{state.week_number}
              </h3>
              <p className="muted">
                Susun rencana menu mingguan per kategori. Tambahkan tag (PMB) atau (PMK)
                di akhir baris untuk membedakan porsi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => !loading && onClose()}
              className="rich-detail-close-btn"
              aria-label="Tutup form rencana menu"
            >
              Tutup
            </button>
          </div>

          <div className="menu-plan-form-meta">
            <label className="form-field">
              <span>Tanggal mulai (Senin)</span>
              <input
                type="date"
                value={state.start_date}
                onChange={(event) => handleStartDateChange(event.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>Tanggal selesai (Sabtu)</span>
              <input
                type="date"
                value={state.end_date}
                onChange={(event) => handleFieldChange("end_date", event.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>Minggu ke-</span>
              <input
                type="number"
                min={1}
                max={6}
                value={state.week_number}
                onChange={(event) =>
                  handleFieldChange("week_number", Number(event.target.value) || 1)
                }
                required
              />
            </label>
            <label className="form-field menu-plan-form-notes">
              <span>Catatan</span>
              <input
                type="text"
                value={state.notes || ""}
                onChange={(event) => handleFieldChange("notes", event.target.value)}
                placeholder="Catatan opsional untuk minggu ini"
                maxLength={500}
              />
            </label>
          </div>

          <div className="menu-plan-form-mobile-editor">
            {MENU_PLAN_DAYS.map((day, idx) => {
              const planDate = dayDates[idx];
              const dayItems = (state.items || []).filter(
                (item) => item.day_of_week === day.dow
              );
              const holiday =
                dayItems.length > 0 && dayItems.every((item) => item.is_holiday);
              return (
                <section
                  key={day.dow}
                  className={`menu-plan-form-day ${holiday ? "is-holiday" : ""}`}
                >
                  <header className="menu-plan-form-day-head">
                    <div>
                      <strong>{day.label}</strong>
                      <span>{planDate || "-"}</span>
                    </div>
                    <button
                      type="button"
                      className={`menu-plan-holiday-toggle ${holiday ? "active" : ""}`}
                      onClick={() => handleHolidayToggle(day.dow, planDate)}
                      disabled={loading}
                    >
                      <AppIcon
                        name="statusHoliday"
                        size={14}
                        weight={APP_ICON_WEIGHT.action}
                      />
                      <span>{holiday ? "Libur" : "Tandai libur"}</span>
                    </button>
                  </header>
                  {holiday ? (
                    <div className="menu-plan-holiday-cell">LIBUR</div>
                  ) : (
                    <div className="menu-plan-form-day-body">
                      {MENU_PLAN_CATEGORIES.map((cat) => {
                        const cellItems =
                          grouped.get(`${day.dow}|${cat.key}`) || [];
                        const value = joinCellItems(cellItems);
                        return (
                          <label
                            key={cat.key}
                            className="menu-plan-form-day-row"
                          >
                            <span className="menu-plan-form-day-label">
                              {cat.label}
                            </span>
                            <textarea
                              rows={1}
                              value={value}
                              placeholder="Nama menu"
                              onChange={(event) =>
                                handleCellTextChange(
                                  day.dow,
                                  planDate,
                                  cat.key,
                                  event.target.value
                                )
                              }
                              disabled={loading}
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="menu-plan-grid-wrap menu-plan-grid-desktop">
            <table className="menu-plan-grid">
              <thead>
                <tr>
                  <th className="menu-plan-grid-corner">Kategori</th>
                  {MENU_PLAN_DAYS.map((day, idx) => {
                    const planDate = dayDates[idx];
                    const dayItems = (state.items || []).filter(
                      (item) => item.day_of_week === day.dow
                    );
                    const holiday =
                      dayItems.length > 0 && dayItems.every((item) => item.is_holiday);
                    return (
                      <th key={day.dow} className={holiday ? "is-holiday" : ""}>
                        <div className="menu-plan-day-head">
                          <strong>{day.label}</strong>
                          <span>{planDate || "-"}</span>
                          <button
                            type="button"
                            className={`menu-plan-holiday-toggle ${holiday ? "active" : ""}`}
                            onClick={() => handleHolidayToggle(day.dow, planDate)}
                            disabled={loading}
                            title={holiday ? "Batalkan libur" : "Tandai libur"}
                          >
                            <AppIcon
                              name="statusHoliday"
                              size={14}
                              weight={APP_ICON_WEIGHT.action}
                            />
                            <span>{holiday ? "Libur" : "Tandai libur"}</span>
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {MENU_PLAN_CATEGORIES.map((cat) => (
                  <tr key={cat.key}>
                    <th scope="row" className="menu-plan-grid-rowhead">
                      {cat.label}
                    </th>
                    {MENU_PLAN_DAYS.map((day, idx) => {
                      const planDate = dayDates[idx];
                      const cellItems =
                        grouped.get(`${day.dow}|${cat.key}`) || [];
                      const holiday = isCellHoliday(cellItems);
                      const value = joinCellItems(cellItems);
                      return (
                        <td
                          key={`${cat.key}-${day.dow}`}
                          className={holiday ? "is-holiday" : ""}
                        >
                          {holiday ? (
                            <div className="menu-plan-holiday-cell">LIBUR</div>
                          ) : (
                            <textarea
                              rows={2}
                              value={value}
                              placeholder="Nama menu"
                              onChange={(event) =>
                                handleCellTextChange(
                                  day.dow,
                                  planDate,
                                  cat.key,
                                  event.target.value
                                )
                              }
                              disabled={loading}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error ? <div className="form-error" role="alert">{error}</div> : null}

          <div className="menu-plan-form-footer">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => !loading && onClose()}
              disabled={loading}
            >
              Batal
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              <span className="button-with-icon">
                <AppIcon name="send" size={18} weight={APP_ICON_WEIGHT.action} />
                <span>{loading ? "Menyimpan..." : "Simpan rencana"}</span>
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
