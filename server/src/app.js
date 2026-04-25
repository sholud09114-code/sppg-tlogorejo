import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import schoolRoutes from "./routes/schoolRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import beneficiaryGroupRoutes from "./routes/beneficiaryGroupRoutes.js";
import menuReportRoutes from "./routes/menuReportRoutes.js";
import shoppingReportRoutes from "./routes/shoppingReportRoutes.js";
import itemMasterRoutes from "./routes/itemMasterRoutes.js";
import foodWasteRoutes from "./routes/foodWasteRoutes.js";
import homeRoutes from "./routes/homeRoutes.js";
import { bootstrapAuth } from "./controllers/authController.js";
import { authenticateToken, requireAdminForMutations } from "./middleware/auth.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "SPPG API", time: new Date().toISOString() });
});

// Auth routes
app.use("/api/auth", authRoutes);

// Protected data routes
app.use(authenticateToken);
app.use(requireAdminForMutations);
app.use("/api/units", schoolRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/beneficiary-groups", beneficiaryGroupRoutes);
app.use("/api/menu-reports", menuReportRoutes);
app.use("/api/shopping-reports", shoppingReportRoutes);
app.use("/api/item-masters", itemMasterRoutes);
app.use("/api/food-waste", foodWasteRoutes);
app.use("/api/home", homeRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 4000;

async function start() {
  await bootstrapAuth();
  app.listen(PORT, () => {
    console.log(`SPPG API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start SPPG API", err);
  process.exit(1);
});
