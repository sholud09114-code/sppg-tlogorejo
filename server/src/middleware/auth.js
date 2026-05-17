import { verifyToken } from "../utils/jwt.js";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, headerToken] = authHeader.split(" ");

  let token = scheme === "Bearer" ? headerToken : null;
  if (!token && (req.method === "GET" || req.method === "HEAD") && req.query?.token) {
    token = String(req.query.token);
  }

  if (!token) {
    return res.status(401).json({ error: "Token autentikasi wajib dikirim." });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: err.message || "Token tidak valid." });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role === "admin") {
    return next();
  }

  return res.status(403).json({ error: "Akses ditolak. Role admin diperlukan." });
}

export function requireAdminForMutations(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  return requireAdmin(req, res, next);
}
