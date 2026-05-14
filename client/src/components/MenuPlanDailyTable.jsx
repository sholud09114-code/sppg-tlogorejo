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

const CATEGORY_LOOKUP = MENU_PLAN_CATEGORIES.reduce((acc, cat) => {
  acc[cat.key] = cat.label;
  return acc;
}, {});

function flattenDays(plans = []) {
  const rows = [];
  for (const plan of plans) {
    const startDate = parseIsoDate(plan.start_date);
    const grouped = groupItemsByDayCategory(plan.items || []);

    for (let idx = 0; idx < MENU_PLAN_DAYS.length; idx += 1) {
      const day = MENU_PLAN_DAYS[idx];
      const planDate = startDate ? toIsoDate(addDays(startDate, idx)) : null;
      const cellsByCategory = MENU_PLAN_CATEGORIES.map((cat) => {
        const cellItems = grouped.get(`${day.dow}|${cat.key}`) || [];
        return { category: cat.key, items: cellItems };
      });
      const allHoliday =
        cellsByCategory.length > 0 &&
        cellsByCategory.every((cell) => cell.items.length > 0 && isCellHoliday(cell.items));

      rows.push({
        plan,
        dayIndex: idx,
        dayLabel: day.label,
        dow: day.dow,
        planDate,
        cells: cellsByCategory,
        holiday: allHoliday,
        rowKey: `${plan.id}-${day.dow}`,
      });
    }
  }
  return rows;
}

