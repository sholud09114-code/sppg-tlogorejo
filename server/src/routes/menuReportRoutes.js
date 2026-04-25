import express from "express";
import multer from "multer";
import {
  createMenuReport,
  deleteMenuReport,
  extractMenuReportImage,
  getMenuReportById,
  listMenuReports,
  updateMenuReport,
} from "../controllers/menuReportController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.get("/", listMenuReports);
router.post("/extract-image", upload.single("image"), extractMenuReportImage);
router.get("/:id", getMenuReportById);
router.post("/", createMenuReport);
router.put("/:id", updateMenuReport);
router.delete("/:id", deleteMenuReport);

export default router;
