import express from "express";
import {
  createFoodWaste,
  deleteFoodWaste,
  getFoodWasteById,
  getFoodWasteMenuReference,
  listFoodWasteReports,
  updateFoodWaste,
} from "../controllers/foodWasteController.js";

const router = express.Router();

router.get("/", listFoodWasteReports);
router.get("/menu-reference", getFoodWasteMenuReference);
router.get("/:id", getFoodWasteById);
router.post("/", createFoodWaste);
router.put("/:id", updateFoodWaste);
router.delete("/:id", deleteFoodWaste);

export default router;
