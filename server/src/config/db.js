import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

function isEnabled(value) {
  return ["1", "true", "yes", "on", "required"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function buildSslOptions() {
  if (!isEnabled(process.env.DB_SSL)) {
    return undefined;
  }

  const ssl = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  };

  if (process.env.DB_SSL_CA) {
    ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, "\n");
  }

  return ssl;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sppg_tlogorejo",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  ssl: buildSslOptions(),
});

export default pool;
