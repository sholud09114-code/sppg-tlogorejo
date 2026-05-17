import { randomUUID } from "node:crypto";
import pool from "../../config/db.js";

let ensurePromise;
export function ensureDocumentationPhotosTable() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS documentation_photos (
          id                   CHAR(36)        NOT NULL PRIMARY KEY,
          photo_type           ENUM('menu_daily','distribution','activity_other') NOT NULL,
          photo_date           DATE            NOT NULL,
          title                VARCHAR(255)    NULL,
          notes                TEXT            NULL,
          gdrive_file_id       VARCHAR(120)    NOT NULL,
          gdrive_view_url      VARCHAR(500)    NULL,
          gdrive_thumbnail_url VARCHAR(500)    NULL,
          mime_type            VARCHAR(100)    NULL,
          file_size_bytes      BIGINT          NULL,
          uploaded_by          INT             NULL,
          created_at           TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
          updated_at           TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_documentation_photos_drive (gdrive_file_id),
          INDEX idx_documentation_photos_type_date (photo_type, photo_date),
          INDEX idx_documentation_photos_date (photo_date),
          INDEX idx_documentation_photos_updated_at (updated_at)
        ) ENGINE=InnoDB`
      );
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}

function rowToObject(row) {
  if (!row) return null;
  return {
    id: row.id,
    photo_type: row.photo_type,
    photo_date:
      typeof row.photo_date === "string"
        ? row.photo_date
        : row.photo_date?.toISOString?.().slice(0, 10) || null,
    title: row.title,
    notes: row.notes,
    gdrive_file_id: row.gdrive_file_id,
    gdrive_view_url: row.gdrive_view_url,
    gdrive_thumbnail_url: row.gdrive_thumbnail_url,
    mime_type: row.mime_type,
    file_size_bytes: row.file_size_bytes,
    uploaded_by: row.uploaded_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createDocumentationPhoto({
  photoType,
  photoDate,
  title,
  notes,
  gdriveFileId,
  gdriveViewUrl,
  gdriveThumbnailUrl,
  mimeType,
  fileSizeBytes,
  uploadedBy,
}) {
  await ensureDocumentationPhotosTable();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO documentation_photos
       (id, photo_type, photo_date, title, notes, gdrive_file_id,
        gdrive_view_url, gdrive_thumbnail_url, mime_type, file_size_bytes, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      photoType,
      photoDate,
      title || null,
      notes || null,
      gdriveFileId,
      gdriveViewUrl || null,
      gdriveThumbnailUrl || null,
      mimeType || null,
      fileSizeBytes || null,
      uploadedBy || null,
    ]
  );
  return getDocumentationPhotoById(id);
}

export async function getDocumentationPhotoById(id) {
  await ensureDocumentationPhotosTable();
  const [rows] = await pool.query(
    `SELECT * FROM documentation_photos WHERE id = ? LIMIT 1`,
    [id]
  );
  return rowToObject(rows[0]);
}

export async function listDocumentationPhotos({
  photoType,
  startDate,
  endDate,
  limit = 200,
} = {}) {
  await ensureDocumentationPhotosTable();
  const conditions = [];
  const params = [];
  if (photoType) {
    conditions.push("photo_type = ?");
    params.push(photoType);
  }
  if (startDate) {
    conditions.push("photo_date >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("photo_date <= ?");
    params.push(endDate);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
  const [rows] = await pool.query(
    `SELECT * FROM documentation_photos
       ${where}
       ORDER BY photo_date DESC, created_at DESC
       LIMIT ?`,
    [...params, safeLimit]
  );
  return rows.map(rowToObject);
}

export async function updateDocumentationPhoto(id, { photoType, photoDate, title, notes }) {
  await ensureDocumentationPhotosTable();
  const fields = [];
  const params = [];
  if (photoType !== undefined) {
    fields.push("photo_type = ?");
    params.push(photoType);
  }
  if (photoDate !== undefined) {
    fields.push("photo_date = ?");
    params.push(photoDate);
  }
  if (title !== undefined) {
    fields.push("title = ?");
    params.push(title || null);
  }
  if (notes !== undefined) {
    fields.push("notes = ?");
    params.push(notes || null);
  }
  if (!fields.length) return getDocumentationPhotoById(id);
  params.push(id);
  await pool.query(
    `UPDATE documentation_photos SET ${fields.join(", ")} WHERE id = ?`,
    params
  );
  return getDocumentationPhotoById(id);
}

export async function deleteDocumentationPhotoRow(id) {
  await ensureDocumentationPhotosTable();
  await pool.query(`DELETE FROM documentation_photos WHERE id = ?`, [id]);
}
