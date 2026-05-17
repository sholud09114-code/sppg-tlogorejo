import express from "express";
import {
  disconnectDrive,
  exchangeCodeForTokens,
  getAuthUrl,
  getDriveStatus,
  getThumbnailBuffer,
  isGdriveConfigured,
} from "./gdrive.service.js";

const router = express.Router();

router.get("/status", async (req, res, next) => {
  try {
    const status = await getDriveStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// Returns the auth URL the client should redirect to.
router.get("/oauth/start", async (req, res, next) => {
  try {
    if (!isGdriveConfigured()) {
      return res.status(412).json({
        error:
          "Google Drive belum dikonfigurasi. Set GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REDIRECT_URI di server/.env.",
      });
    }
    const state = String(req.query.return_to || "");
    const url = await getAuthUrl(state);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

async function oauthCallbackHandler(req, res, next) {
  const sendPage = (status, message) => {
    const safe = String(message).replace(/</g, "&lt;");
    const ok = status === "success";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html><head><meta charset="utf-8"/><title>Google Drive ${ok ? "Terhubung" : "Gagal"}</title>
<style>body{font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#f3f4f6;color:#0f172a}.card{background:white;border-radius:12px;padding:32px;max-width:420px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.08)}.ok{color:#059669}.err{color:#b91c1c}button{margin-top:16px;padding:8px 16px;border-radius:8px;border:1px solid #cbd5e1;background:white;cursor:pointer}</style>
</head><body><div class="card"><h2 class="${ok ? "ok" : "err"}">${ok ? "Google Drive terhubung" : "Gagal menghubungkan Drive"}</h2><p>${safe}</p><button onclick="window.close()">Tutup tab ini</button></div>
<script>try{window.opener&&window.opener.postMessage({type:"gdrive-oauth",status:${JSON.stringify(status)}},"*");}catch(e){}</script>
</body></html>`);
  };

  try {
    const code = String(req.query.code || "");
    if (!code) {
      return sendPage("error", "Kode otorisasi kosong. Coba ulangi proses.");
    }
    const result = await exchangeCodeForTokens(code);
    sendPage(
      "success",
      `Akun ${result.email || "Google"} berhasil terhubung. Halaman Dokumentasi siap dipakai.`
    );
  } catch (err) {
    sendPage("error", err.message || "Terjadi kesalahan tidak terduga.");
  }
}

// Google redirects user-agent here. The "/" alias is used by the pre-auth
// mount at /api/gdrive/oauth/callback in app.js.
router.get("/", oauthCallbackHandler);
router.get("/oauth/callback", oauthCallbackHandler);

router.post("/disconnect", async (req, res, next) => {
  try {
    await disconnectDrive();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/thumbnail/:fileId", async (req, res, next) => {
  try {
    const size = Math.min(2000, Math.max(64, Number(req.query.s) || 600));
    const result = await getThumbnailBuffer(req.params.fileId, size);
    if (!result) {
      return res.status(404).json({ error: "Thumbnail tidak tersedia" });
    }
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.end(result.buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
