import crypto from "crypto";

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlDecode(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) {
    throw new Error(
      "JWT_SECRET is required. Set JWT_SECRET in server/.env before starting the API."
    );
  }
  return secret;
}

export function assertJwtSecretConfigured() {
  getJwtSecret();
}

function signInput(input) {
  return crypto
    .createHmac("sha256", getJwtSecret())
    .update(input)
    .digest("base64url");
}

function parseExpiresIn(value) {
  const raw = String(value || "8h").trim();
  const match = raw.match(/^(\d+)([smhd])$/i);
  if (!match) return 8 * 60 * 60;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "s") return amount;
  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 60 * 60;
  return amount * 24 * 60 * 60;
}

export function signToken(payload, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    iat: now,
    exp: now + parseExpiresIn(options.expiresIn || process.env.JWT_EXPIRES_IN),
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedBody = base64UrlEncode(body);
  const input = `${encodedHeader}.${encodedBody}`;
  return `${input}.${signInput(input)}`;
}

export function verifyToken(token) {
  const [encodedHeader, encodedBody, signature] = String(token || "").split(".");
  if (!encodedHeader || !encodedBody || !signature) {
    throw new Error("Token tidak valid.");
  }

  const input = `${encodedHeader}.${encodedBody}`;
  const expectedSignature = signInput(input);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error("Token tidak valid.");
  }

  const payload = base64UrlDecode(encodedBody);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error("Token sudah kedaluwarsa.");
  }

  return payload;
}
