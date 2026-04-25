import express from "express";
import {
  createBeneficiaryGroup,
  deleteBeneficiaryGroup,
  getBeneficiaryGroupById,
  importBeneficiaryGroups,
  listBeneficiaryGroups,
  previewBeneficiaryGroupImport,
  updateBeneficiaryGroup,
} from "../controllers/beneficiaryGroupController.js";

const router = express.Router();

router.get("/", listBeneficiaryGroups);
router.post("/import/preview", previewBeneficiaryGroupImport);
router.post("/import", importBeneficiaryGroups);
router.get("/:id", getBeneficiaryGroupById);
router.post("/", createBeneficiaryGroup);
router.put("/:id", updateBeneficiaryGroup);
router.delete("/:id", deleteBeneficiaryGroup);

export default router;
