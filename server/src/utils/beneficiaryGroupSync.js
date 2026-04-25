import pool from "../config/db.js";

const TYPE_TO_CATEGORY = {
  "Paud/KB/TK": "PAUD/TK/KB",
  SD: "SD",
  "SMP/MTs": "SMP",
  SMK: "SMK",
};

const CATEGORY_ORDER = {
  "Paud/KB/TK": 100,
  SD: 200,
  "SMP/MTs": 300,
  SMK: 400,
};

let ensureSetupPromise;

export function ensureBeneficiaryGroupsTable() {
  if (!ensureSetupPromise) {
    ensureSetupPromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS beneficiary_groups (
          id INT AUTO_INCREMENT PRIMARY KEY,
          group_type ENUM('Paud/KB/TK', 'SD', 'SMP/MTs', 'SMK') NOT NULL,
          group_name VARCHAR(150) NOT NULL,
          student_small_portion INT NOT NULL DEFAULT 0,
          student_large_portion INT NOT NULL DEFAULT 0,
          staff_small_portion INT NOT NULL DEFAULT 0,
          staff_large_portion INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_beneficiary_group_type (group_type),
          INDEX idx_beneficiary_group_name (group_name)
        ) ENGINE=InnoDB`
      );

      const [columns] = await pool.query(
        `SHOW COLUMNS FROM units LIKE 'beneficiary_group_id'`
      );

      if (columns.length === 0) {
        await pool.query(
          `ALTER TABLE units
             ADD COLUMN beneficiary_group_id INT NULL AFTER id,
             ADD UNIQUE KEY uq_units_beneficiary_group_id (beneficiary_group_id),
             ADD INDEX idx_units_beneficiary_group_id (beneficiary_group_id)`
        );
      }
    })().catch((err) => {
      ensureSetupPromise = null;
      throw err;
    });
  }

  return ensureSetupPromise;
}

export async function syncBeneficiaryGroupsToUnits() {
  await ensureBeneficiaryGroupsTable();

  const [groups] = await pool.query(
    `SELECT id, group_type, group_name,
            student_small_portion, student_large_portion,
            staff_small_portion, staff_large_portion
       FROM beneficiary_groups
      ORDER BY FIELD(group_type, 'Paud/KB/TK', 'SD', 'SMP/MTs', 'SMK'), id ASC`
  );

  if (groups.length === 0) {
    return { usingBeneficiaryGroups: false, total: 0 };
  }

  const [existingUnits] = await pool.query(
    `SELECT id, beneficiary_group_id
       FROM units
      WHERE beneficiary_group_id IS NOT NULL`
  );

  const unitMap = new Map(
    existingUnits.map((row) => [Number(row.beneficiary_group_id), row.id])
  );
  const activeGroupIds = [];

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const totalPortion =
      Number(group.student_small_portion || 0) +
      Number(group.student_large_portion || 0) +
      Number(group.staff_small_portion || 0) +
      Number(group.staff_large_portion || 0);
    const category = TYPE_TO_CATEGORY[group.group_type];
    const displayOrder = (CATEGORY_ORDER[group.group_type] || 999) + index + 1;

    activeGroupIds.push(group.id);

    if (unitMap.has(group.id)) {
      await pool.query(
        `UPDATE units
            SET name = ?,
                category = ?,
                default_target = ?,
                display_order = ?,
                is_active = 1
          WHERE beneficiary_group_id = ?`,
        [group.group_name, category, totalPortion, displayOrder, group.id]
      );
      continue;
    }

    await pool.query(
      `INSERT INTO units
        (beneficiary_group_id, name, category, default_target, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [group.id, group.group_name, category, totalPortion, displayOrder]
    );
  }

  if (activeGroupIds.length > 0) {
    await pool.query(
      `UPDATE units
          SET is_active = 0
        WHERE beneficiary_group_id IS NOT NULL
          AND beneficiary_group_id NOT IN (?)`,
      [activeGroupIds]
    );
  }

  return { usingBeneficiaryGroups: true, total: groups.length };
}
