import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";
import { REPORT_CATEGORY_ORDER as CATEGORY_ORDER } from "../shared/constants/reportConstants.js";
import { formatDateLong } from "../shared/utils/formatters.js";

function formatStatus(value) {
  if (value === "penuh") return "Dilayani penuh";
  if (value === "libur") return "Libur";
  if (value === "sebagian") return "Dilayani sebagian";
  return value || "-";
}

function getStatusTone(value) {
  if (value === "penuh") return "full";
  if (value === "sebagian") return "partial";
  if (value === "libur") return "holiday";
  return "neutral";
}

function getStatusIcon(value) {
  if (value === "penuh") return "statusFull";
  if (value === "sebagian") return "statusPartial";
  if (value === "libur") return "statusHoliday";
  return "history";
}

function scaleActualPortions(detail) {
  const savedSplitTotal =
    Number(detail.actual_small_portion ?? 0) + Number(detail.actual_large_portion ?? 0);

  if (savedSplitTotal <= 0 && Number(detail.actual_pm || 0) > 0) {
    const portions = [
      { key: "studentSmall", value: Number(detail.student_small_portion || 0) },
      { key: "studentLarge", value: Number(detail.student_large_portion || 0) },
      { key: "staffSmall", value: Number(detail.staff_small_portion || 0) },
      { key: "staffLarge", value: Number(detail.staff_large_portion || 0) },
    ];
    const targetPm = Number(detail.target_pm || 0);
    const actualPm = Number(detail.actual_pm || 0);
    const totalConfigured = portions.reduce((sum, item) => sum + item.value, 0);
    const divisor = targetPm > 0 ? targetPm : totalConfigured;

    if (actualPm <= 0 || divisor <= 0) {
      return {
        studentSmall: 0,
        studentLarge: 0,
        staffSmall: 0,
        staffLarge: 0,
      };
    }

    const scaledFallback = portions.map((item) => {
      const raw = (item.value / divisor) * actualPm;
      const floored = Math.floor(raw);
      return {
        key: item.key,
        value: floored,
        fraction: raw - floored,
      };
    });

    let remainder = actualPm - scaledFallback.reduce((sum, item) => sum + item.value, 0);
    scaledFallback
      .sort((a, b) => b.fraction - a.fraction)
      .forEach((item) => {
        if (remainder <= 0) return;
        item.value += 1;
        remainder -= 1;
      });

    return scaledFallback.reduce(
      (acc, item) => ({
        ...acc,
        [item.key]: item.value,
      }),
      {
        studentSmall: 0,
        studentLarge: 0,
        staffSmall: 0,
        staffLarge: 0,
      }
    );
  }

  const splitBuckets = [
    {
      key: "studentSmall",
      value: Number(detail.student_small_portion || 0),
      bucketActual: Number(detail.actual_small_portion ?? 0),
      bucketTarget:
        Number(detail.student_small_portion || 0) +
        Number(detail.staff_small_portion || 0),
    },
    {
      key: "staffSmall",
      value: Number(detail.staff_small_portion || 0),
      bucketActual: Number(detail.actual_small_portion ?? 0),
      bucketTarget:
        Number(detail.student_small_portion || 0) +
        Number(detail.staff_small_portion || 0),
    },
    {
      key: "studentLarge",
      value: Number(detail.student_large_portion || 0),
      bucketActual: Number(detail.actual_large_portion ?? 0),
      bucketTarget:
        Number(detail.student_large_portion || 0) +
        Number(detail.staff_large_portion || 0),
    },
    {
      key: "staffLarge",
      value: Number(detail.staff_large_portion || 0),
      bucketActual: Number(detail.actual_large_portion ?? 0),
      bucketTarget:
        Number(detail.student_large_portion || 0) +
        Number(detail.staff_large_portion || 0),
    },
  ];

  const scaled = splitBuckets.map((item) => {
    if (item.bucketActual <= 0 || item.bucketTarget <= 0 || item.value <= 0) {
      return { key: item.key, value: 0, fraction: 0, bucketActual: 0 };
    }

    const raw = (item.value / item.bucketTarget) * item.bucketActual;
    const floored = Math.floor(raw);
    return {
      key: item.key,
      value: floored,
      fraction: raw - floored,
      bucketActual: item.bucketActual,
    };
  });

  const remainders = [
    Number(detail.actual_small_portion ?? 0) -
      scaled
        .filter((item) => item.key === "studentSmall" || item.key === "staffSmall")
        .reduce((sum, item) => sum + item.value, 0),
    Number(detail.actual_large_portion ?? 0) -
      scaled
        .filter((item) => item.key === "studentLarge" || item.key === "staffLarge")
        .reduce((sum, item) => sum + item.value, 0),
  ];

  [
    ["studentSmall", "staffSmall"],
    ["studentLarge", "staffLarge"],
  ].forEach((groupKeys, groupIndex) => {
    let remainder = remainders[groupIndex];
    scaled
      .filter((item) => groupKeys.includes(item.key))
      .sort((a, b) => b.fraction - a.fraction)
      .forEach((item) => {
        if (remainder <= 0) return;
        item.value += 1;
        remainder -= 1;
      });
  });

  return scaled.reduce(
    (acc, item) => ({
      ...acc,
      [item.key]: item.value,
    }),
    {
      studentSmall: 0,
      studentLarge: 0,
      staffSmall: 0,
      staffLarge: 0,
    }
  );
}

