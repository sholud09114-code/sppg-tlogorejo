import express from "express";
import { getAllUnits } from "../controllers/schoolController.js";

const router = express.Router();

router.get("/", getAllUnits);

export default router;
