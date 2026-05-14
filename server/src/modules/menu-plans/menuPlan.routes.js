import express from "express";
import multer from "multer";
import {
  createMenuPlan,
  deleteMenuPlan,
  extractMenuPlanImage,
  getMenuPlanByDate,
  getMenuPlanById,
  listMenuPlans,
  updateMenuPlan,
} from "./menuPlan.controller.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.get("/", listMenuPlans);
router.post("/extract-image", upload.single("image"), extractMenuPlanImage);
router.get("/by-date/:date", getMenuPlanByDate);
router.get("/:id", getMenuPlanById);
router.post("/", createMenuPlan);
router.put("/:id", updateMenuPlan);
router.delete("/:id", deleteMenuPlan);

export default router;
