import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";
import { formatDateShort } from "../shared/utils/formatters.js";
import { monthLabel } from "../shared/utils/menuPlanHelpers.js";

export default function MenuPlanTable({
  plans,
  loading,
  onView,
  onEdit,
  onDelete,
  canManage,
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

  return (
    <>
      <div className="mobile-data-list menu-plan-mobile-list">
        {plans.map((plan) => (
          <article className="mobile-data-card menu-plan-mobile-card" key={plan.id}>
            <header className="menu-plan-mobile-card-head">
              <div>
                <strong>{monthLabel(plan.month)} {plan.year}</strong>
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
            {plan.notes ? (
              <p className="menu-plan-mobile-notes">{plan.notes}</p>
            ) : null}
          </article>
        ))}
      </div>

      <div className="data-table-wrap desktop-data-table">
      <table className="data-table menu-plan-table">
        <thead>
          <tr>
            <th>Periode</th>
            <th>Minggu</th>
            <th>Rentang Tanggal</th>
            <th>Catatan</th>
            <th className="data-table-actions">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id}>
              <td>
                <strong>{monthLabel(plan.month)} {plan.year}</strong>
              </td>
              <td>Minggu ke-{plan.week_number}</td>
              <td>
                {formatDateShort(plan.start_date)} - {formatDateShort(plan.end_date)}
              </td>
              <td className="data-cell-truncate">
                {plan.notes ? plan.notes : <span className="muted">-</span>}
              </td>
              <td className="data-table-actions">
                <div className="menu-plan-actions-stack menu-plan-actions-inline">
                  <button
                    type="button"
                    className="menu-plan-action-btn"
                    onClick={() => onView(plan)}
                    aria-label="Lihat rencana menu"
                  >
                    <AppIcon name="view" size={16} weight={APP_ICON_WEIGHT.action} />
                    <span>Lihat</span>
                  </button>
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className="menu-plan-action-btn"
                        onClick={() => onEdit(plan)}
                        aria-label="Ubah rencana menu"
                      >
                        <AppIcon name="edit" size={16} weight={APP_ICON_WEIGHT.action} />
                        <span>Ubah</span>
                      </button>
                      <button
                        type="button"
                        className="menu-plan-action-btn menu-plan-action-btn-danger"
                        onClick={() => onDelete(plan)}
                        aria-label="Hapus rencana menu"
                      >
                        <AppIcon name="delete" size={16} weight={APP_ICON_WEIGHT.action} />
                        <span>Hapus</span>
                      </button>
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
