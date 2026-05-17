import pool from "../../config/db.js";

const CATEGORY_LABEL = {
  "PAUD/TK/KB": "Siswa TK/PAUD/RA",
  SD: "Siswa SD/MI",
  SMP: "Siswa SMP/MTs",
  SMK: "Siswa SMA/MA/SMK",
};

function isoToDate(iso) {
  return new Date(`${iso}T00:00:00`);
}

function dateToIso(date) {
  const tz = date.getTimezoneOffset();
  const local = new Date(date.getTime() - tz * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function expandDateRange(startIso, endIso) {
  const start = isoToDate(startIso);
  const end = isoToDate(endIso);
  const dates = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86400000)) {
    dates.push(dateToIso(cursor));
  }
  return dates;
}

export async function collectWeeklyReportData({ startDate, endDate }) {
  const [units] = await pool.query(
    `SELECT u.id, u.name, u.address, u.category, u.default_target, u.display_order, u.is_active,
            bg.student_small_portion, bg.student_large_portion,
            bg.staff_small_portion, bg.staff_large_portion
       FROM units u
       LEFT JOIN beneficiary_groups bg ON bg.id = u.beneficiary_group_id
      WHERE u.is_active = 1
      ORDER BY u.display_order ASC, u.id ASC`
  );

  const [dailyReports] = await pool.query(
    `SELECT id, report_date FROM daily_reports
      WHERE report_date >= ? AND report_date <= ?
      ORDER BY report_date ASC`,
    [startDate, endDate]
  );

  const reportIds = dailyReports.map((row) => row.id);
  let detailsByReport = new Map();
  if (reportIds.length > 0) {
    const [details] = await pool.query(
      `SELECT d.report_id, d.unit_id, d.actual_pm, d.service_status,
              d.actual_small_portion, d.actual_large_portion,
              u.name AS unit_name, u.address AS unit_address, u.category, u.display_order
         FROM daily_report_details d
         JOIN units u ON u.id = d.unit_id
        WHERE d.report_id IN (?)
        ORDER BY u.display_order ASC, u.id ASC`,
      [reportIds]
    );
    details.forEach((detail) => {
      if (!detailsByReport.has(detail.report_id)) {
        detailsByReport.set(detail.report_id, []);
      }
      detailsByReport.get(detail.report_id).push(detail);
    });
  }

  const dailyByDate = new Map();
  dailyReports.forEach((row) => {
    const iso = typeof row.report_date === "string"
      ? row.report_date
      : dateToIso(new Date(row.report_date));
    dailyByDate.set(iso, {
      report_id: row.id,
      report_date: iso,
      details: detailsByReport.get(row.id) || [],
    });
  });

  const [menuRows] = await pool.query(
    `SELECT id, menu_date,
            COALESCE(NULLIF(menu_name, ''), TRIM(CONCAT_WS(', ',
              NULLIF(menu_name_1, ''),
              NULLIF(menu_name_2, ''),
              NULLIF(menu_name_3, ''),
              NULLIF(menu_name_4, ''),
              NULLIF(menu_name_5, '')
            ))) AS menu_name,
            menu_name_1, menu_name_2, menu_name_3, menu_name_4, menu_name_5,
            COALESCE(small_energy, 0) AS small_energy,
            COALESCE(small_protein, 0) AS small_protein,
            COALESCE(small_fat, 0) AS small_fat,
            COALESCE(small_carbohydrate, 0) AS small_carbohydrate,
            COALESCE(large_energy, 0) AS large_energy,
            COALESCE(large_protein, 0) AS large_protein,
            COALESCE(large_fat, 0) AS large_fat,
            COALESCE(large_carbohydrate, 0) AS large_carbohydrate
       FROM menu_reports
      WHERE menu_date >= ? AND menu_date <= ?
      ORDER BY menu_date ASC, id ASC`,
    [startDate, endDate]
  );

  const menuByDate = new Map();
  menuRows.forEach((row) => {
    const iso = typeof row.menu_date === "string" ? row.menu_date : dateToIso(new Date(row.menu_date));
    menuByDate.set(iso, { ...row, menu_date: iso });
  });

  const targetByCategory = units.reduce(
    (acc, unit) => {
      const total =
        Number(unit.student_small_portion || 0) +
        Number(unit.student_large_portion || 0) +
        Number(unit.staff_small_portion || 0) +
        Number(unit.staff_large_portion || 0);
      const key = unit.category;
      acc[key] = (acc[key] || 0) + (total || Number(unit.default_target || 0));
      return acc;
    },
    {}
  );

  const totalTarget = Object.values(targetByCategory).reduce((sum, value) => sum + value, 0);

  const dates = expandDateRange(startDate, endDate);

  const dailyTables = dates.map((iso) => {
    const entry = dailyByDate.get(iso);
    if (!entry) {
      return {
        date: iso,
        total_pm: 0,
        rows: units.map((unit) => ({
          unit_id: unit.id,
          unit_name: unit.name,
          unit_address: unit.address || "",
          category: unit.category,
          actual_pm: 0,
          service_status: "libur",
        })),
      };
    }

    const detailMap = new Map(entry.details.map((d) => [d.unit_id, d]));
    let totalPm = 0;
    const rows = units.map((unit) => {
      const d = detailMap.get(unit.id);
      const actualPm = Number(d?.actual_pm || 0);
      totalPm += actualPm;
      return {
        unit_id: unit.id,
        unit_name: unit.name,
        unit_address: unit.address || "",
        category: unit.category,
        actual_pm: actualPm,
        service_status: d?.service_status || "libur",
      };
    });

    return { date: iso, total_pm: totalPm, rows };
  });

  return {
    range: { start_date: startDate, end_date: endDate },
    units,
    targetByCategory,
    totalTarget,
    categoryLabel: CATEGORY_LABEL,
    dates,
    dailyTables,
    menuByDate,
  };
}
