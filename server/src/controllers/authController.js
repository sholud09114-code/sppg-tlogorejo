import pool from "../config/db.js";
import { signToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
  };
}

export async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      username VARCHAR(80) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'publik') NOT NULL DEFAULT 'publik',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_username (username),
      INDEX idx_users_role (role)
    ) ENGINE=InnoDB
  `);
}

export async function seedDefaultUsers() {
  const [[countRow]] = await pool.query("SELECT COUNT(*) AS total FROM users");
  if (Number(countRow.total || 0) > 0) {
    return;
  }

  const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin12345";
  const publicUsername = process.env.DEFAULT_PUBLIC_USERNAME || "publik";
  const publicPassword = process.env.DEFAULT_PUBLIC_PASSWORD || "publik12345";

  await pool.query(
    `INSERT INTO users (name, username, password_hash, role)
     VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
    [
      process.env.DEFAULT_ADMIN_NAME || "Admin SPPG",
      adminUsername,
      hashPassword(adminPassword),
      "admin",
      process.env.DEFAULT_PUBLIC_NAME || "Publik",
      publicUsername,
      hashPassword(publicPassword),
      "publik",
    ]
  );
}

export async function bootstrapAuth() {
  await ensureUsersTable();
  await seedDefaultUsers();
}

export async function login(req, res, next) {
  try {
    await ensureUsersTable();

    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi." });
    }

    const [[user]] = await pool.query(
      `SELECT id, name, username, password_hash, role
         FROM users
        WHERE username = ?
        LIMIT 1`,
      [username]
    );

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Username atau password salah." });
    }

    const safeUser = publicUser(user);
    const token = signToken(safeUser);
    res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    await ensureUsersTable();

    const [[user]] = await pool.query(
      `SELECT id, name, username, role
         FROM users
        WHERE id = ?
        LIMIT 1`,
      [req.user?.id]
    );

    if (!user) {
      return res.status(401).json({ error: "User tidak ditemukan." });
    }

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}
