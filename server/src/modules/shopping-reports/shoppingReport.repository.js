import pool from "../../config/db.js";
import { ensureItemMastersTable } from "../../controllers/itemMasterController.js";

let ensureShoppingReportsTablePromise;

export function ensureShoppingReportsTables() {
  if (!ensureShoppingReportsTablePromise) {
    ensureShoppingReportsTablePromise = (async () => {
      await ensureItemMastersTable();
      await pool.query(
        `CREATE TABLE IF NOT EXISTS shopping_reports (
          id INT AUTO_INCREMENT PRIMARY KEY,
          report_date DATE NOT NULL,
          menu_name VARCHAR(200) NOT NULL,
          small_portion_count DECIMAL(12,2) NOT NULL DEFAULT 0,
          large_portion_count DECIMAL(12,2) NOT NULL DEFAULT 0,
          daily_budget DECIMAL(12,2) NOT NULL DEFAULT 0,
          total_spending DECIMAL(12,2) NOT NULL DEFAULT 0,
          difference_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          item_count INT NOT NULL DEFAULT 0,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_shopping_report_date (report_date),
          INDEX idx_shopping_menu_name (menu_name)
        ) ENGINE=InnoDB`
      );

      const [smallColumns] = await pool.query(
        `SHOW COLUMNS FROM shopping_reports LIKE 'small_portion_count'`
      );
      if (smallColumns.length === 0) {
        await pool.query(
          `ALTER TABLE shopping_reports
             ADD COLUMN small_portion_count DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER menu_name`
        );
      }

      const [largeColumns] = await pool.query(
        `SHOW COLUMNS FROM shopping_reports LIKE 'large_portion_count'`
      );
      if (largeColumns.length === 0) {
        await pool.query(
          `ALTER TABLE shopping_reports
             ADD COLUMN large_portion_count DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER small_portion_count`
        );
      }

      await pool.query(
        `CREATE TABLE IF NOT EXISTS shopping_report_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          report_id INT NOT NULL,
          master_item_id INT NULL,
          description VARCHAR(200) NOT NULL,
          qty DECIMAL(12,2) NOT NULL DEFAULT 0,
          unit_name VARCHAR(50) NOT NULL DEFAULT '',
          price DECIMAL(12,2) NOT NULL DEFAULT 0,
          amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          notes VARCHAR(255) NULL,
          display_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_shopping_report_items_report
            FOREIGN KEY (report_id) REFERENCES shopping_reports(id) ON DELETE CASCADE,
          CONSTRAINT fk_shopping_report_items_master
            FOREIGN KEY (master_item_id) REFERENCES item_masters(id) ON DELETE SET NULL,
          INDEX idx_shopping_report_items_report (report_id),
          INDEX idx_shopping_report_items_order (display_order)
        ) ENGINE=InnoDB`
      );

      const [columns] = await pool.query(
        `SHOW COLUMNS FROM shopping_report_items LIKE 'master_item_id'`
      );
      if (columns.length === 0) {
        await pool.query(
          `ALTER TABLE shopping_report_items ADD COLUMN master_item_id INT NULL AFTER report_id`
        );
        await pool.query(
          `ALTER TABLE shopping_report_items
             ADD CONSTRAINT fk_shopping_report_items_master
             FOREIGN KEY (master_item_id) REFERENCES item_masters(id) ON DELETE SET NULL`
        );
      }
    })().catch((err) => {
      ensureShoppingReportsTablePromise = null;
      throw err;
    });
  }

  return ensureShoppingReportsTablePromise;
}

export async function listShoppingReportRows() {
  const [rows] = await pool.query(
    `SELECT id, report_date, menu_name, small_portion_count, large_portion_count, daily_budget, total_spending,
            difference_amount, item_count, notes, created_at, updated_at
       FROM shopping_reports
      ORDER BY report_date DESC, id DESC`
  );
  return rows;
}

export async function findShoppingReportById(id) {
  const [reports] = await pool.query(
    `SELECT id, report_date, menu_name, small_portion_count, large_portion_count, daily_budget, total_spending,
            difference_amount, item_count, notes, created_at, updated_at
       FROM shopping_reports
      WHERE id = ?`,
    [id]
  );

  if (!reports.length) return null;

  const [items] = await pool.query(
    `SELECT i.id, i.report_id, i.master_item_id, i.description, i.qty, i.unit_name, i.price, i.amount, i.notes, i.display_order,
            m.item_code AS master_item_code, m.item_name AS master_item_name
       FROM shopping_report_items i
       LEFT JOIN item_masters m ON m.id = i.master_item_id
      WHERE i.report_id = ?
      ORDER BY i.display_order ASC, i.id ASC`,
    [id]
  );

  return {
    ...reports[0],
    items,
  };
}

export async function insertShoppingReport(payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO shopping_reports
        (report_date, menu_name, small_portion_count, large_portion_count, daily_budget, total_spending, difference_amount, item_count, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.report_date,
        payload.menu_name,
        payload.small_portion_count,
        payload.large_portion_count,
        payload.daily_budget,
        payload.total_spending,
        payload.difference_amount,
        payload.item_count,
        payload.notes || null,
      ]
    );

    const itemValues = payload.items.map((item) => [
      result.insertId,
      item.master_item_id,
      item.description,
      item.qty,
      item.unit_name,
      item.price,
      item.amount,
      item.notes || null,
      item.display_order,
    ]);

    await conn.query(
      `INSERT INTO shopping_report_items
        (report_id, master_item_id, description, qty, unit_name, price, amount, notes, display_order)
       VALUES ?`,
      [itemValues]
    );

    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateShoppingReportRecord(id, payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE shopping_reports
          SET report_date = ?,
              menu_name = ?,
              small_portion_count = ?,
              large_portion_count = ?,
              daily_budget = ?,
              total_spending = ?,
              difference_amount = ?,
              item_count = ?,
              notes = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        payload.report_date,
        payload.menu_name,
        payload.small_portion_count,
        payload.large_portion_count,
        payload.daily_budget,
        payload.total_spending,
        payload.difference_amount,
        payload.item_count,
        payload.notes || null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return false;
    }

    await conn.query(`DELETE FROM shopping_report_items WHERE report_id = ?`, [id]);

    const itemValues = payload.items.map((item) => [
      id,
      item.master_item_id,
      item.description,
      item.qty,
      item.unit_name,
      item.price,
      item.amount,
      item.notes || null,
      item.display_order,
    ]);

    await conn.query(
      `INSERT INTO shopping_report_items
        (report_id, master_item_id, description, qty, unit_name, price, amount, notes, display_order)
       VALUES ?`,
      [itemValues]
    );

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteShoppingReportById(id) {
  const [result] = await pool.query(`DELETE FROM shopping_reports WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}
