import ActionIconButton from "./ActionIconButton.jsx";
import LoadingMessage from "./LoadingMessage.jsx";
import { formatDate, formatDateTime } from "../shared/utils/formatters.js";

export default function DailyReportTable({
  reports,
  loading,
  onView,
  onEdit,
  onDelete,
  canManage = true,
}) {
  if (loading) {
    return <LoadingMessage>Memuat riwayat laporan...</LoadingMessage>;
  }

  if (!reports.length) {
    return (
      <div className="empty-state rounded-2xl px-4 py-8">
        Belum ada laporan harian yang tersimpan.
      </div>
    );
  }

  return (
    <>
      <div className="mobile-data-list daily-report-mobile-list">
        {reports.map((report, index) => {
          const isHolidayReport = Number(report.total_pm || 0) === 0;
          return (
          <article
            className={`mobile-data-card daily-report-mobile-card ${isHolidayReport ? "daily-report-holiday-card" : ""}`}
            key={report.id}
          >
            <div className="mobile-data-card-head">
              <div>
                <div className="mobile-data-card-title">{formatDate(report.report_date)}</div>
                <div className="mobile-data-card-subtitle">
                  Diperbarui {formatDateTime(report.updated_at)}
                </div>
              </div>
              <span className="table-index-badge">{index + 1}</span>
            </div>
            {isHolidayReport ? <div className="daily-report-holiday-note">Tidak ada pelayanan</div> : null}
            <div className="mobile-metric-grid daily-report-mobile-metrics">
              <div className="mobile-metric">
                <span>Porsi kecil</span>
                <strong>{Number(report.total_small_portion || 0).toLocaleString("id-ID")}</strong>
              </div>
              <div className="mobile-metric">
                <span>Porsi besar</span>
                <strong>{Number(report.total_large_portion || 0).toLocaleString("id-ID")}</strong>
              </div>
              <div className="mobile-metric mobile-metric-emphasis">
                <span>Total PM</span>
                <strong>{Number(report.total_pm || 0).toLocaleString("id-ID")}</strong>
              </div>
            </div>
            <div className="table-actions mobile-table-actions">
              <ActionIconButton action="view" label="Lihat" onClick={() => onView(report)} />
              {canManage ? (
                <>
                  <ActionIconButton action="edit" label="Edit" onClick={() => onEdit(report.report_date)} />
                  <ActionIconButton action="delete" label="Hapus" onClick={() => onDelete(report)} />
                </>
              ) : null}
            </div>
          </article>
          );
        })}
      </div>

      <div className="data-table-scroll-shell scroll-affordance desktop-data-table" data-scroll-hint="Geser tabel">
        <div className="table-wrap overflow-x-auto rounded-2xl">
          <table className="data-table daily-report-table min-w-[1080px]">
            <thead>
              <tr>
                <th className="col-no text-center" rowSpan="2">No</th>
                <th className="col-date text-left" rowSpan="2">Tanggal Laporan</th>
                <th className="col-group daily-group-head" colSpan="3">
                  Ringkasan Porsi dan PM
                </th>
                <th className="col-updated text-left" rowSpan="2">Diperbarui</th>
                <th className="col-actions text-center" rowSpan="2">Aksi</th>
              </tr>
              <tr>
                <th className="col-portion col-portion-small text-right">
                  Porsi Kecil
                </th>
                <th className="col-portion col-portion-large text-right">
                  Porsi Besar
                </th>
                <th className="col-total text-right">Total PM</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report, index) => {
                const isHolidayReport = Number(report.total_pm || 0) === 0;
                return (
                <tr key={report.id} className={isHolidayReport ? "daily-report-holiday-row" : ""}>
                  <td className="col-no text-center">
                    <span className="table-index-badge">{index + 1}</span>
                  </td>
                  <td className="col-date text-left">{formatDate(report.report_date)}</td>
                  <td className="col-portion col-portion-small text-right">
                    {Number(report.total_small_portion || 0).toLocaleString("id-ID")}
                  </td>
                  <td className="col-portion col-portion-large text-right">
                    {Number(report.total_large_portion || 0).toLocaleString("id-ID")}
                  </td>
                  <td className="col-total text-right">
                    {Number(report.total_pm || 0).toLocaleString("id-ID")}
                  </td>
                  <td className="col-updated text-left">{formatDateTime(report.updated_at)}</td>
                  <td className="col-actions text-center">
                    <div className="table-actions">
                      <ActionIconButton action="view" label="Lihat" onClick={() => onView(report)} />
                      {canManage ? (
                        <>
                          <ActionIconButton action="edit" label="Edit" onClick={() => onEdit(report.report_date)} />
                          <ActionIconButton action="delete" label="Hapus" onClick={() => onDelete(report)} />
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