function CellEntries({ items }) {
  const visible = items.filter((item) => item.menu_name && !item.is_holiday);
  if (visible.length === 0) {
    return <span className="muted">-</span>;
  }
  return (
    <ul className="menu-plan-day-entries">
      {visible.map((item, idx) => (
        <li key={`${item.menu_name}-${idx}`}>
          <span>{item.menu_name}</span>
          {item.portion_target && item.portion_target !== "all" ? (
            <em
              className={`menu-plan-portion-tag tag-${item.portion_target.toLowerCase()}`}
            >
              {item.portion_target}
            </em>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function MenuPlanDailyTable({
  plans,
  loading,
  onView,
  onEdit,
  onDelete,
  canManage,
  onCopyDay,
}) {
  if (loading) {
    return <div className="empty-state">Memuat rencana menu...</div>;
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="empty-state empty-state-rich">
        <AppIcon name="empty" size={32} weight={APP_ICON_WEIGHT.summary} />
        <strong>Belum ada rencana menu</strong>
        <p>Tambahkan rencana menu mingguan untuk memetakan menu per hari.</p>
      </div>
    );
  }

  const rows = flattenDays(plans);

  return (
    <>
      <div className="mobile-data-list menu-plan-mobile-list">
        {plans.map((plan) => {
          const startDate = parseIsoDate(plan.start_date);
          const grouped = groupItemsByDayCategory(plan.items || []);
          return (
            <article className="mobile-data-card menu-plan-mobile-card" key={plan.id}>
              <header className="menu-plan-mobile-card-head">
                <div>
                  <strong>
                    {monthLabel(plan.month)} {plan.year}
                  </strong>
                  <span>Minggu ke-{plan.week_number}</span>
                  <span className="muted">
                    {formatDateShort(plan.start_date)} -{" "}
                    {formatDateShort(plan.end_date)}
                  </span>
                </div>
                <div className="menu-plan-mobile-card-tools">
                  <button
                    type="button"
                    className="menu-plan-action-btn menu-plan-action-btn-compact"
                    onClick={() => onView(plan)}
                    aria-label="Lihat rencana menu"
                  >
                    <AppIcon name="view" size={14} weight={APP_ICON_WEIGHT.action} />
                    <span>Lihat</span>
                  </button>
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className="menu-plan-action-btn menu-plan-action-btn-compact"
                        onClick={() => onEdit(plan)}
                        aria-label="Ubah rencana menu"
                      >
                        <AppIcon name="edit" size={14} weight={APP_ICON_WEIGHT.action} />
                        <span>Ubah</span>
                      </button>
                      <button
                        type="button"
                        className="menu-plan-action-btn menu-plan-action-btn-compact menu-plan-action-btn-danger"
                        onClick={() => onDelete(plan)}
                        aria-label="Hapus rencana menu"
                      >
                        <AppIcon name="delete" size={14} weight={APP_ICON_WEIGHT.action} />
                        <span>Hapus</span>
                      </button>
                    </>
                  ) : null}
                </div>
              </header>
              <div className="menu-plan-mobile-day-list">
                {MENU_PLAN_DAYS.map((day, idx) => {
                  const planDate = startDate ? toIsoDate(addDays(startDate, idx)) : null;
                  const dayItems = (plan.items || []).filter(
                    (item) => item.day_of_week === day.dow
                  );
                  const holiday =
                    dayItems.length > 0 && dayItems.every((item) => item.is_holiday);
                  return (
                    <section
                      key={day.dow}
                      className={`menu-plan-mobile-day ${holiday ? "is-holiday" : ""}`}
                    >
                      <div className="menu-plan-mobile-day-head">
                        <div>
                          <strong>{day.label}</strong>
                          <span>{planDate ? formatDateShort(planDate) : "-"}</span>
                        </div>
                        <div className="menu-plan-mobile-day-tools">
                          {holiday ? (
                            <span className="menu-plan-day-holiday-badge">
                              <AppIcon
                                name="statusHoliday"
                                size={12}
                                weight={APP_ICON_WEIGHT.action}
                              />
                              LIBUR
                            </span>
                          ) : null}
                          <button
                            type="button"
                            className="menu-plan-copy-btn"
                            onClick={async () => {
                              const text = formatDayMenuForCopy(plan, day.dow);
                              const ok = await copyTextToClipboard(text);
                              if (onCopyDay) {
                                onCopyDay({
                                  ok,
                                  text,
                                  dayLabel: day.label,
                                  planDate,
                                });
                              }
                            }}
                            aria-label={`Salin menu ${day.label}`}
                          >
                            <AppIcon name="copy" size={12} weight={APP_ICON_WEIGHT.action} />
                            <span>Salin</span>
                          </button>
                        </div>
                      </div>
                      {holiday ? null : (
                        <dl className="menu-plan-mobile-day-body">
                          {MENU_PLAN_CATEGORIES.map((cat) => {
                            const cellItems = grouped.get(`${day.dow}|${cat.key}`) || [];
                            const isHolidayCell = isCellHoliday(cellItems);
                            const visible = cellItems.filter(
                              (item) => item.menu_name && !item.is_holiday
                            );
                            return (
                              <div className="menu-plan-mobile-day-row" key={cat.key}>
                                <dt>{cat.label}</dt>
                                <dd>
                                  {isHolidayCell ? (
                                    <span className="muted">Libur</span>
                                  ) : visible.length === 0 ? (
                                    <span className="muted">-</span>
                                  ) : (
                                    <ul className="menu-plan-day-entries">
                                      {visible.map((item, i) => (
                                        <li key={`${item.menu_name}-${i}`}>
                                          <span>{item.menu_name}</span>
                                          {item.portion_target &&
                                          item.portion_target !== "all" ? (
                                            <em
                                              className={`menu-plan-portion-tag tag-${item.portion_target.toLowerCase()}`}
                                            >
                                              {item.portion_target}
                                            </em>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      )}
                    </section>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      <div className="data-table-wrap desktop-data-table">
      <table className="data-table menu-plan-daily-table">
        <thead>
          <tr>
            <th>Periode</th>
            <th>Hari / Tanggal</th>
            {MENU_PLAN_CATEGORIES.map((cat) => (
              <th key={cat.key}>{cat.label}</th>
            ))}
            <th className="data-table-actions">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowKey} className={row.holiday ? "is-holiday" : ""}>
              {row.dayIndex === 0 ? (
                <th
                  scope="rowgroup"
                  rowSpan={MENU_PLAN_DAYS.length}
                  className="menu-plan-period-cell"
                >
                  <strong>
                    {monthLabel(row.plan.month)} {row.plan.year}
                  </strong>
                  <span>Minggu ke-{row.plan.week_number}</span>
                  <span className="muted">
                    {formatDateShort(row.plan.start_date)} -{" "}
                    {formatDateShort(row.plan.end_date)}
                  </span>
                </th>
              ) : null}
              <td className="menu-plan-day-cell">
                <div className="menu-plan-day-cell-head">
                  <div>
                    <strong>{row.dayLabel}</strong>
                    <span>{row.planDate ? formatDateShort(row.planDate) : "-"}</span>
                  </div>
                  <button
                    type="button"
                    className="menu-plan-copy-btn"
                    onClick={async () => {
                      const text = formatDayMenuForCopy(row.plan, row.dow);
                      const ok = await copyTextToClipboard(text);
                      if (onCopyDay) {
                        onCopyDay({
                          ok,
                          text,
                          dayLabel: row.dayLabel,
                          planDate: row.planDate,
                        });
                      }
                    }}
                    aria-label={`Salin menu ${row.dayLabel} ke clipboard`}
                    title={`Salin menu ${row.dayLabel}`}
                  >
                    <AppIcon name="copy" size={14} weight={APP_ICON_WEIGHT.action} />
                    <span>Salin</span>
                  </button>
                </div>
              </td>
              {row.cells.map((cell) => (
                <td
                  key={cell.category}
                  className={isCellHoliday(cell.items) ? "is-holiday" : ""}
                >
                  {row.holiday || isCellHoliday(cell.items) ? (
                    <span className="muted">Libur</span>
                  ) : (
                    <CellEntries items={cell.items} />
                  )}
                </td>
              ))}
              {row.dayIndex === 0 ? (
                <td
                  rowSpan={MENU_PLAN_DAYS.length}
                  className="data-table-actions menu-plan-actions-cell"
                >
                  <div className="menu-plan-actions-stack">
                    <button
                      type="button"
                      className="menu-plan-action-btn"
                      onClick={() => onView(row.plan)}
                      aria-label={`Lihat detail rencana ${monthLabel(row.plan.month)} ${row.plan.year} minggu ke-${row.plan.week_number}`}
                    >
                      <AppIcon name="view" size={16} weight={APP_ICON_WEIGHT.action} />
                      <span>Lihat</span>
                    </button>
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="menu-plan-action-btn"
                          onClick={() => onEdit(row.plan)}
                          aria-label={`Ubah rencana ${monthLabel(row.plan.month)} ${row.plan.year}`}
                        >
                          <AppIcon name="edit" size={16} weight={APP_ICON_WEIGHT.action} />
                          <span>Ubah</span>
                        </button>
                        <button
                          type="button"
                          className="menu-plan-action-btn menu-plan-action-btn-danger"
                          onClick={() => onDelete(row.plan)}
                          aria-label={`Hapus rencana ${monthLabel(row.plan.month)} ${row.plan.year}`}
                        >
                          <AppIcon name="delete" size={16} weight={APP_ICON_WEIGHT.action} />
                          <span>Hapus</span>
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

export { CATEGORY_LOOKUP };
