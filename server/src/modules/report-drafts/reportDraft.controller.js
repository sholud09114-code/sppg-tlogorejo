import { randomUUID } from "node:crypto";
import {
  applyDocumentationMenuPhotos,
  buildWeeklyDraft,
} from "./reportDraftBuilder.js";
import {
  createDraft,
  deleteDraft,
  getDraftById,
  listDrafts,
  setGeneratedPdfPath,
  updateDraft,
} from "./reportDraft.repository.js";
import { renderPreviewHtml } from "./reportPreviewRenderer.js";
import { generateReportPdf } from "./reportPdfGenerator.js";
import { getPhotoStorage, ALLOWED_SECTIONS } from "./reportPhotoStorage.js";
import {
  generateInputSchema,
  updateDraftInputSchema,
} from "./reportDraft.validators.js";

function badRequest(message, details) {
  const err = new Error(message);
  err.status = 400;
  if (details) err.details = details;
  return err;
}

function notFound(message = "Draft tidak ditemukan") {
  const err = new Error(message);
  err.status = 404;
  return err;
}

function ensureZod(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw badRequest("Validasi gagal", parsed.error.flatten());
  }
  return parsed.data;
}

export async function generateDraftHandler(req, res, next) {
  try {
    const { start_date, end_date, title } = ensureZod(generateInputSchema, {
      start_date: req.body?.start_date,
      end_date: req.body?.end_date,
      title: req.body?.title,
    });

    const data = await buildWeeklyDraft({
      startDate: start_date,
      endDate: end_date,
    });

    const draft = await createDraft({
      reportType: "weekly",
      sppgId: data?.report?.sppgId || null,
      startDate: start_date,
      endDate: end_date,
      title:
        title ||
        `Laporan Mingguan ${data?.report?.periodLabel || start_date}`,
      data,
      createdBy: req.user?.id || null,
    });

    res.status(201).json(draft);
  } catch (err) {
    next(err);
  }
}

export async function listDraftsHandler(req, res, next) {
  try {
    const drafts = await listDrafts({
      reportType: "weekly",
      limit: req.query?.limit || 50,
    });
    res.json({ drafts });
  } catch (err) {
    next(err);
  }
}

export async function getDraftHandler(req, res, next) {
  try {
    const draft = await getDraftById(req.params.id);
    if (!draft) throw notFound();
    res.json(draft);
  } catch (err) {
    next(err);
  }
}

