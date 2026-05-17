import {
  createDocumentationPhoto,
  deleteDocumentationPhotoRow,
  getDocumentationPhotoById,
  listDocumentationPhotos,
  updateDocumentationPhoto,
} from "./documentation.repository.js";
import {
  createDocumentationSchema,
  listQuerySchema,
  PHOTO_TYPE_LABELS,
  updateDocumentationSchema,
} from "./documentation.validators.js";
import {
  deleteFile,
  getDriveStatus,
  getThumbnailBuffer,
  uploadFile,
} from "../gdrive/gdrive.service.js";

function badRequest(message, details) {
  const err = new Error(message);
  err.status = 400;
  if (details) err.details = details;
  return err;
}

function notFound(message = "Foto tidak ditemukan") {
  const err = new Error(message);
  err.status = 404;
  return err;
}

function ensureSchema(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw badRequest("Validasi gagal", parsed.error.flatten());
  }
  return parsed.data;
}

function buildFolderSegments(photoType, photoDate) {
  const label = PHOTO_TYPE_LABELS[photoType] || photoType;
  const yyyy = photoDate.slice(0, 4);
  const mm = photoDate.slice(5, 7);
  return ["Documentation", label, `${yyyy}-${mm}`];
}

function buildFilename({ photoType, photoDate, title, originalName }) {
  const ext = (originalName.match(/\.[a-zA-Z0-9]+$/) || [".jpg"])[0];
  const slug = (title || PHOTO_TYPE_LABELS[photoType] || photoType)
    .replace(/[\\/:*?"<>|\n\r\t]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "foto";
  const stamp = Date.now().toString(36);
  return `${photoDate} ${slug} ${stamp}${ext}`;
}

export async function listHandler(req, res, next) {
  try {
    const { photo_type, start_date, end_date } = ensureSchema(listQuerySchema, {
      photo_type: req.query.photo_type,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
    });
    const items = await listDocumentationPhotos({
      photoType: photo_type,
      startDate: start_date,
      endDate: end_date,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req, res, next) {
  try {
    const item = await getDocumentationPhotoById(req.params.id);
    if (!item) throw notFound();
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function createHandler(req, res, next) {
  try {
    if (!req.file) throw badRequest("File foto wajib diupload");
    const meta = ensureSchema(createDocumentationSchema, {
      photo_type: req.body?.photo_type,
      photo_date: req.body?.photo_date,
      title: req.body?.title,
      notes: req.body?.notes,
    });

    const status = await getDriveStatus();
    if (!status.connected) {
      throw badRequest(
        "Google Drive belum terhubung. Buka tombol Hubungkan Google Drive di halaman Dokumentasi."
      );
    }

    const folderSegments = buildFolderSegments(meta.photo_type, meta.photo_date);
    const filename = buildFilename({
      photoType: meta.photo_type,
      photoDate: meta.photo_date,
      title: meta.title,
      originalName: req.file.originalname || "foto.jpg",
    });

    const driveFile = await uploadFile({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      name: filename,
      folderSegments,
    });

    const created = await createDocumentationPhoto({
      photoType: meta.photo_type,
      photoDate: meta.photo_date,
      title: meta.title,
      notes: meta.notes,
      gdriveFileId: driveFile.id,
      gdriveViewUrl: driveFile.webViewLink,
      gdriveThumbnailUrl: driveFile.thumbnailLink,
      mimeType: driveFile.mimeType,
      fileSizeBytes: Number(driveFile.size) || req.file.size || null,
      uploadedBy: req.user?.id || null,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req, res, next) {
  try {
    const existing = await getDocumentationPhotoById(req.params.id);
    if (!existing) throw notFound();
    const data = ensureSchema(updateDocumentationSchema, req.body || {});
    const updated = await updateDocumentationPhoto(req.params.id, {
      photoType: data.photo_type,
      photoDate: data.photo_date,
      title: data.title,
      notes: data.notes,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req, res, next) {
  try {
    const existing = await getDocumentationPhotoById(req.params.id);
    if (!existing) throw notFound();
    try {
      await deleteFile(existing.gdrive_file_id);
    } catch (err) {
      // Log but proceed; admin may have already deleted on Drive side.
      console.warn("[documentation] gdrive delete failed", err.message);
    }
    await deleteDocumentationPhotoRow(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function thumbnailHandler(req, res, next) {
  try {
    const item = await getDocumentationPhotoById(req.params.id);
    if (!item) throw notFound();
    const size = Math.min(2000, Math.max(64, Number(req.query.s) || 600));
    const result = await getThumbnailBuffer(item.gdrive_file_id, size);
    if (!result) {
      return res.status(404).json({ error: "Thumbnail tidak tersedia" });
    }
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.end(result.buffer);
  } catch (err) {
    next(err);
  }
}
