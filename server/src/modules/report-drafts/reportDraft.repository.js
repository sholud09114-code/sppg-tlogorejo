import { randomUUID } from "node:crypto";
import pool from "../../config/db.js";

let ensureReportDraftsTablePromise;

export function ensureReportDraftsTable() {
  if (!ensureReportDraftsTablePromise) {
    ensureReportDraftsTablePromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS report_drafts (
          id                 CHAR(36)        NOT NULL PRIMARY KEY,
          report_type        VARCHAR(40)     NOT NULL DEFAULT 'weekly',
          sppg_id            VARCHAR(40)     NULL,
          start_date         DATE            NOT NULL,
          end_date           DATE            NOT NULL,
          title              VARCHAR(255)    NULL,
          status             ENUM('draft','final') NOT NULL DEFAULT 'draft',
          data_json          JSON            NOT NULL,
          generated_pdf_path VARCHAR(500)    NULL,
          created_by         INT             NULL,
          updated_by         INT             NULL,
          created_at         TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
          updated_at         TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_report_drafts_range (report_type, start_date, end_date),
          INDEX idx_report_drafts_status (status),
          INDEX idx_report_drafts_updated_at (updated_at)
        ) ENGINE=InnoDB`
      );
    })().catch((err) => {
      ensureReportDraftsTablePromise = null;
      throw err;
    });
  }
  return ensureReportDraftsTablePromise;
}

function rowToDraft(row) {
  if (!row) return null;
  let data;
  try {
    data =
      typeof row.data_json === "string" ? JSON.parse(row.data_json) : row.data_json || {};
  } catch {
    data = {};
  }
  return {
    id: row.id,
    report_type: row.report_type,
    sppg_id: row.sppg_id,
    start_date:
      typeof row.start_date === "string"
        ? row.start_date
        : row.start_date?.toISOString?.().slice(0, 10) || null,
    end_date:
      typeof row.end_date === "string"
        ? row.end_date
        : row.end_date?.toISOString?.().slice(0, 10) || null,
    title: row.title,
    status: row.status,
    data,
    generated_pdf_path: row.generated_pdf_path,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createDraft({
  reportType = "weekly",
  sppgId = null,
  startDate,
  endDate,
  title = null,
  data,
  createdBy = null,
}) {
  await ensureReportDraftsTable();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO report_drafts
      (id, report_type, sppg_id, start_date, end_date, title, status, data_json, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', CAST(? AS JSON), ?, ?)`,
    [
      id,
      reportType,
      sppgId,
      startDate,
      endDate,
      title,
      JSON.stringify(data ?? {}),
      createdBy,
      createdBy,
    ]
  );
  return getDraftById(id);
}

export async function getDraftById(id) {
  await ensureReportDraftsTable();
  const [rows] = await pool.query(
    `SELECT * FROM report_drafts WHERE id = ? LIMIT 1`,
    [id]
  );
  return rowToDraft(rows[0]);
}

export async function listDrafts({ reportType = "weekly", limit = 50 } = {}) {
  await ensureReportDraftsTable();
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 50));
  const [rows] = await pool.query(
    `SELECT id, report_type, sppg_id, start_date, end_date, title, status,
            generated_pdf_path, created_at, updated_at
       FROM report_drafts
      WHERE report_type = ?
      ORDER BY updated_at DESC
      LIMIT ?`,
    [reportType, safeLimit]
  );
  return rows.map((row) => ({
    ...row,
    start_date:
      typeof row.start_date === "string"
        ? row.start_date
        : row.start_date?.toISOString?.().slice(0, 10) || null,
    end_date:
      typeof row.end_date === "string"
        ? row.end_date
        : row.end_date?.toISOString?.().slice(0, 10) || null,
  }));
}

export async function updateDraft(id, { data, title, status, updatedBy = null }) {
  await ensureReportDraftsTable();
  const fields = [];
  const params = [];
  if (data !== undefined) {
    fields.push("data_json = CAST(? AS JSON)");
    params.push(JSON.stringify(data));
  }
  if (title !== undefined) {
    fields.push("title = ?");
    params.push(title);
  }
  if (status !== undefined) {
    fields.push("status = ?");
    params.push(status);
  }
  fields.push("updated_by = ?");
  params.push(updatedBy);
  params.push(id);

  await pool.query(
    `UPDATE report_drafts SET ${fields.join(", ")} WHERE id = ?`,
    params
  );
  return getDraftById(id);
}

export async function setGeneratedPdfPath(id, path) {
  await ensureReportDraftsTable();
  await pool.query(
    `UPDATE report_drafts SET generated_pdf_path = ? WHERE id = ?`,
    [path, id]
  );
}

export async function deleteDraft(id) {
  await ensureReportDraftsTable();
  await pool.query(`DELETE FROM report_drafts WHERE id = ?`, [id]);
}
