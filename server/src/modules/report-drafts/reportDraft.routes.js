import express from "express";
import multer from "multer";
import {
  deleteDraftHandler,
  deletePhotoHandler,
  downloadDraftPdfHandler,
  generateDraftHandler,
  generateDraftPdfHandler,
  getDraftHandler,
  listDraftsHandler,
  previewDraftHandler,
  servePhotoHandler,
  updateDraftHandler,
  uploadPhotoHandler,
} from "./reportDraft.controller.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype)) {
      cb(new Error("Format gambar tidak didukung. Gunakan JPG/PNG/WebP/GIF."));
      return;
    }
    cb(null, true);
  },
});

router.post("/generate", generateDraftHandler);
router.get("/", listDraftsHandler);
router.get("/:id", getDraftHandler);
router.put("/:id", updateDraftHandler);
router.delete("/:id", deleteDraftHandler);

router.get("/:id/preview", previewDraftHandler);
router.post("/:id/pdf", generateDraftPdfHandler);
router.get("/:id/pdf", downloadDraftPdfHandler);

router.post("/:id/photos/:section", upload.single("file"), uploadPhotoHandler);
router.delete("/:id/photos/:section/:filename", deletePhotoHandler);
router.get("/:id/photos/:section/:filename", servePhotoHandler);

export default router;
