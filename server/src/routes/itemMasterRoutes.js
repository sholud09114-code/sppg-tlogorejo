import express from "express";
import {
  createItemMaster,
  deleteItemMaster,
  getItemMasterById,
  getPriceIncreaseDetection,
  getItemPriceMonitoring,
  listItemMasters,
  updateItemMaster,
} from "../controllers/itemMasterController.js";

const router = express.Router();

router.get("/", listItemMasters);
router.get("/price-monitoring", getItemPriceMonitoring);
router.get("/price-increase-detection", getPriceIncreaseDetection);
router.get("/:id", getItemMasterById);
router.post("/", createItemMaster);
router.put("/:id", updateItemMaster);
router.delete("/:id", deleteItemMaster);

export default router;
