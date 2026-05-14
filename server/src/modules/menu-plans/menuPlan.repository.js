import pool from "../../config/db.js";

let ensureMenuPlansTablePromise;

export function ensureMenuPlansTables() {
  if (!ensureMenuPlansTablePromise) {
    ensureMenuPlansTablePromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS menu_plans (
          id INT AUTO_INCREMENT PRIMARY KEY,
          year SMALLINT NOT NULL,
          month TINYINT NOT NULL,
          week_number TINYINT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_menu_plans_year_month_week (year, month, week_number),
          INDEX idx_menu_plans_start_date (start_date),
          INDEX idx_menu_plans_updated_at (updated_at)
        ) ENGINE=InnoDB`
      );

      await pool.query(
        `CREATE TABLE IF NOT EXISTS menu_plan_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          plan_id INT NOT NULL,
          plan_date DATE NOT NULL,
          day_of_week TINYINT NOT NULL,
          category ENUM(
            'karbohidrat',
            'protein_hewani',
            'protein_nabati',
            'sayur',
            'buah'
          ) NOT NULL,
          menu_name VARCHAR(200) NOT NULL,
          portion_target ENUM('all', 'PMB', 'PMK') NOT NULL DEFAULT 'all',
          is_holiday TINYINT(1) NOT NULL DEFAULT 0,
          sort_order TINYINT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_menu_plan_items_plan
            FOREIGN KEY (plan_id) REFERENCES menu_plans(id) ON DELETE CASCADE,
          INDEX idx_menu_plan_items_plan (plan_id),
          INDEX idx_menu_plan_items_date (plan_date),
          INDEX idx_menu_plan_items_category (plan_id, category),
          INDEX idx_menu_plan_items_day (plan_id, day_of_week)
        ) ENGINE=InnoDB`
      );
    })().catch((err) => {
      ensureMenuPlansTablePromise = null;
      throw err;
    });
  }
  return ensureMenuPlansTablePromise;
}

export async function listMenuPlanRows({ year, month } = {}) {
  await ensureMenuPlansTables();
  const conditions = [];
  const params = [];
  if (year != null) {
    conditions.push("year = ?");
    params.push(year);
  }
  if (month != null) {
    conditions.push("month = ?");
    params.push(month);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT id, year, month, week_number, start_date, end_date, notes,
            created_at, updated_at
       FROM menu_plans
       ${whereClause}
       ORDER BY year DESC, month DESC, week_number DESC`,
    params
  );
  return rows;
}

export async function findMenuPlanById(id) {
  await ensureMenuPlansTables();
  const [rows] = await pool.query(
    `SELECT id, year, month, week_number, start_date, end_date, notes,
            created_at, updated_at
       FROM menu_plans WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function findMenuPlanByYearMonthWeek(year, month, weekNumber) {
  await ensureMenuPlansTables();
  const [rows] = await pool.query(
    `SELECT id FROM menu_plans
       WHERE year = ? AND month = ? AND week_number = ? LIMIT 1`,
    [year, month, weekNumber]
  );
  return rows[0] || null;
}

export async function findMenuPlanItemsByPlanId(planId) {
  await ensureMenuPlansTables();
  const [rows] = await pool.query(
    `SELECT id, plan_id, plan_date, day_of_week, category, menu_name,
            portion_target, is_holiday, sort_order
       FROM menu_plan_items
       WHERE plan_id = ?
       ORDER BY day_of_week ASC, category ASC, sort_order ASC, id ASC`,
    [planId]
  );
  return rows;
}

export async function findMenuPlanItemsByPlanIds(planIds) {
  await ensureMenuPlansTables();
  if (!Array.isArray(planIds) || planIds.length === 0) return [];
  const placeholders = planIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT id, plan_id, plan_date, day_of_week, category, menu_name,
            portion_target, is_holiday, sort_order
       FROM menu_plan_items
       WHERE plan_id IN (${placeholders})
       ORDER BY plan_id ASC, day_of_week ASC, category ASC, sort_order ASC, id ASC`,
    planIds
  );
  return rows;
}

export async function findMenuPlanItemsByDate(planDate) {
  await ensureMenuPlansTables();
  const [rows] = await pool.query(
    `SELECT mpi.id, mpi.plan_id, mpi.plan_date, mpi.day_of_week, mpi.category,
            mpi.menu_name, mpi.portion_target, mpi.is_holiday, mpi.sort_order
       FROM menu_plan_items mpi
       WHERE mpi.plan_date = ?
       ORDER BY mpi.category ASC, mpi.sort_order ASC, mpi.id ASC`,
    [planDate]
  );
  return rows;
}

async function insertMenuPlanRecord(connection, payload) {
  const [result] = await connection.query(
    `INSERT INTO menu_plans (year, month, week_number, start_date, end_date, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payload.year,
      payload.month,
      payload.week_number,
      payload.start_date,
      payload.end_date,
      payload.notes ?? null,
    ]
  );
  return result.insertId;
}

async function updateMenuPlanRecord(connection, id, payload) {
  await connection.query(
    `UPDATE menu_plans
       SET year = ?, month = ?, week_number = ?,
           start_date = ?, end_date = ?, notes = ?
     WHERE id = ?`,
    [
      payload.year,
      payload.month,
      payload.week_number,
      payload.start_date,
      payload.end_date,
      payload.notes ?? null,
      id,
    ]
  );
}

async function deleteMenuPlanItemsByPlan(connection, planId) {
  await connection.query(`DELETE FROM menu_plan_items WHERE plan_id = ?`, [planId]);
}

async function bulkInsertMenuPlanItems(connection, planId, items) {
  if (!Array.isArray(items) || items.length === 0) return;
  const values = [];
  const placeholders = items
    .map((item) => {
      values.push(
        planId,
        item.plan_date,
        item.day_of_week,
        item.category,
        item.menu_name,
        item.portion_target,
        item.is_holiday ? 1 : 0,
        item.sort_order ?? 0
      );
      return "(?, ?, ?, ?, ?, ?, ?, ?)";
    })
    .join(", ");

  await connection.query(
    `INSERT INTO menu_plan_items
       (plan_id, plan_date, day_of_week, category, menu_name,
        portion_target, is_holiday, sort_order)
     VALUES ${placeholders}`,
    values
  );
}

export async function insertMenuPlanWithItems(payload, items) {
  await ensureMenuPlansTables();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const planId = await insertMenuPlanRecord(connection, payload);
    await bulkInsertMenuPlanItems(connection, planId, items);
    await connection.commit();
    return planId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function updateMenuPlanWithItems(id, payload, items) {
  await ensureMenuPlansTables();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await updateMenuPlanRecord(connection, id, payload);
    await deleteMenuPlanItemsByPlan(connection, id);
    await bulkInsertMenuPlanItems(connection, id, items);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function deleteMenuPlanById(id) {
  await ensureMenuPlansTables();
  const [result] = await pool.query(`DELETE FROM menu_plans WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}
