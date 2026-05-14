import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";
import { formatDateShort } from "../shared/utils/formatters.js";
import {
  MENU_PLAN_CATEGORIES,
  MENU_PLAN_DAYS,
  addDays,
  copyTextToClipboard,
  formatDayMenuForCopy,
  groupItemsByDayCategory,
  isCellHoliday,
  monthLabel,
  parseIsoDate,
  toIsoDate,
} from "../shared/utils/menuPlanHelpers.js";

function buildDayDates(startDate) {
  if (!startDate) return [];
  const start = parseIsoDate(startDate);
  if (!start) return [];
  return MENU_PLAN_DAYS.map((_, idx) => toIsoDate(addDays(start, idx)));
}

function renderCellEntries(cellItems) {
  if (!cellItems || cellItems.length === 0) {
    return <span className="muted">-</span>;
  }
  const visibleItems = cellItems.filter((item) => item.menu_name && !item.is_holiday);
  if (visibleItems.length === 0) {
    return <span className="muted">-</span>;
  }
  return (
    <ul className="menu-plan-day-entries">
      {visibleItems.map((item, idx) => (
        <li key={idx}>
          <span>{item.menu_name}</span>
          {item.portion_target && item.portion_target !== "all" ? (
            <em className={`menu-plan-portion-tag tag-${item.portion_target.toLowerCase()}`}>
              {item.portion_target}
            </em>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function MenuPlanDetail({ open, data, onClose, onCopyDay }) {
  if (!open || !data) return null;

  const dayDates = buildDayDates(data.start_date);
  const grouped = groupItemsByDayCategory(data.items || []);

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card menu-plan-modal menu-plan-detail-modal w-full max-w-3xl rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="menu-plan-form-shell">
          <div className="menu-plan-form-head">
            <div>
              <span className="rich-detail-eyebrow">Detail rencana menu</span>
              <h3>
                {monthLabel(data.month)} {data.year} - Minggu ke-{data.week_number}
              </h3>
              <p className="muted">
                {formatDateShort(data.start_date)} - {formatDateShort(data.end_date)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rich-detail-close-btn"
              aria-label="Tutup detail rencana menu"
            >
              Tutup
            </button>
          </div>

          {data.notes ? (
            <div className="menu-plan-notes">
              <AppIcon name="menu" size={16} weight={APP_ICON_WEIGHT.action} />
              <span>{data.notes}</span>
            </div>
          ) : null}

          <div className="menu-plan-day-list">
            {MENU_PLAN_DAYS.map((day, idx) => {
              const dayItems = (data.items || []).filter(
                (item) => item.day_of_week === day.dow
              );
              const holiday =
                dayItems.length > 0 && dayItems.every((item) => item.is_holiday);

              return (
                <article
                  key={day.dow}
                  className={`menu-plan-day-card ${holiday ? "is-holiday" : ""}`}
                >
                  <header className="menu-plan-day-card-head">
                    <div className="menu-plan-day-card-title">
                      <strong>{day.label}</strong>
                      <span>{dayDates[idx] ? formatDateShort(dayDates[idx]) : "-"}</span>
                    </div>
                    <div className="menu-plan-day-card-tools">
                      {holiday ? (
                        <span className="menu-plan-day-holiday-badge">
                          <AppIcon
                            name="statusHoliday"
                            size={14}
                            weight={APP_ICON_WEIGHT.action}
                          />
                          LIBUR
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="menu-plan-copy-btn"
                        onClick={async () => {
                          const text = formatDayMenuForCopy(data, day.dow);
                          const ok = await copyTextToClipboard(text);
                          if (onCopyDay) {
                            onCopyDay({
                              ok,
                              text,
                              dayLabel: day.label,
                              planDate: dayDates[idx],
                            });
                          }
                        }}
                        aria-label={`Salin menu ${day.label} ke clipboard`}
                        title={`Salin menu ${day.label}`}
                      >
                        <AppIcon name="copy" size={14} weight={APP_ICON_WEIGHT.action} />
                        <span>Salin</span>
                      </button>
                    </div>
                  </header>

                  {holiday ? null : (
                    <dl className="menu-plan-day-card-body">
                      {MENU_PLAN_CATEGORIES.map((cat) => {
                        const cellItems = grouped.get(`${day.dow}|${cat.key}`) || [];
                        const isHolidayCell = isCellHoliday(cellItems);
                        return (
                          <div className="menu-plan-day-row" key={cat.key}>
                            <dt>{cat.label}</dt>
                            <dd>
                              {isHolidayCell ? (
                                <span className="muted">Libur</span>
                              ) : (
                                renderCellEntries(cellItems)
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
