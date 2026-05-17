import { mkdir, writeFile, unlink, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  deleteFile as gdriveDeleteFile,
  getDriveStatus,
  getThumbnailBuffer,
  uploadFile as gdriveUploadFile,
} from "../gdrive/gdrive.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = path.resolve(__dirname, "../../../storage/report-photos");

const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const ALLOWED_SECTIONS = new Set(["activity", "menu"]);
const SECTION_LABEL = {
  activity: "Activity Photos",
  menu: "Menu Photos",
};

function assertSection(section) {
  if (!ALLOWED_SECTIONS.has(section)) {
    const err = new Error(`Section foto tidak valid: ${section}`);
    err.status = 400;
    throw err;
  }
}

function safeId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

function shortDraftLabel(value) {
  const id = safeId(value);
  return id ? `Draft-${id.slice(0, 8)}` : "Draft";
}

function buildImageUrl({ draftId, section, filename }) {
  return `/api/report-drafts/${safeId(draftId)}/photos/${section}/${filename}`;
}

/**
 * Local fallback. Used when Google Drive is not connected, and for reading any
 * legacy photos that were uploaded before the GDrive migration.
 */
const localPhotoStorage = {
  async save({ draftId, section, buffer, mimeType }) {
    assertSection(section);
    const draftKey = safeId(draftId);
    if (!draftKey) {
      const err = new Error("draftId tidak valid");
      err.status = 400;
      throw err;
    }
    const ext = EXT_BY_MIME[String(mimeType || "").toLowerCase()] || ".jpg";
    const dir = path.join(STORAGE_ROOT, draftKey, section);
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(dir, filename);
    await writeFile(filePath, buffer);
    return {
      filename,
      backend: "local",
      gdriveFileId: null,
      relativePath: path.relative(STORAGE_ROOT, filePath),
      absolutePath: filePath,
      imageUrl: buildImageUrl({ draftId, section, filename }),
    };
  },

  resolveLocalPath({ draftId, section, filename }) {
    assertSection(section);
    const draftKey = safeId(draftId);
    const safeName = String(filename || "").replace(/[^a-zA-Z0-9_.-]/g, "");
    if (!draftKey || !safeName) return null;
    const filePath = path.join(STORAGE_ROOT, draftKey, section, safeName);
    if (!filePath.startsWith(STORAGE_ROOT)) return null;
    return filePath;
  },

  async readBuffer({ draftId, section, filename }) {
    const filePath = this.resolveLocalPath({ draftId, section, filename });
    if (!filePath || !existsSync(filePath)) return null;
    const buffer = await readFile(filePath);
    const ext = (filename.match(/\.[a-zA-Z0-9]+$/) || [".jpg"])[0].toLowerCase();
    const mime =
      Object.entries(EXT_BY_MIME).find(([, e]) => e === ext)?.[0] || "image/jpeg";
    return { buffer, contentType: mime };
  },

  async remove({ draftId, section, filename }) {
    const filePath = this.resolveLocalPath({ draftId, section, filename });
    if (!filePath) return false;
    try {
      await unlink(filePath);
      return true;
    } catch (err) {
      if (err.code === "ENOENT") return false;
      throw err;
    }
  },

  async removeDraftFolder(draftId) {
    const draftKey = safeId(draftId);
    if (!draftKey) return;
    const dir = path.join(STORAGE_ROOT, draftKey);
    await rm(dir, { recursive: true, force: true });
  },
};

/**
 * GDrive-backed storage. Files are written to:
 *   SPPG Tlogorejo / Report Drafts / Draft-<id8> / Activity Photos|Menu Photos /
 *
 * Each saved entry stores both the human filename and the gdrive file id; we
 * key the lookup map in the draft JSON by `filename`, so the controller stays
 * untouched.
 */
const gdriveDraftRegistry = new Map();

function registryKey(draftId, section, filename) {
  return `${safeId(draftId)}|${section}|${filename}`;
}

