import pool from "../config/db.js";

// GET /api/units — list active units ordered by display_order
export async function getAllUnits(req, res, next) {
  try {
    const [[groupCount]] = await pool.query(
      `SELECT COUNT(*) AS total FROM beneficiary_groups`
    );
    const usingBeneficiaryGroups = Number(groupCount.total || 0) > 0;
    const [rows] = await pool.query(
      `SELECT u.id, u.beneficiary_group_id, u.name, u.category, u.default_target, u.display_order,
              COALESCE(bg.student_small_portion, 0) AS student_small_portion,
              COALESCE(bg.student_large_portion, 0) AS student_large_portion,
              COALESCE(bg.staff_small_portion, 0) AS staff_small_portion,
              COALESCE(bg.staff_large_portion, 0) AS staff_large_portion,
              (
                COALESCE(bg.student_small_portion, 0) +
                COALESCE(bg.staff_small_portion, 0)
              ) AS small_target,
              (
                COALESCE(bg.student_large_portion, 0) +
                COALESCE(bg.staff_large_portion, 0)
              ) AS large_target
         FROM units u
         LEFT JOIN beneficiary_groups bg ON bg.id = u.beneficiary_group_id
        WHERE u.is_active = 1
          ${usingBeneficiaryGroups ? "AND u.beneficiary_group_id IS NOT NULL" : ""}
        ORDER BY u.display_order ASC, u.id ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}
