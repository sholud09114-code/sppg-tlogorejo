import { google } from "googleapis";
import { Readable } from "node:stream";
import pool from "../../config/db.js";

const SETTING_KEYS = {
  REFRESH_TOKEN: "gdrive_refresh_token",
  ROOT_FOLDER_ID: "gdrive_root_folder_id",
  CONNECTED_EMAIL: "gdrive_connected_email",
};

const ROOT_FOLDER_NAME = "SPPG Tlogorejo";
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
];

async function ensureSettingsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS report_settings (
       setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
       setting_value MEDIUMTEXT NULL,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
     ) ENGINE=InnoDB`
  );
}

export async function getSetting(key) {
  await ensureSettingsTable();
  const [rows] = await pool.query(
    `SELECT setting_value FROM report_settings WHERE setting_key = ? LIMIT 1`,
    [key]
  );
  return rows[0]?.setting_value ?? null;
}

export async function setSetting(key, value) {
  await ensureSettingsTable();
  await pool.query(
    `INSERT INTO report_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value == null ? null : String(value)]
  );
}

export async function clearSetting(key) {
  await ensureSettingsTable();
  await pool.query(`DELETE FROM report_settings WHERE setting_key = ?`, [key]);
}

function getOAuth2Client() {
  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const redirectUri = process.env.GDRIVE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    const err = new Error(
      "Google Drive belum dikonfigurasi. Set GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REDIRECT_URI di .env."
    );
    err.status = 500;
    err.code = "GDRIVE_NOT_CONFIGURED";
    throw err;
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function isGdriveConfigured() {
  return Boolean(
    process.env.GDRIVE_CLIENT_ID &&
      process.env.GDRIVE_CLIENT_SECRET &&
      process.env.GDRIVE_REDIRECT_URI
  );
}

export async function getAuthUrl(state = "") {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code) {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    const err = new Error(
      "Google Drive tidak mengembalikan refresh token. Cabut akses di myaccount.google.com lalu coba hubungkan ulang."
    );
    err.status = 400;
    throw err;
  }
  oauth2.setCredentials(tokens);

  const oauthApi = google.oauth2({ version: "v2", auth: oauth2 });
  let email = null;
  try {
    const res = await oauthApi.userinfo.get();
    email = res?.data?.email || null;
  } catch {
    /* ignore */
  }

  await setSetting(SETTING_KEYS.REFRESH_TOKEN, tokens.refresh_token);
  if (email) await setSetting(SETTING_KEYS.CONNECTED_EMAIL, email);

  await ensureRootFolder();
  return { email };
}

export async function getDriveStatus() {
  if (!isGdriveConfigured()) {
    return { configured: false, connected: false };
  }
  const refreshToken = await getSetting(SETTING_KEYS.REFRESH_TOKEN);
  const email = await getSetting(SETTING_KEYS.CONNECTED_EMAIL);
  const rootFolderId = await getSetting(SETTING_KEYS.ROOT_FOLDER_ID);
  return {
    configured: true,
    connected: Boolean(refreshToken),
    email,
    rootFolderId,
  };
}

export async function disconnectDrive() {
  const refreshToken = await getSetting(SETTING_KEYS.REFRESH_TOKEN);
  if (refreshToken) {
    try {
      const oauth2 = getOAuth2Client();
      oauth2.setCredentials({ refresh_token: refreshToken });
      await oauth2.revokeCredentials();
    } catch {
      /* ignore revoke errors — still clear locally */
    }
  }
  await clearSetting(SETTING_KEYS.REFRESH_TOKEN);
  await clearSetting(SETTING_KEYS.CONNECTED_EMAIL);
  await clearSetting(SETTING_KEYS.ROOT_FOLDER_ID);
}

async function getAuthenticatedClient() {
  const refreshToken = await getSetting(SETTING_KEYS.REFRESH_TOKEN);
  if (!refreshToken) {
    const err = new Error(
      "Google Drive belum terhubung. Buka halaman Dokumentasi dan klik Hubungkan Google Drive."
    );
    err.status = 412;
    err.code = "GDRIVE_NOT_CONNECTED";
    throw err;
  }
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

async function getDrive() {
  const auth = await getAuthenticatedClient();
  return google.drive({ version: "v3", auth });
}

async function findFolder(drive, name, parentId) {
  const q = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
    parentId ? `'${parentId}' in parents` : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1,
    spaces: "drive",
  });
  return res.data.files?.[0] || null;
}

async function createFolder(drive, name, parentId) {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id, name",
  });
  return res.data;
}

async function ensureFolderPath(drive, segments, rootId) {
  let parentId = rootId;
  for (const segment of segments) {
    const existing = await findFolder(drive, segment, parentId);
    if (existing) {
      parentId = existing.id;
    } else {
      const created = await createFolder(drive, segment, parentId);
      parentId = created.id;
    }
  }
  return parentId;
}

export async function ensureRootFolder() {
  const cached = await getSetting(SETTING_KEYS.ROOT_FOLDER_ID);
  const drive = await getDrive();
  if (cached) {
    try {
      await drive.files.get({ fileId: cached, fields: "id, trashed" });
      return cached;
    } catch {
      /* fallthrough — recreate */
    }
  }
  let folder = await findFolder(drive, ROOT_FOLDER_NAME, null);
  if (!folder) folder = await createFolder(drive, ROOT_FOLDER_NAME, null);
  await setSetting(SETTING_KEYS.ROOT_FOLDER_ID, folder.id);
  return folder.id;
}

export async function uploadFile({ buffer, mimeType, name, folderSegments = [] }) {
  const rootId = await ensureRootFolder();
  const drive = await getDrive();
  const parentId = await ensureFolderPath(drive, folderSegments, rootId);

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields:
      "id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, parents",
    supportsAllDrives: false,
  });

  return res.data;
}

export async function deleteFile(fileId) {
  if (!fileId) return;
  const drive = await getDrive();
  try {
    await drive.files.delete({ fileId });
  } catch (err) {
    if (err?.code === 404) return;
    throw err;
  }
}

export async function getFileMeta(fileId) {
  const drive = await getDrive();
  const res = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, size, webViewLink, thumbnailLink, parents",
  });
  return res.data;
}

export async function getFileStream(fileId) {
  const drive = await getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );
  return res.data;
}

export async function getThumbnailBuffer(fileId, sizePx = 600) {
  const meta = await getFileMeta(fileId);
  const link = meta.thumbnailLink;
  if (!link) return null;

  const sized = link.replace(/=s\d+$/, `=s${sizePx}`);
  const auth = await getAuthenticatedClient();
  const tokens = await auth.getAccessToken();
  const accessToken = tokens?.token;
  if (!accessToken) return null;

  const res = await fetch(sized, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: res.headers.get("content-type") || "image/jpeg",
  };
}

export const GDRIVE_SETTING_KEYS = SETTING_KEYS;