const gdrivePhotoStorage = {
  async save({ draftId, section, buffer, mimeType, originalName }) {
    assertSection(section);
    const draftKey = safeId(draftId);
    if (!draftKey) {
      const err = new Error("draftId tidak valid");
      err.status = 400;
      throw err;
    }
    const ext =
      EXT_BY_MIME[String(mimeType || "").toLowerCase()] ||
      (originalName?.match(/\.[a-zA-Z0-9]+$/)?.[0]?.toLowerCase()) ||
      ".jpg";
    const filename = `${randomUUID()}${ext}`;
    const folderSegments = [
      "Report Drafts",
      shortDraftLabel(draftId),
      SECTION_LABEL[section],
    ];
    const driveFile = await gdriveUploadFile({
      buffer,
      mimeType: mimeType || "image/jpeg",
      name: filename,
      folderSegments,
    });
    gdriveDraftRegistry.set(registryKey(draftId, section, filename), driveFile.id);
    return {
      filename,
      backend: "gdrive",
      gdriveFileId: driveFile.id,
      gdriveViewUrl: driveFile.webViewLink,
      imageUrl: buildImageUrl({ draftId, section, filename }),
    };
  },

  async findGdriveFileId({ draftId, section, filename }) {
    return gdriveDraftRegistry.get(registryKey(draftId, section, filename)) || null;
  },

  trackGdriveFileId({ draftId, section, filename, gdriveFileId }) {
    if (!gdriveFileId) return;
    gdriveDraftRegistry.set(registryKey(draftId, section, filename), gdriveFileId);
  },

  async remove({ draftId, section, filename, gdriveFileId }) {
    assertSection(section);
    let id = gdriveFileId;
    if (!id) {
      id = gdriveDraftRegistry.get(registryKey(draftId, section, filename)) || null;
    }
    if (id) {
      try {
        await gdriveDeleteFile(id);
      } catch (err) {
        if (err?.code !== 404) {
          console.warn("[reportPhotoStorage] gdrive delete failed", err.message);
        }
      }
      gdriveDraftRegistry.delete(registryKey(draftId, section, filename));
      return true;
    }
    return false;
  },
};

/**
 * Hybrid facade exposed to the controller. New uploads go to GDrive when
 * connected; legacy files on disk continue to serve from the local fallback.
 */
export const reportPhotoStorage = {
  async save({ draftId, section, buffer, mimeType, originalName }) {
    const status = await getDriveStatus().catch(() => ({ connected: false }));
    if (status.connected) {
      return gdrivePhotoStorage.save({
        draftId,
        section,
        buffer,
        mimeType,
        originalName,
      });
    }
    return localPhotoStorage.save({ draftId, section, buffer, mimeType });
  },

  async readBuffer({ draftId, section, filename, gdriveFileId }) {
    if (gdriveFileId) {
      const result = await getThumbnailBuffer(gdriveFileId, 1600).catch(() => null);
      if (result) return result;
    }
    return localPhotoStorage.readBuffer({ draftId, section, filename });
  },

  async remove({ draftId, section, filename, gdriveFileId }) {
    let removed = false;
    if (gdriveFileId) {
      removed =
        (await gdrivePhotoStorage.remove({
          draftId,
          section,
          filename,
          gdriveFileId,
        })) || removed;
    } else {
      removed = (await gdrivePhotoStorage.remove({ draftId, section, filename })) || removed;
    }
    const localRemoved = await localPhotoStorage.remove({ draftId, section, filename });
    return removed || localRemoved;
  },

  async removeDraftFolder(draftId) {
    await localPhotoStorage.removeDraftFolder(draftId);
  },

  async toDataUri({ draftId, section, filename, gdriveFileId }) {
    const result = await this.readBuffer({ draftId, section, filename, gdriveFileId });
    if (!result) return null;
    return `data:${result.contentType};base64,${result.buffer.toString("base64")}`;
  },

  trackGdriveFileId({ draftId, section, filename, gdriveFileId }) {
    gdrivePhotoStorage.trackGdriveFileId({
      draftId,
      section,
      filename,
      gdriveFileId,
    });
  },
};

export function getPhotoStorage() {
  return reportPhotoStorage;
}

export const STORAGE_ROOT_PATH = STORAGE_ROOT;
export { ALLOWED_SECTIONS, localPhotoStorage };