export async function updateDraftHandler(req, res, next) {
  try {
    const payload = ensureZod(updateDraftInputSchema, req.body || {});
    const existing = await getDraftById(req.params.id);
    if (!existing) throw notFound();

    const updated = await updateDraft(req.params.id, {
      ...payload,
      updatedBy: req.user?.id || null,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteDraftHandler(req, res, next) {
  try {
    const existing = await getDraftById(req.params.id);
    if (!existing) throw notFound();
    await deleteDraft(req.params.id);
    try {
      await getPhotoStorage().removeDraftFolder(req.params.id);
    } catch {
      /* ignore filesystem cleanup errors */
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function previewDraftHandler(req, res, next) {
  try {
    const draft = await getDraftById(req.params.id);
    if (!draft) throw notFound();
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const html = renderPreviewHtml(draft.data, { mode: "preview", baseUrl });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    next(err);
  }
}

export async function generateDraftPdfHandler(req, res, next) {
  try {
    const draft = await getDraftById(req.params.id);
    if (!draft) throw notFound();

    const enrichedData = await applyDocumentationMenuPhotos(
      JSON.parse(JSON.stringify(draft.data || {}))
    );
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await generateReportPdf({
      draft: enrichedData,
      draftId: draft.id,
      baseUrl,
    });

    await setGeneratedPdfPath(draft.id, result.relativePath);

    res.json({
      filename: result.filename,
      download_url: result.downloadUrl,
    });
  } catch (err) {
    next(err);
  }
}

export async function downloadDraftPdfHandler(req, res, next) {
  try {
    const draft = await getDraftById(req.params.id);
    if (!draft) throw notFound();

    const file = String(req.query?.file || "").trim();
    if (!file) throw badRequest("Parameter file wajib diisi");
    if (file.includes("/") || file.includes("\\") || file.includes("..")) {
      throw badRequest("Path tidak valid");
    }

    const path = await import("node:path");
    const fs = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(here, "../../../storage/report-pdfs");
    const filePath = path.join(root, draft.id, file);
    if (!filePath.startsWith(root)) throw badRequest("Path tidak valid");

    const buffer = await fs.readFile(filePath).catch(() => null);
    if (!buffer) throw notFound("File PDF tidak ditemukan");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file)}"`
    );
    res.end(buffer);
  } catch (err) {
    next(err);
  }
}

export async function uploadPhotoHandler(req, res, next) {
  try {
    const { id, section } = req.params;
    if (!ALLOWED_SECTIONS.has(section)) throw badRequest("Section tidak valid");

    const draft = await getDraftById(id);
    if (!draft) throw notFound();
    if (!req.file) throw badRequest("File foto wajib diupload");

    const storage = getPhotoStorage();
    const saved = await storage.save({
      draftId: id,
      section,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    const data = draft.data || {};
    const newEntry = {
      id: randomUUID(),
      filename: saved.filename,
      imageUrl: saved.imageUrl,
      gdriveFileId: saved.gdriveFileId || null,
      backend: saved.backend || "local",
      section,
    };

    if (section === "activity") {
      const list = Array.isArray(data.activityPhotos) ? data.activityPhotos : [];
      newEntry.caption = String(req.body?.caption || "");
      newEntry.sortOrder = list.length;
      data.activityPhotos = [...list, newEntry];
    } else {
      const list = Array.isArray(data.menuPhotos) ? data.menuPhotos : [];
      const targetIndex = req.body?.menuPhotoIndex
        ? Number(req.body.menuPhotoIndex)
        : NaN;
      const updated = list.map((photo, index) => {
        if (Number.isFinite(targetIndex) && index === targetIndex) {
          return { ...photo, ...newEntry };
        }
        return photo;
      });
      if (
        !Number.isFinite(targetIndex) ||
        targetIndex < 0 ||
        targetIndex >= list.length
      ) {
        updated.push({
          ...newEntry,
          no: list.length + 1,
          schools: [],
          date: "",
          dateLabel: "",
          sortOrder: list.length,
        });
      }
      data.menuPhotos = updated;
    }

    const updatedDraft = await updateDraft(id, {
      data,
      updatedBy: req.user?.id || null,
    });
    res.status(201).json({
      photo: newEntry,
      draft: updatedDraft,
    });
  } catch (err) {
    next(err);
  }
}

export async function deletePhotoHandler(req, res, next) {
  try {
    const { id, section, filename } = req.params;
    if (!ALLOWED_SECTIONS.has(section)) throw badRequest("Section tidak valid");

    const draft = await getDraftById(id);
    if (!draft) throw notFound();

    const data = draft.data || {};
    const findGdriveId = (list) =>
      (list || []).find((p) => p.filename === filename)?.gdriveFileId || null;
    const gdriveFileId =
      section === "activity"
        ? findGdriveId(data.activityPhotos)
        : findGdriveId(data.menuPhotos);

    const storage = getPhotoStorage();
    await storage.remove({ draftId: id, section, filename, gdriveFileId });

    if (section === "activity") {
      data.activityPhotos = (data.activityPhotos || []).filter(
        (p) => p.filename !== filename
      );
    } else {
      data.menuPhotos = (data.menuPhotos || []).map((p) =>
        p.filename === filename
          ? { ...p, filename: null, imageUrl: "", id: null, gdriveFileId: null }
          : p
      );
    }

    const updated = await updateDraft(id, {
      data,
      updatedBy: req.user?.id || null,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function servePhotoHandler(req, res, next) {
  try {
    const { id, section, filename } = req.params;
    if (!ALLOWED_SECTIONS.has(section)) throw badRequest("Section tidak valid");

    const draft = await getDraftById(id);
    if (!draft) throw notFound("Draft tidak ditemukan");

    const data = draft.data || {};
    const findGdriveId = (list) =>
      (list || []).find((p) => p.filename === filename)?.gdriveFileId || null;
    const gdriveFileId =
      section === "activity"
        ? findGdriveId(data.activityPhotos)
        : findGdriveId(data.menuPhotos);

    const storage = getPhotoStorage();
    const result = await storage.readBuffer({
      draftId: id,
      section,
      filename,
      gdriveFileId,
    });
    if (!result) throw notFound("Foto tidak ditemukan");

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.end(result.buffer);
  } catch (err) {
    next(err);
  }
}
