import express from "express";
import multer from "multer";
import {
  createHandler,
  deleteHandler,
  getHandler,
  listHandler,
  thumbnailHandler,
  updateHandler,
} from "./documentation.controller.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!/^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i.test(file.mimetype)) {
      cb(new Error("Format gambar tidak didukung. Gunakan JPG/PNG/WebP/GIF."));
      return;
    }
    cb(null, true);
  },
});

router.get("/", listHandler);
router.post("/", upload.single("file"), createHandler);
router.get("/:id", getHandler);
router.put("/:id", updateHandler);
router.delete("/:id", deleteHandler);
router.get("/:id/thumbnail", thumbnailHandler);

export default router;
