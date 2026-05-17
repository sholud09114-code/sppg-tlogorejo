import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPreviewHtml } from "./reportPreviewRenderer.js";
import { getPhotoStorage } from "./reportPhotoStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_ROOT = path.resolve(__dirname, "../../../storage/report-pdfs");

let browserPromise = null;

async function getBrowser() {
  if (browserPromise) {
    try {
      const existing = await browserPromise;
      if (existing.isConnected()) return existing;
    } catch {
      /* fall through to relaunch */
    }
    browserPromise = null;
  }
  browserPromise = chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  return browserPromise;
}

async function waitForImages(page) {
  await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return null;
        return new Promise((resolve) => {
          img.addEventListener("load", () => resolve(null), { once: true });
          img.addEventListener("error", () => resolve(null), { once: true });
        });
      })
    );
  });
}

function safeFilename(value) {
  return String(value || "")
    .replace(/[‐-―]/g, "-") // unicode dashes → ascii
    .replace(/[\\/:*?"<>|\n\r\t]/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Laporan";
}

const PHOTO_URL_RE = /^\/api\/report-drafts\/([^/]+)\/photos\/([^/]+)\/([^/?#]+)/;

async function inlinePhotoUrls(draft) {
  if (!draft) return draft;
  const storage = getPhotoStorage();

  async function resolveImage(photo) {
    if (!photo?.imageUrl && !photo?.gdriveFileId) return photo;
    const match = photo.imageUrl ? PHOTO_URL_RE.exec(photo.imageUrl) : null;
    const [, draftId, section, filename] = match || [
      null,
      "",
      photo.section || "menu",
      photo.filename || "",
    ];
    try {
      const dataUri = await storage.toDataUri({
        draftId,
        section,
        filename,
        gdriveFileId: photo.gdriveFileId || null,
      });
      if (dataUri) photo.imageUrl = dataUri;
    } catch {
      /* keep original url on failure */
    }
    return photo;
  }

  const cloned = JSON.parse(JSON.stringify(draft));
  if (Array.isArray(cloned.activityPhotos)) {
    for (const photo of cloned.activityPhotos) {
      await resolveImage(photo);
    }
  }
  if (Array.isArray(cloned.menuPhotos)) {
    for (const photo of cloned.menuPhotos) {
      await resolveImage(photo);
    }
  }
  return cloned;
}

export async function generateReportPdf({ draft, draftId, baseUrl }) {
  if (!draft || !draftId) {
    throw new Error("draft & draftId wajib diisi untuk generateReportPdf");
  }

  const inlinedDraft = await inlinePhotoUrls(draft);
  const html = renderPreviewHtml(inlinedDraft, { mode: "pdf", baseUrl });
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    await waitForImages(page);
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const dir = path.join(PDF_ROOT, draftId);
    await mkdir(dir, { recursive: true });

    const periodLabel = safeFilename(draft?.report?.periodLabel || "Laporan");
    const sppg = safeFilename(draft?.report?.sppgName || "SPPG");
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, "")
      .slice(0, 14);
    const filename = `${periodLabel} - ${sppg} - ${stamp}.pdf`;
    const filePath = path.join(dir, filename);
    await writeFile(filePath, buffer);

    return {
      filename,
      absolutePath: filePath,
      relativePath: path.relative(PDF_ROOT, filePath),
      downloadUrl: `/api/report-drafts/${draftId}/pdf?file=${encodeURIComponent(filename)}`,
    };
  } finally {
    await context.close();
  }
}

export async function closePdfBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch {
      /* ignore */
    } finally {
      browserPromise = null;
    }
  }
}

export const PDF_ROOT_PATH = PDF_ROOT;
