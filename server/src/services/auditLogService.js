import pool from "../config/db.js";

let ensureAuditLogsTablePromise;

export function ensureAuditLogsTable() {
  if (!ensureAuditLogsTablePromise) {
    ensureAuditLogsTablePromise = pool
      .query(
        `CREATE TABLE IF NOT EXISTS audit_logs (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          action VARCHAR(50) NOT NULL,
          entity_type VARCHAR(80) NOT NULL,
          entity_id VARCHAR(80) NULL,
          old_data JSON NULL,
          new_data JSON NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_audit_logs_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_audit_logs_user (user_id),
          INDEX idx_audit_logs_entity (entity_type, entity_id),
          INDEX idx_audit_logs_action (action),
          INDEX idx_audit_logs_created_at (created_at)
        ) ENGINE=InnoDB`
      )
      .catch((err) => {
        ensureAuditLogsTablePromise = null;
        throw err;
      });
  }

  return ensureAuditLogsTablePromise;
}

function normalizeUserId(userId) {
  const parsed = Number(userId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function serializeAuditData(value) {
  if (value == null) {
    return null;
  }

  return JSON.stringify(value);
}

export async function recordAuditLog({
  userId,
  action,
  entityType,
  entityId,
  oldData = null,
  newData = null,
}) {
  try {
    await ensureAuditLogsTable();
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        normalizeUserId(userId),
        action,
        entityType,
        entityId == null ? null : String(entityId),
        serializeAuditData(oldData),
        serializeAuditData(newData),
      ]
    );
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}
