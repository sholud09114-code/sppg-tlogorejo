import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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
import { assertJwtSecretConfigured } from "./utils/jwt.js";

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const allowedClientOrigins = String(process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedClientOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (!isProduction && localhostOriginPattern.test(origin)) {
      return callback(null, true);
    }

    const error = new Error("Origin not allowed by CORS.");
    error.status = 403;
    return callback(error);
  },
};

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan login. Coba lagi nanti." },
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "SPPG API", time: new Date().toISOString() });
});

// Auth routes
app.use("/api/auth/login", loginRateLimiter);
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
  assertJwtSecretConfigured();
  await bootstrapAuth();
  app.listen(PORT, () => {
    console.log(`SPPG API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start SPPG API", err);
  process.exit(1);
});
