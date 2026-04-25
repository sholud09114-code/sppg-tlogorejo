import { REPORT_CATEGORY_ORDER as CATEGORY_ORDER } from "../shared/constants/reportConstants.js";
import { formatDateLong } from "../shared/utils/formatters.js";

function formatStatus(value) {
  if (value === "penuh") return "Dilayani penuh";
  if (value === "libur") return "Libur";
  if (value === "sebagian") return "Dilayani sebagian";
  return value || "-";
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
        <div className="modal-header">
          <div className="min-w-0 flex-1">
            <h3>Detail laporan harian</h3>
            <p>Lihat rincian pelayanan untuk tanggal laporan yang dipilih.</p>
          </div>
          <div className="page-actions page-actions-stack w-full sm:w-auto">
            <div className="summary-card rounded-2xl p-4 sm:p-5">
              <span className="summary-card-label">Tanggal laporan</span>
              <strong>{formatDateLong(report.report_date)}</strong>
            </div>
            <button type="button" onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
          <div className="summary-card rounded-2xl p-4 sm:p-5">
            <span className="summary-card-label">Total PM</span>
            <strong>{Number(report.total_pm || 0).toLocaleString("id-ID")}</strong>
          </div>
          <div className="summary-card rounded-2xl p-4 sm:p-5">
            <span className="summary-card-label">Jumlah kelompok</span>
            <strong>{Number(report.details?.length || 0).toLocaleString("id-ID")}</strong>
          </div>
        </div>

        <div className="mx-auto mt-3 grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
          <div className="summary-card rounded-2xl p-4 sm:p-5">
            <span className="summary-card-label">Porsi Kecil</span>
            <strong>
              {(portionSummary.studentSmall + portionSummary.staffSmall).toLocaleString("id-ID")}
            </strong>
            <div className="mt-2 text-sm text-[#5f5e5a]">
              Siswa: {portionSummary.studentSmall.toLocaleString("id-ID")} | Guru/Tendik:{" "}
              {portionSummary.staffSmall.toLocaleString("id-ID")}
            </div>
          </div>
          <div className="summary-card rounded-2xl p-4 sm:p-5">
            <span className="summary-card-label">Porsi Besar</span>
            <strong>
              {(portionSummary.studentLarge + portionSummary.staffLarge).toLocaleString("id-ID")}
            </strong>
            <div className="mt-2 text-sm text-[#5f5e5a]">
              Siswa: {portionSummary.studentLarge.toLocaleString("id-ID")} | Guru/Tendik:{" "}
              {portionSummary.staffLarge.toLocaleString("id-ID")}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4 overflow-auto pr-1">
          {groupedDetails.map((group) => (
            <section key={group.category} className="space-y-2">
              <div className="category-header">
                <span className="cat-title">{group.category}</span>
                <span className="cat-count">{group.items.length} unit</span>
              </div>

              <div className="table-wrap overflow-x-auto rounded-2xl">
                <table className="data-table min-w-[720px]">
                  <thead>
                    <tr>
                      <th className="text-center">No</th>
                      <th className="text-left">Nama Kelompok</th>
                      <th className="text-right">Target</th>
                      <th className="text-center">Status</th>
                      <th className="text-right">Aktual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((detail, index) => (
                      <tr key={detail.id || `${group.category}-${detail.unit_id}`}>
                        <td className="text-center">{index + 1}</td>
                        <td className="text-left">{detail.unit_name}</td>
                        <td className="text-right">{Number(detail.target_pm || 0).toLocaleString("id-ID")}</td>
                        <td className="text-center">{formatStatus(detail.service_status)}</td>
                        <td className="text-right">{Number(detail.actual_pm || 0).toLocaleString("id-ID")}</td>
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
  );
}
