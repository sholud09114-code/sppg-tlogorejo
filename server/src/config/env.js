const PLACEHOLDER_JWT_SECRET =
  "replace-with-a-long-random-secret-generated-for-this-environment";

function hasValue(value) {
  return String(value || "").trim().length > 0;
}

function isLocalhostUrl(value) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(
    String(value || "").trim()
  );
}

function splitOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isProductionEnv() {
  return process.env.NODE_ENV === "production";
}

export function assertRuntimeConfig() {
  const errors = [];
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();

  if (!jwtSecret) {
    errors.push("JWT_SECRET wajib diisi.");
  } else if (jwtSecret === PLACEHOLDER_JWT_SECRET) {
    errors.push("JWT_SECRET masih memakai nilai contoh.");
  } else if (isProductionEnv() && jwtSecret.length < 32) {
    errors.push("JWT_SECRET production minimal 32 karakter.");
  }

  if (!isProductionEnv()) {
    if (errors.length > 0) {
      throw new Error(`Konfigurasi runtime tidak valid:\n- ${errors.join("\n- ")}`);
    }
    return;
  }

  const clientOrigins = splitOrigins(process.env.CLIENT_URL);
  if (clientOrigins.length === 0) {
    errors.push("CLIENT_URL wajib diisi di production.");
  }
  if (clientOrigins.some(isLocalhostUrl)) {
    errors.push("CLIENT_URL production tidak boleh memakai localhost.");
  }

  if (!hasValue(process.env.DB_HOST)) {
    errors.push("DB_HOST wajib diisi di production.");
  }
  if (!hasValue(process.env.DB_USER)) {
    errors.push("DB_USER wajib diisi di production.");
  }
  if (String(process.env.DB_USER || "").trim() === "root") {
    errors.push("DB_USER production sebaiknya bukan root.");
  }
  if (!hasValue(process.env.DB_PASSWORD)) {
    errors.push("DB_PASSWORD wajib diisi di production.");
  }
  if (!hasValue(process.env.DB_NAME)) {
    errors.push("DB_NAME wajib diisi di production.");
  }

  if (!hasValue(process.env.DEFAULT_ADMIN_PASSWORD)) {
    errors.push("DEFAULT_ADMIN_PASSWORD wajib diisi di production.");
  } else if (process.env.DEFAULT_ADMIN_PASSWORD === "admin12345") {
    errors.push("DEFAULT_ADMIN_PASSWORD masih memakai nilai contoh.");
  }

  if (!hasValue(process.env.DEFAULT_PUBLIC_PASSWORD)) {
    errors.push("DEFAULT_PUBLIC_PASSWORD wajib diisi di production.");
  } else if (process.env.DEFAULT_PUBLIC_PASSWORD === "publik12345") {
    errors.push("DEFAULT_PUBLIC_PASSWORD masih memakai nilai contoh.");
  }

  if (errors.length > 0) {
    throw new Error(`Konfigurasi production tidak valid:\n- ${errors.join("\n- ")}`);
  }
}
