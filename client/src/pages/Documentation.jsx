import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildDocumentationThumbnailUrl,
  deleteDocumentationPhoto,
  listDocumentationPhotos,
  PHOTO_TYPES,
  PHOTO_TYPE_LABEL,
  updateDocumentationPhoto,
  uploadDocumentationPhoto,
} from "../api/documentationApi.js";
import {
  disconnectGdrive,
  fetchGdriveStatus,
  startGdriveOAuth,
} from "../api/gdriveApi.js";
import Toast from "../components/Toast.jsx";
import LoadingMessage from "../components/LoadingMessage.jsx";
import "../styles/documentation.css";

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function formatHumanDate(iso) {
  if (!iso) return "";
  const ID_MONTHS = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember",
  ];
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${ID_MONTHS[m - 1]} ${y}`;
}

export default function Documentation() {
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [filters, setFilters] = useState(() => ({
    photo_type: "",
    start_date: addDaysISO(todayISO(), -30),
    end_date: todayISO(),
  }));
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(() => ({
    photo_type: "menu_daily",
    photo_date: todayISO(),
    title: "",
    notes: "",
    file: null,
  }));
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState({ kind: null, message: null });
  const fileInputRef = useRef(null);

  const refreshStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const next = await fetchGdriveStatus();
      setStatus(next);
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal memuat status Drive: ${err.message}` });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const refreshList = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await listDocumentationPhotos({
        photoType: filters.photo_type || undefined,
        startDate: filters.start_date || undefined,
        endDate: filters.end_date || undefined,
      });
      setItems(res.items || []);
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal memuat daftar foto: ${err.message}` });
    } finally {
      setLoadingList(false);
    }
  }, [filters.end_date, filters.photo_type, filters.start_date]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (status?.connected) refreshList();
  }, [refreshList, status?.connected]);

  useEffect(() => {
    function onMessage(event) {
      if (event.data?.type === "gdrive-oauth") {
        if (event.data.status === "success") {
          setToast({ kind: "success", message: "Google Drive berhasil terhubung." });
          refreshStatus();
          refreshList();
        } else {
          setToast({ kind: "danger", message: "Google Drive gagal terhubung. Coba lagi." });
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refreshList, refreshStatus]);

  async function handleConnect() {
    try {
      const res = await startGdriveOAuth();
      const popup = window.open(res.url, "gdrive_oauth", "width=520,height=640");
      if (!popup) {
        setToast({ kind: "warning", message: "Browser memblokir popup. Izinkan popup untuk situs ini." });
      }
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal mulai OAuth: ${err.message}` });
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Putuskan koneksi Google Drive? File yang sudah diupload tetap ada di Drive Anda.")) return;
    try {
      await disconnectGdrive();
      setItems([]);
      await refreshStatus();
      setToast({ kind: "success", message: "Google Drive diputus dari aplikasi." });
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal disconnect: ${err.message}` });
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!form.file) {
      setToast({ kind: "warning", message: "Pilih file foto dulu." });
      return;
    }
    if (!form.photo_type || !form.photo_date) {
      setToast({ kind: "warning", message: "Jenis dokumentasi dan tanggal wajib diisi." });
      return;
    }
    try {
      setUploading(true);
      await uploadDocumentationPhoto({
        photoType: form.photo_type,
        photoDate: form.photo_date,
        title: form.title.trim(),
        notes: form.notes.trim(),
        file: form.file,
      });
      setForm((prev) => ({ ...prev, title: "", notes: "", file: null }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshList();
      setToast({ kind: "success", message: "Foto berhasil diupload ke Google Drive." });
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal upload: ${err.message}` });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Hapus "${item.title || item.id.slice(0, 8)}"? File di Google Drive juga akan dihapus.`)) {
      return;
    }
    try {
      await deleteDocumentationPhoto(item.id);
      await refreshList();
      setToast({ kind: "success", message: "Foto dihapus." });
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal hapus: ${err.message}` });
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    try {
      await updateDocumentationPhoto(editing.id, {
        photo_type: editing.photo_type,
        photo_date: editing.photo_date,
        title: editing.title || "",
        notes: editing.notes || "",
      });
      setEditing(null);
      await refreshList();
      setToast({ kind: "success", message: "Metadata diperbarui." });
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal update: ${err.message}` });
    }
  }

  const groupedByType = useMemo(() => {
    const groups = new Map();
    items.forEach((item) => {
      const list = groups.get(item.photo_type) || [];
      list.push(item);
      groups.set(item.photo_type, list);
    });
    return groups;
  }, [items]);

  return (
    <section className="feature-page-card documentation-page">
      <div className="page-title gap-4">
        <div className="min-w-0">
          <h2>Dokumentasi</h2>
          <p>
            Kelola dokumentasi foto Menu Harian, Distribusi, dan Kegiatan Lain. File disimpan
            di folder <strong>SPPG Tlogorejo</strong> di Google Drive Anda.
          </p>
        </div>
      </div>

      <DriveStatusBar
        status={status}
        loading={statusLoading}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {!status?.configured ? (
        <div className="documentation-onboard">
          <h3>Setup Google Drive (sekali saja)</h3>
          <ol>
            <li>Buka Google Cloud Console → buat project (mis. <em>sppg-tlogorejo</em>).</li>
            <li>APIs &amp; Services → Library → enable <strong>Google Drive API</strong>.</li>
            <li>OAuth consent screen → External → tambahkan email Anda sebagai test user.</li>
            <li>
              Credentials → Create OAuth client ID → Web application. Tambahkan redirect URI:{" "}
              <code>http://localhost:4000/api/gdrive/oauth/callback</code>
            </li>
            <li>Salin Client ID + Client Secret → tambah ke <code>server/.env</code>:</li>
          </ol>
          <pre className="documentation-code">
{`GDRIVE_CLIENT_ID=...
GDRIVE_CLIENT_SECRET=...
GDRIVE_REDIRECT_URI=http://localhost:4000/api/gdrive/oauth/callback`}
          </pre>
          <p>Restart backend, lalu refresh halaman ini.</p>
        </div>
      ) : !status?.connected ? (
        <div className="documentation-onboard">
          <h3>Hubungkan akun Google Drive</h3>
          <p>Klik tombol di atas untuk mengizinkan aplikasi mengakses folder Drive Anda.</p>
        </div>
      ) : (
        <>
          <UploadForm
            form={form}
            setForm={setForm}
            onSubmit={handleUpload}
            uploading={uploading}
            fileInputRef={fileInputRef}
          />

          <Filters filters={filters} setFilters={setFilters} onRefresh={refreshList} />

          {loadingList ? (
            <LoadingMessage>Memuat foto...</LoadingMessage>
          ) : items.length === 0 ? (
            <div className="empty-state mt-4">
              Belum ada foto pada rentang ini. Upload foto baru di atas.
            </div>
          ) : (
            <div className="documentation-groups">
              {PHOTO_TYPES.map(({ value, label }) => {
                const list = groupedByType.get(value) || [];
                if (!list.length) return null;
                return (
                  <section key={value}>
                    <h3>{label} <span className="documentation-count">{list.length}</span></h3>
                    <div className="documentation-grid">
                      {list.map((item) => (
                        <PhotoCard
                          key={item.id}
                          item={item}
                          onDelete={() => handleDelete(item)}
                          onEdit={() => setEditing({ ...item })}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {editing ? (
        <EditModal editing={editing} setEditing={setEditing} onSave={handleSaveEdit} />
      ) : null}

      <Toast kind={toast.kind} message={toast.message} />
    </section>
  );
}

function DriveStatusBar({ status, loading, onConnect, onDisconnect }) {
  if (loading) {
    return <div className="documentation-status loading">Memeriksa status Google Drive...</div>;
  }
  if (!status?.configured) {
    return (
      <div className="documentation-status warning">
        <strong>Google Drive belum dikonfigurasi.</strong> Lihat instruksi di bawah.
      </div>
    );
  }
  if (!status.connected) {
    return (
      <div className="documentation-status warning">
        <span><strong>Belum terhubung.</strong> Klik untuk login & izinkan akses Drive.</span>
        <button type="button" className="submit-btn" onClick={onConnect}>
          Hubungkan Google Drive
        </button>
      </div>
    );
  }
  return (
    <div className="documentation-status ok">
      <span>
        Terhubung sebagai <strong>{status.email || "akun Google"}</strong>. Folder root:{" "}
        <code>SPPG Tlogorejo</code>.
      </span>
      <button type="button" className="action-btn-secondary" onClick={onDisconnect}>
        Putuskan koneksi
      </button>
    </div>
  );
}

function UploadForm({ form, setForm, onSubmit, uploading, fileInputRef }) {
  return (
    <form className="documentation-upload-form" onSubmit={onSubmit}>
      <h3>Upload foto baru</h3>
      <div className="documentation-grid-form">
        <label>
          Jenis dokumentasi
          <select
            value={form.photo_type}
            onChange={(e) => setForm((f) => ({ ...f, photo_type: e.target.value }))}
          >
            {PHOTO_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label>
          Tanggal dokumentasi
          <input
            type="date"
            value={form.photo_date}
            onChange={(e) => setForm((f) => ({ ...f, photo_date: e.target.value }))}
          />
        </label>
        <label>
          Judul (opsional)
          <input
            type="text"
            placeholder="cth: Menu MBG SD Negeri Tlogorejo"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label>
          File foto
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
          />
        </label>
        <label className="full-row">
          Catatan (opsional)
          <textarea
            rows={2}
            placeholder="Catatan tambahan, mis. lokasi atau tim yang bertugas"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
      </div>
      <div className="documentation-form-actions">
        <button type="submit" className="submit-btn" disabled={uploading || !form.file}>
          {uploading ? "Mengupload..." : "Upload ke Google Drive"}
        </button>
      </div>
    </form>
  );
}

function Filters({ filters, setFilters, onRefresh }) {
  return (
    <div className="documentation-filters">
      <label>
        Filter jenis
        <select
          value={filters.photo_type}
          onChange={(e) => setFilters((f) => ({ ...f, photo_type: e.target.value }))}
        >
          <option value="">Semua jenis</option>
          {PHOTO_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>
      <label>
        Dari
        <input
          type="date"
          value={filters.start_date}
          onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
        />
      </label>
      <label>
        Sampai
        <input
          type="date"
          value={filters.end_date}
          onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
        />
      </label>
      <button type="button" className="action-btn-secondary" onClick={onRefresh}>Refresh</button>
    </div>
  );
}

function PhotoCard({ item, onDelete, onEdit }) {
  const thumb = buildDocumentationThumbnailUrl(item.id, 600);
  return (
    <article className="documentation-card">
      <a href={item.gdrive_view_url || "#"} target="_blank" rel="noreferrer" className="documentation-card-img">
        <img loading="lazy" alt={item.title || ""} src={thumb} />
      </a>
      <div className="documentation-card-meta">
        <strong>{item.title || PHOTO_TYPE_LABEL[item.photo_type]}</strong>
        <span>{formatHumanDate(item.photo_date)} · {PHOTO_TYPE_LABEL[item.photo_type]}</span>
        {item.notes ? <p className="muted">{item.notes}</p> : null}
      </div>
      <div className="documentation-card-actions">
        <button type="button" onClick={onEdit}>Edit</button>
        <a href={item.gdrive_view_url || "#"} target="_blank" rel="noreferrer">Buka di Drive</a>
        <button type="button" className="danger" onClick={onDelete}>Hapus</button>
      </div>
    </article>
  );
}

function EditModal({ editing, setEditing, onSave }) {
  return (
    <div className="documentation-modal-backdrop" onClick={() => setEditing(null)}>
      <div className="documentation-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Edit metadata</h3>
        <label>
          Jenis
          <select
            value={editing.photo_type}
            onChange={(e) => setEditing({ ...editing, photo_type: e.target.value })}
          >
            {PHOTO_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label>
          Tanggal
          <input
            type="date"
            value={editing.photo_date || ""}
            onChange={(e) => setEditing({ ...editing, photo_date: e.target.value })}
          />
        </label>
        <label>
          Judul
          <input
            value={editing.title || ""}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          />
        </label>
        <label>
          Catatan
          <textarea
            rows={3}
            value={editing.notes || ""}
            onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
          />
        </label>
        <div className="documentation-modal-actions">
          <button type="button" className="action-btn-secondary" onClick={() => setEditing(null)}>Batal</button>
          <button type="button" className="submit-btn" onClick={onSave}>Simpan</button>
        </div>
      </div>
    </div>
  );
}