export default function DailyReportDetailModal({ report, onClose }) {
  if (!report) return null;

  const portionSummary = (report.details || []).reduce(
    (acc, detail) => {
      const scaled = scaleActualPortions(detail);
      return {
        studentSmall: acc.studentSmall + scaled.studentSmall,
        studentLarge: acc.studentLarge + scaled.studentLarge,
        staffSmall: acc.staffSmall + scaled.staffSmall,
        staffLarge: acc.staffLarge + scaled.staffLarge,
      };
    },
    {
      studentSmall: 0,
      studentLarge: 0,
      staffSmall: 0,
      staffLarge: 0,
    }
  );

  const groupedDetails = CATEGORY_ORDER.map((category) => ({
    category,
    items: (report.details || []).filter((detail) => detail.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="modal-backdrop p-3 sm:p-4" role="presentation">
      <div
        className="modal-card report-modal-card w-full max-w-5xl rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="daily-detail-shell">
          <div className="daily-detail-hero">
            <div className="daily-detail-hero-main">
              <div className="daily-detail-hero-icon">
                <AppIcon name="daily" size={24} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="daily-detail-hero-copy">
                <span className="daily-detail-eyebrow">Detail laporan harian</span>
                <h3>{formatDateLong(report.report_date)}</h3>
                <p>Lihat rincian pelayanan, status unit, dan distribusi porsi untuk tanggal ini.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="daily-detail-close-btn">
              Tutup
            </button>
          </div>

          <div className="daily-detail-summary-grid">
            <div className="daily-detail-summary-card">
              <div className="daily-detail-summary-icon tone-blue">
                <AppIcon name="beneficiaries" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="daily-detail-summary-copy">
                <span>Total PM</span>
                <strong>{Number(report.total_pm || 0).toLocaleString("id-ID")}</strong>
              </div>
            </div>
            <div className="daily-detail-summary-card">
              <div className="daily-detail-summary-icon tone-violet">
                <AppIcon name="database" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="daily-detail-summary-copy">
                <span>Jumlah kelompok</span>
                <strong>{Number(report.details?.length || 0).toLocaleString("id-ID")}</strong>
              </div>
            </div>
            <div className="daily-detail-summary-card">
              <div className="daily-detail-summary-icon tone-amber">
                <AppIcon name="menu" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="daily-detail-summary-copy">
                <span>Porsi kecil</span>
                <strong>
                  {(portionSummary.studentSmall + portionSummary.staffSmall).toLocaleString("id-ID")}
                </strong>
                <small>
                  Siswa {portionSummary.studentSmall.toLocaleString("id-ID")} • Guru/Tendik{" "}
                  {portionSummary.staffSmall.toLocaleString("id-ID")}
                </small>
              </div>
            </div>
            <div className="daily-detail-summary-card">
              <div className="daily-detail-summary-icon tone-emerald">
                <AppIcon name="package" size={22} weight={APP_ICON_WEIGHT.summary} />
              </div>
              <div className="daily-detail-summary-copy">
                <span>Porsi besar</span>
                <strong>
                  {(portionSummary.studentLarge + portionSummary.staffLarge).toLocaleString("id-ID")}
                </strong>
                <small>
                  Siswa {portionSummary.studentLarge.toLocaleString("id-ID")} • Guru/Tendik{" "}
                  {portionSummary.staffLarge.toLocaleString("id-ID")}
                </small>
              </div>
            </div>
          </div>

          <div className="daily-detail-content">
            {groupedDetails.map((group) => (
              <section key={group.category} className="daily-detail-group">
                <div className="daily-detail-group-head">
                  <div>
                    <span className="daily-detail-group-kicker">Kategori</span>
                    <h4>{group.category}</h4>
                  </div>
                  <span className="daily-detail-group-count">{group.items.length} unit</span>
                </div>

                <div className="daily-detail-mobile-list">
                  {group.items.map((detail, index) => (
                    <article
                      key={detail.id || `${group.category}-${detail.unit_id}-mobile`}
                      className="daily-detail-mobile-card"
                    >
                      <div className="daily-detail-mobile-top">
                        <span className="table-index-badge">{index + 1}</span>
                        <span
                          className={`daily-detail-status-badge tone-${getStatusTone(detail.service_status)}`}
                        >
                          <AppIcon
                            name={getStatusIcon(detail.service_status)}
                            size={14}
                            weight={APP_ICON_WEIGHT.action}
                          />
                          {formatStatus(detail.service_status)}
                        </span>
                      </div>
                      <strong className="daily-detail-mobile-title">{detail.unit_name}</strong>
                      <div className="daily-detail-mobile-metrics">
                        <div>
                          <span>Target</span>
                          <strong>{Number(detail.target_pm || 0).toLocaleString("id-ID")}</strong>
                        </div>
                        <div>
                          <span>Aktual</span>
                          <strong>{Number(detail.actual_pm || 0).toLocaleString("id-ID")}</strong>
                        </div>
                        <div>
                          <span>Selisih</span>
                          <strong>
                            {(
                              Number(detail.actual_pm || 0) - Number(detail.target_pm || 0)
                            ).toLocaleString("id-ID")}
                          </strong>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="table-wrap overflow-x-auto rounded-2xl daily-detail-table-shell">
                  <table className="data-table daily-detail-table">
                    <thead>
                      <tr>
                        <th className="text-center daily-detail-col-no">No</th>
                        <th className="text-left daily-detail-col-name">Nama Kelompok</th>
                        <th className="text-right daily-detail-col-target">Target</th>
                        <th className="text-center daily-detail-col-status">Status</th>
                        <th className="text-right daily-detail-col-actual">Aktual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((detail, index) => (
                        <tr key={detail.id || `${group.category}-${detail.unit_id}`}>
                          <td className="text-center daily-detail-col-no">
                            <span className="table-index-badge">{index + 1}</span>
                          </td>
                          <td className="text-left daily-detail-col-name">
                            <span className="daily-detail-unit-name">{detail.unit_name}</span>
                          </td>
                          <td className="text-right daily-detail-col-target">
                            {Number(detail.target_pm || 0).toLocaleString("id-ID")}
                          </td>
                          <td className="text-center daily-detail-col-status">
                            <span
                              className={`daily-detail-status-badge tone-${getStatusTone(detail.service_status)}`}
                            >
                              <AppIcon
                                name={getStatusIcon(detail.service_status)}
                                size={14}
                                weight={APP_ICON_WEIGHT.action}
                              />
                              {formatStatus(detail.service_status)}
                            </span>
                          </td>
                          <td className="text-right daily-detail-col-actual">
                            {Number(detail.actual_pm || 0).toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
