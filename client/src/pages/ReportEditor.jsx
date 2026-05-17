import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildPhotoSrc,
  deleteReportDraft,
  deleteReportPhoto,
  downloadReportPdf,
  fetchReportDraft,
  generateReportDraft,
  generateReportPdf,
  listReportDrafts,
  updateReportDraft,
  uploadReportPhoto,
} from "../api/reportDraftApi.js";
import { buildGdriveThumbnailUrl } from "../api/gdriveApi.js";
import { getAuthToken } from "../auth/tokenStorage.js";
import Toast from "../components/Toast.jsx";
import LoadingMessage from "../components/LoadingMessage.jsx";
import "../styles/report-editor.css";

const ID_MONTHS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];

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

function formatIdDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${ID_MONTHS[m - 1]} ${y}`;
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function moveItem(arr, from, to) {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return arr;
  }
  const next = [...arr];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export default function ReportEditor() {
  const [drafts, setDrafts] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [activeTab, setActiveTab] = useState("editor");
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState({ kind: null, message: null });
  const [filters, setFilters] = useState(() => ({
    start_date: addDaysISO(todayISO(), -6),
    end_date: todayISO(),
  }));
  const previewIframeRef = useRef(null);

  useEffect(() => {
    refreshList();
  }, []);

  async function refreshList() {
    try {
      const res = await listReportDrafts();
      setDrafts(res.drafts || []);
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal memuat daftar draft: ${err.message}` });
    }
  }

  async function handleGenerate() {
    if (!filters.start_date || !filters.end_date) {
      setToast({ kind: "warning", message: "Tanggal mulai dan selesai wajib diisi." });
      return;
    }
    if (filters.end_date < filters.start_date) {
      setToast({ kind: "warning", message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });
      return;
    }
    try {
      setGenerating(true);
      const created = await generateReportDraft({
        startDate: filters.start_date,
        endDate: filters.end_date,
      });
      setDraftId(created.id);
      setDraft(created);
      setActiveTab("editor");
      setDirty(false);
      await refreshList();
      setToast({ kind: "success", message: "Draft berhasil dibuat dari database." });
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal membuat draft: ${err.message}` });
    } finally {
      setGenerating(false);
    }
  }

  async function handleOpenDraft(id) {
    try {
      setLoadingDraft(true);
      const res = await fetchReportDraft(id);
      setDraftId(id);
      setDraft(res);
      setDirty(false);
      setActiveTab("editor");
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal memuat draft: ${err.message}` });
    } finally {
      setLoadingDraft(false);
    }
  }

  async function handleSave() {
    if (!draft || !draftId) return;
    try {
      setSaving(true);
      const updated = await updateReportDraft(draftId, { data: draft.data });
      setDraft(updated);
      setDirty(false);
      setToast({ kind: "success", message: "Draft tersimpan." });
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal menyimpan draft: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Hapus draft ini? Semua foto yang terupload juga ikut dihapus.")) {
      return;
    }
    try {
      await deleteReportDraft(id);
      if (draftId === id) {
        setDraftId(null);
        setDraft(null);
      }
      await refreshList();
      setToast({ kind: "success", message: "Draft dihapus." });
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal menghapus draft: ${err.message}` });
    }
  }

  async function handleGeneratePdf() {
    if (!draftId) return;
    if (dirty) {
      const confirmed = window.confirm("Ada perubahan belum disimpan. Simpan dulu sebelum generate PDF?");
      if (confirmed) await handleSave();
    }
    try {
      setPdfBusy(true);
      const result = await generateReportPdf(draftId);
      await downloadReportPdf({ id: draftId, file: result.filename });
      setToast({ kind: "success", message: "PDF berhasil dibuat dan diunduh." });
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal generate PDF: ${err.message}` });
    } finally {
      setPdfBusy(false);
    }
  }

  function patchData(updater) {
    setDraft((prev) => {
      if (!prev) return prev;
      const data = clone(prev.data);
      updater(data);
      setDirty(true);
      return { ...prev, data };
    });
  }

  async function handlePhotoUpload(section, file, extra = {}) {
    if (!draftId || !file) return;
    try {
      const res = await uploadReportPhoto({ id: draftId, section, file, extra });
      setDraft(res.draft);
      setDirty(false);
      setToast({ kind: "success", message: "Foto terunggah." });
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal unggah foto: ${err.message}` });
    }
  }

  async function handlePhotoDelete(section, filename) {
    if (!draftId || !filename) return;
    try {
      const updated = await deleteReportPhoto({ id: draftId, section, filename });
      setDraft(updated);
      setDirty(false);
      setToast({ kind: "success", message: "Foto dihapus." });
    } catch (err) {
      setToast({ kind: "danger", message: `Gagal hapus foto: ${err.message}` });
    }
  }

  const data = draft?.data;
  const previewUrl = useMemo(() => {
    if (!draftId) return null;
    const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
    const token = getAuthToken() || "";
    return `${base}/report-drafts/${encodeURIComponent(draftId)}/preview?token=${encodeURIComponent(token)}`;
  }, [draftId]);

  return (
    <section className="feature-page-card report-editor-page">
      <div className="page-title gap-4">
        <div className="min-w-0">
          <h2>Report Editor &amp; PDF</h2>
          <p>Generate draft laporan dari database, edit di web, lalu export ke PDF A4.</p>
        </div>
      </div>

      <div className="report-editor-toolbar">
        <div className="report-editor-range">
          <label>
            Tanggal mulai
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
            />
          </label>
          <label>
            Tanggal selesai
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
            />
          </label>
          <button
            type="button"
            className="submit-btn"
            disabled={generating}
            onClick={handleGenerate}
          >
            {generating ? "Membuat draft..." : "Buat draft baru"}
          </button>
        </div>

        <div className="report-editor-list">
          <span className="report-editor-list-title">Draft tersimpan</span>
          {drafts.length === 0 ? (
            <span className="muted">Belum ada draft.</span>
          ) : (
            <ul>
              {drafts.map((d) => (
                <li key={d.id} className={d.id === draftId ? "active" : ""}>
                  <button type="button" onClick={() => handleOpenDraft(d.id)}>
                    <strong>{d.title || `Draft ${d.start_date} – ${d.end_date}`}</strong>
                    <small>
                      {d.start_date} → {d.end_date} · {d.status}
                    </small>
                  </button>
                  <button
                    type="button"
                    className="report-editor-delete"
                    onClick={() => handleDelete(d.id)}
                    title="Hapus draft"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!draft ? (
        <div className="empty-state mt-4">
          Pilih draft di samping atau buat draft baru dengan rentang tanggal di atas.
        </div>
      ) : loadingDraft ? (
        <LoadingMessage>Memuat draft...</LoadingMessage>
      ) : (
        <>
          <div className="report-editor-tabbar">
            <div className="report-editor-tabs">
              <button
                type="button"
                className={activeTab === "editor" ? "active" : ""}
                onClick={() => setActiveTab("editor")}
              >
                Editor
              </button>
              <button
                type="button"
                className={activeTab === "preview" ? "active" : ""}
                onClick={() => setActiveTab("preview")}
              >
                Preview A4
              </button>
            </div>

            <div className="report-editor-actions">
              {dirty ? <span className="report-editor-dirty">Ada perubahan belum disimpan</span> : null}
              <button
                type="button"
                className="action-btn-secondary"
                disabled={saving || !dirty}
                onClick={handleSave}
              >
                {saving ? "Menyimpan..." : "Simpan draft"}
              </button>
              <button
                type="button"
                className="submit-btn"
                disabled={pdfBusy}
                onClick={handleGeneratePdf}
              >
                {pdfBusy ? "Membuat PDF..." : "Export PDF"}
              </button>
            </div>
          </div>

          {activeTab === "editor" ? (
            <EditorTab
              data={data}
              draftId={draftId}
              onPatch={patchData}
              onPhotoUpload={handlePhotoUpload}
              onPhotoDelete={handlePhotoDelete}
            />
          ) : (
            <div className="report-editor-preview">
              <p className="muted">
                Preview A4 di-render server agar identik dengan PDF. Jika ada perubahan belum
                disimpan, simpan dulu lalu klik refresh.
              </p>
              <button
                type="button"
                className="action-btn-secondary"
                onClick={() => {
                  if (previewIframeRef.current) {
                    previewIframeRef.current.src = `${previewUrl}&t=${Date.now()}`;
                  }
                }}
              >
                Refresh preview
              </button>
              {previewUrl ? (
                <iframe
                  ref={previewIframeRef}
                  className="report-editor-iframe"
                  src={previewUrl}
                  title="Preview Laporan A4"
                />
              ) : null}
            </div>
          )}
        </>
      )}

      <Toast kind={toast.kind} message={toast.message} />
    </section>
  );
}

function EditorTab({ data, draftId, onPatch, onPhotoUpload, onPhotoDelete }) {
  if (!data) return null;
  return (
    <div className="report-editor-form">
      <CoverEditor data={data} onPatch={onPatch} />
      <ChapterIEditor data={data} onPatch={onPatch} />
      <PreparationEditor data={data} onPatch={onPatch} />
      <ImplementationEditor data={data} onPatch={onPatch} />
      <DailyRecipientsEditor data={data} onPatch={onPatch} />
      <MenuTableEditor data={data} onPatch={onPatch} />
      <ActivityPhotosEditor
        data={data}
        draftId={draftId}
        onPatch={onPatch}
        onUpload={onPhotoUpload}
        onDelete={onPhotoDelete}
      />
      <MenuPhotosEditor
        data={data}
        draftId={draftId}
        onPatch={onPatch}
        onUpload={onPhotoUpload}
        onDelete={onPhotoDelete}
      />
      <ChapterIIIEditor data={data} onPatch={onPatch} />
      <ChapterIVEditor data={data} onPatch={onPatch} />
      <SignatureEditor data={data} onPatch={onPatch} />
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="report-editor-field">
      <span>{label}</span>
      {children}
      {hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
}

function CoverEditor({ data, onPatch }) {
  const r = data.report;
  return (
    <fieldset className="report-editor-section">
      <legend>Cover</legend>
      <div className="report-editor-grid">
        <Field label="Judul laporan">
          <input value={r.title} onChange={(e) => onPatch((d) => { d.report.title = e.target.value; })} />
        </Field>
        <Field label="Nama program">
          <input value={r.programName} onChange={(e) => onPatch((d) => { d.report.programName = e.target.value; })} />
        </Field>
        <Field label="Nama SPPG">
          <input value={r.sppgName} onChange={(e) => onPatch((d) => { d.report.sppgName = e.target.value; })} />
        </Field>
        <Field label="Id SPPG">
          <input value={r.sppgId} onChange={(e) => onPatch((d) => { d.report.sppgId = e.target.value; })} />
        </Field>
        <Field label="Yayasan/Mitra">
          <input value={r.foundationName} onChange={(e) => onPatch((d) => { d.report.foundationName = e.target.value; })} />
        </Field>
        <Field label="Periode">
          <input value={r.periodLabel} onChange={(e) => onPatch((d) => { d.report.periodLabel = e.target.value; })} />
        </Field>
        <Field label="Kecamatan">
          <input value={r.kecamatan || ""} onChange={(e) => onPatch((d) => { d.report.kecamatan = e.target.value; })} />
        </Field>
        <Field label="Kabupaten/Kota">
          <input value={r.city} onChange={(e) => onPatch((d) => { d.report.city = e.target.value; })} />
        </Field>
        <Field label="Provinsi">
          <input value={r.province} onChange={(e) => onPatch((d) => { d.report.province = e.target.value; })} />
        </Field>
      </div>
    </fieldset>
  );
}

function ListEditor({ items, onChange, placeholder = "Tulis poin...", rowLabel = (i) => `Poin ${i + 1}` }) {
  return (
    <div className="report-editor-list-editor">
      {items.map((item, index) => (
        <div className="report-editor-list-row" key={index}>
          <span className="report-editor-list-handle">{rowLabel(index)}</span>
          <textarea
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[index] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            rows={2}
          />
          <div className="report-editor-list-actions">
            <button type="button" disabled={index === 0} onClick={() => onChange(moveItem(items, index, index - 1))}>↑</button>
            <button type="button" disabled={index === items.length - 1} onClick={() => onChange(moveItem(items, index, index + 1))}>↓</button>
            <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))}>Hapus</button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="action-btn-secondary"
        onClick={() => onChange([...items, ""])}
      >
        + Tambah baris
      </button>
    </div>
  );
}

function ChapterIEditor({ data, onPatch }) {
  const c = data.chapters;
  return (
    <fieldset className="report-editor-section">
      <legend>BAB I — Pendahuluan</legend>
      <Field label="Latar Belakang">
        <textarea
          rows={10}
          value={c.background}
          onChange={(e) => onPatch((d) => { d.chapters.background = e.target.value; })}
        />
      </Field>
      <Field label="Tujuan">
        <ListEditor
          items={c.goals}
          onChange={(next) => onPatch((d) => { d.chapters.goals = next; })}
          rowLabel={(i) => `${i + 1})`}
          placeholder="Tujuan program"
        />
      </Field>
      <Field label="Sasaran (per kategori)">
        <div className="report-editor-targets">
          {c.targets.map((row, index) => (
            <div className="report-editor-list-row" key={index}>
              <input
                value={row.category}
                onChange={(e) => onPatch((d) => { d.chapters.targets[index].category = e.target.value; })}
              />
              <input
                value={row.total}
                onChange={(e) => onPatch((d) => {
                  const v = e.target.value;
                  d.chapters.targets[index].total = v === "" ? "-" : (Number.isFinite(Number(v)) ? Number(v) : v);
                })}
              />
              <button
                type="button"
                onClick={() => onPatch((d) => { d.chapters.targets.splice(index, 1); })}
              >
                Hapus
              </button>
            </div>
          ))}
          <button
            type="button"
            className="action-btn-secondary"
            onClick={() => onPatch((d) => { d.chapters.targets.push({ category: "Kategori baru", total: 0 }); })}
          >
            + Tambah kategori
          </button>
        </div>
        <Field label="Total sasaran">
          <input
            type="number"
            value={c.targetTotal || 0}
            onChange={(e) => onPatch((d) => { d.chapters.targetTotal = Number(e.target.value) || 0; })}
          />
        </Field>
      </Field>
    </fieldset>
  );
}

function PreparationEditor({ data, onPatch }) {
  const items = data.chapters.preparation || [];
  return (
    <fieldset className="report-editor-section">
      <legend>BAB II.a — Persiapan (Koordinasi)</legend>
      {items.map((item, index) => (
        <div className="report-editor-prep-block" key={index}>
          <Field label={`Sub-bagian ${index + 1} — Judul`}>
            <input
              value={item.title}
              onChange={(e) => onPatch((d) => { d.chapters.preparation[index].title = e.target.value; })}
            />
          </Field>
          <Field label="Hasil koordinasi (poin-poin)">
            <ListEditor
              items={item.points || []}
              onChange={(next) => onPatch((d) => { d.chapters.preparation[index].points = next; })}
              rowLabel={() => `•`}
            />
          </Field>
          <button
            type="button"
            className="action-btn-secondary danger"
            onClick={() => onPatch((d) => { d.chapters.preparation.splice(index, 1); })}
          >
            Hapus sub-bagian
          </button>
        </div>
      ))}
      <button
        type="button"
        className="action-btn-secondary"
        onClick={() => onPatch((d) => { d.chapters.preparation.push({ title: "Koordinasi dengan ...", points: [""] }); })}
      >
        + Tambah sub-bagian persiapan
      </button>
    </fieldset>
  );
}

function ImplementationEditor({ data, onPatch }) {
  const c = data.chapters;
  return (
    <fieldset className="report-editor-section">
      <legend>BAB II.b — Pelaksanaan</legend>
      <Field label="Paragraf pembuka pelaksanaan">
        <textarea
          rows={3}
          value={c.implementation}
          onChange={(e) => onPatch((d) => { d.chapters.implementation = e.target.value; })}
        />
      </Field>
      <Field label="Lesson learned (numbered)">
        <ListEditor
          items={c.lessons}
          onChange={(next) => onPatch((d) => { d.chapters.lessons = next; })}
          rowLabel={(i) => `${i + 1}.`}
        />
      </Field>
    </fieldset>
  );
}

function DailyRecipientsEditor({ data, onPatch }) {
  return (
    <fieldset className="report-editor-section">
      <legend>BAB II.1 — Penerima MBG per tanggal</legend>
      <p className="muted">
        Tabel diisi dari Laporan Harian. Anda bisa override jumlah penerima per sekolah,
        atau mengubah label "Libur".
      </p>
      {data.dailyRecipients.map((day, dayIndex) => (
        <div className="report-editor-daily" key={day.date}>
          <header>
            <strong>{formatIdDate(day.date)}</strong>
            <label>
              Total Penerima Manfaat
              <input
                type="number"
                value={day.totalBeneficiaries}
                onChange={(e) => onPatch((d) => { d.dailyRecipients[dayIndex].totalBeneficiaries = Number(e.target.value) || 0; })}
              />
            </label>
          </header>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Kecamatan</th>
                <th>Sekolah</th>
                <th>Alamat</th>
                <th>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {day.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td>{row.no}</td>
                  <td>
                    <input
                      value={row.district}
                      onChange={(e) => onPatch((d) => { d.dailyRecipients[dayIndex].rows[rowIndex].district = e.target.value; })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.schoolName}
                      onChange={(e) => onPatch((d) => { d.dailyRecipients[dayIndex].rows[rowIndex].schoolName = e.target.value; })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.address}
                      onChange={(e) => onPatch((d) => { d.dailyRecipients[dayIndex].rows[rowIndex].address = e.target.value; })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.recipientCount}
                      onChange={(e) => onPatch((d) => {
                        const v = e.target.value;
                        d.dailyRecipients[dayIndex].rows[rowIndex].recipientCount = v === "" ? "-" : (Number.isFinite(Number(v)) ? Number(v) : v);
                      })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </fieldset>
  );
}

function MenuTableEditor({ data, onPatch }) {
  return (
    <fieldset className="report-editor-section">
      <legend>BAB II.2 — Menu MBG per tanggal</legend>
      <table className="report-editor-menu">
        <thead>
          <tr>
            <th>No</th>
            <th>Kabupaten/Kota</th>
            <th>Tanggal</th>
            <th>Daftar item menu (satu per baris)</th>
            <th>Ket</th>
          </tr>
        </thead>
        <tbody>
          {data.menus.map((menu, index) => (
            <tr key={index}>
              <td>{menu.no}</td>
              <td>
                <input
                  value={menu.city}
                  onChange={(e) => onPatch((d) => { d.menus[index].city = e.target.value; })}
                />
              </td>
              <td>
                <input
                  value={menu.dateLabel}
                  onChange={(e) => onPatch((d) => { d.menus[index].dateLabel = e.target.value; })}
                />
              </td>
              <td>
                <textarea
                  rows={Math.max(3, (menu.menuItems || []).length)}
                  value={(menu.menuItems || []).join("\n")}
                  onChange={(e) => onPatch((d) => {
                    d.menus[index].menuItems = e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean);
                  })}
                />
              </td>
              <td>
                <input
                  value={menu.note}
                  onChange={(e) => onPatch((d) => { d.menus[index].note = e.target.value; })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </fieldset>
  );
}

function ActivityPhotosEditor({ data, draftId, onPatch, onUpload, onDelete }) {
  const photos = data.activityPhotos || [];
  return (
    <fieldset className="report-editor-section">
      <legend>BAB II.3 — Dokumentasi Pemberian MBG</legend>
      <p className="muted">Foto kegiatan, ditampilkan grid 2 kolom. Drag urutan dengan tombol panah.</p>
      <div className="report-editor-photo-grid">
        {photos.map((photo, index) => (
          <div className="report-editor-photo-card" key={photo.filename || index}>
            <img
              alt={photo.caption || ""}
              src={buildPhotoSrc({ id: draftId, section: "activity", filename: photo.filename })}
            />
            <input
              value={photo.caption || ""}
              placeholder="Caption (opsional)"
              onChange={(e) => onPatch((d) => { d.activityPhotos[index].caption = e.target.value; })}
            />
            <div className="report-editor-photo-actions">
              <button type="button" disabled={index === 0} onClick={() => onPatch((d) => { d.activityPhotos = moveItem(d.activityPhotos, index, index - 1).map((p, i) => ({ ...p, sortOrder: i })); })}>↑</button>
              <button type="button" disabled={index === photos.length - 1} onClick={() => onPatch((d) => { d.activityPhotos = moveItem(d.activityPhotos, index, index + 1).map((p, i) => ({ ...p, sortOrder: i })); })}>↓</button>
              <button type="button" className="danger" onClick={() => onDelete("activity", photo.filename)}>Hapus</button>
            </div>
          </div>
        ))}
      </div>
      <label className="report-editor-upload">
        <span>Upload foto baru</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload("activity", file);
            e.target.value = "";
          }}
        />
      </label>
    </fieldset>
  );
}

function MenuPhotosEditor({ data, draftId, onPatch, onUpload, onDelete }) {
  const photos = data.menuPhotos || [];
  const resolveMenuPhotoSrc = (photo) => {
    if (photo.filename) {
      return buildPhotoSrc({ id: draftId, section: "menu", filename: photo.filename });
    }
    if (photo.gdriveFileId) {
      return buildGdriveThumbnailUrl(photo.gdriveFileId, 600);
    }
    return "";
  };
  return (
    <fieldset className="report-editor-section">
      <legend>Dokumentasi Menu</legend>
      <p className="muted">Satu foto per tanggal. Klik tombol "Upload foto" pada baris yang sesuai.</p>
      <table className="report-editor-menu-photos">
        <thead>
          <tr>
            <th>No</th>
            <th>Tanggal</th>
            <th>Foto</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {photos.map((photo, index) => (
            <tr key={photo.id || `${photo.date}-${index}`}>
              <td>{photo.no}</td>
              <td>
                <input
                  value={photo.dateLabel || ""}
                  onChange={(e) => onPatch((d) => { d.menuPhotos[index].dateLabel = e.target.value; })}
                />
              </td>
              <td>
                {resolveMenuPhotoSrc(photo) ? (
                  <img
                    alt=""
                    className="report-editor-menu-thumb"
                    src={resolveMenuPhotoSrc(photo)}
                  />
                ) : (
                  <span className="muted">Belum ada foto</span>
                )}
                {!photo.filename && photo.gdriveFileId ? (
                  <span className="muted">Dari Dokumentasi</span>
                ) : null}
              </td>
              <td>
                <label className="report-editor-upload-inline">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUpload("menu", file, { menuPhotoIndex: index });
                      e.target.value = "";
                    }}
                  />
                  <span>{photo.filename ? "Ganti" : "Upload"}</span>
                </label>
                {photo.filename ? (
                  <button type="button" className="danger" onClick={() => onDelete("menu", photo.filename)}>Hapus</button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </fieldset>
  );
}

function ChapterIIIEditor({ data, onPatch }) {
  const c = data.chapters;
  return (
    <fieldset className="report-editor-section">
      <legend>BAB III — Permasalahan, Penanganan, Tindak Lanjut</legend>
      <Field label="Permasalahan/Kendala">
        <ListEditor items={c.problems} onChange={(next) => onPatch((d) => { d.chapters.problems = next; })} />
      </Field>
      <Field label="Penanganan Permasalahan">
        <ListEditor items={c.solutions} onChange={(next) => onPatch((d) => { d.chapters.solutions = next; })} />
      </Field>
      <Field label="Rencana Tindak Lanjut">
        <ListEditor items={c.followUps} onChange={(next) => onPatch((d) => { d.chapters.followUps = next; })} />
      </Field>
    </fieldset>
  );
}

function ChapterIVEditor({ data, onPatch }) {
  const c = data.chapters;
  return (
    <fieldset className="report-editor-section">
      <legend>BAB IV — Penutup</legend>
      <Field label="Paragraf penutup (kosongkan baris untuk pisah paragraf)">
        <textarea
          rows={10}
          value={c.closing}
          onChange={(e) => onPatch((d) => { d.chapters.closing = e.target.value; })}
        />
      </Field>
    </fieldset>
  );
}

function SignatureEditor({ data, onPatch }) {
  const s = data.signatures;
  return (
    <fieldset className="report-editor-section">
      <legend>Tanda Tangan</legend>
      <div className="report-editor-grid">
        <Field label="Tempat & tanggal (kanan atas)">
          <input value={s.placeDate} onChange={(e) => onPatch((d) => { d.signatures.placeDate = e.target.value; })} />
        </Field>
        <Field label="Jabatan kiri">
          <input value={s.leftTitle} onChange={(e) => onPatch((d) => { d.signatures.leftTitle = e.target.value; })} />
        </Field>
        <Field label="Nama kiri">
          <input value={s.leftName} onChange={(e) => onPatch((d) => { d.signatures.leftName = e.target.value; })} />
        </Field>
        <Field label="Jabatan kanan">
          <input value={s.rightTitle} onChange={(e) => onPatch((d) => { d.signatures.rightTitle = e.target.value; })} />
        </Field>
        <Field label="Nama kanan">
          <input value={s.rightName} onChange={(e) => onPatch((d) => { d.signatures.rightName = e.target.value; })} />
        </Field>
      </div>
    </fieldset>
  );
}
