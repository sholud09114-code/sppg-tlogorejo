import express from "express";
import multer from "multer";
import {
  createShoppingReport,
  deleteShoppingReport,
  extractShoppingReportImage,
  getShoppingReportById,
  listShoppingReports,
  updateShoppingReport,
} from "../controllers/shoppingReportController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.get("/", listShoppingReports);
router.post("/extract-image", upload.single("image"), extractShoppingReportImage);
router.get("/:id", getShoppingReportById);
router.post("/", createShoppingReport);
router.put("/:id", updateShoppingReport);
router.delete("/:id", deleteShoppingReport);

export default router;
