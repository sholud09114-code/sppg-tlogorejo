import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import Toast from "../components/Toast.jsx";
import LoadingMessage from "../components/LoadingMessage.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "../components/ui/appIcons.jsx";
import {
  fetchReportSettings,
  updateReportSettings,
} from "../api/weeklyReportApi.js";

const FIELD_GROUPS = [
  {
    title: "Identitas SPPG",
    description: "Dipakai pada cover dan kop laporan.",
    fields: [
      { key: "sppg_name", label: "Nama SPPG", type: "text" },
      { key: "sppg_id", label: "ID SPPG", type: "text" },
      { key: "yayasan_name", label: "Nama Yayasan", type: "text" },
      { key: "kecamatan", label: "Kecamatan", type: "text" },
      { key: "kabupaten", label: "Kabupaten", type: "text" },
      { key: "provinsi", label: "Provinsi", type: "text" },
    ],
  },
  {
    title: "Penandatangan",
    description: "Muncul di halaman penutup laporan.",
    fields: [
      { key: "ketua_yayasan_name", label: "Ketua Yayasan", type: "text" },
      { key: "kepala_sppg_name", label: "K.A SPPG (Kepala)", type: "text" },
    ],
  },
  {
    title: "Narasi BAB I — Pendahuluan",
    description: "Latar belakang dan tujuan program.",
    fields: [
      {
        key: "narasi_latar_belakang",
        label: "Latar Belakang",
        type: "textarea",
        rows: 12,
        hint: "Pisahkan paragraf dengan baris kosong (Enter dua kali).",
      },
      {
        key: "narasi_tujuan",
        label: "Tujuan (satu poin per baris)",
        type: "textarea",
        rows: 8,
        hint: "Setiap baris jadi satu bullet di laporan.",
      },
    ],
  },
  {
    title: "Narasi BAB II — Pelaksanaan",
    description: "Pembelajaran selama pelaksanaan program.",
    fields: [
      {
        key: "narasi_pelaksanaan_lessons",
        label: "Lesson learned (satu poin per baris)",
        type: "textarea",
        rows: 8,
      },
    ],
  },
  {
    title: "Narasi BAB III — Permasalahan",
    description: "Kendala, penanganan, dan rencana lanjut.",
    fields: [
      { key: "narasi_kendala", label: "Permasalahan & Kendala", type: "textarea", rows: 6 },
      { key: "narasi_penanganan", label: "Penanganan Permasalahan", type: "textarea", rows: 6 },
      { key: "narasi_rencana_lanjut", label: "Rencana Tindak Lanjut", type: "textarea", rows: 6 },
    ],
  },
  {
    title: "Narasi BAB IV — Penutup",
    description: "Paragraf penutup laporan.",
    fields: [
      { key: "narasi_penutup", label: "Penutup", type: "textarea", rows: 12 },
    ],
  },
];

export default function ReportSettings({ onNavigate }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ kind: null, message: null });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchReportSettings()
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setToast({ kind: "danger", message: "Gagal memuat pengaturan: " + err.message });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!isAdmin || !settings) return;
    try {
      setSaving(true);
      const next = await updateReportSettings(settings);
      setSettings(next);
      setToast({ kind: "success", message: "Pengaturan laporan berhasil disimpan." });
    } catch (err) {
      setToast({ kind: "danger", message: "Gagal menyimpan: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const isReady = useMemo(() => Boolean(settings), [settings]);

  return (
    <>
      <section className="feature-page-card">
        <div className="page-title gap-4">
          <div className="min-w-0">
            <h2>Pengaturan Laporan Mingguan</h2>
            <p>Edit identitas SPPG, penandatangan, dan narasi BAB I/II/III/IV yang dipakai generator dokumen.</p>
          </div>
          <div className="page-actions action-toolbar-card w-full flex-wrap sm:w-auto sm:flex-nowrap">
            <button
              type="button"
              className="action-btn-secondary action-btn-secondary-soft w-full sm:w-auto"
              onClick={() => onNavigate?.("weekly")}
            >
              <span className="button-with-icon">
                <AppIcon name="weekly" size={16} weight={APP_ICON_WEIGHT.action} />
                <span>Kembali ke Laporan Mingguan</span>
              </span>
            </button>
          </div>
        </div>

        {loading || !isReady ? (
          <LoadingMessage>Memuat pengaturan...</LoadingMessage>
        ) : (
          <form className="report-settings-form" onSubmit={handleSave}>
            {FIELD_GROUPS.map((group) => (
              <fieldset className="report-settings-group" key={group.title}>
                <legend>
                  <strong>{group.title}</strong>
                  <span>{group.description}</span>
                </legend>
                <div className="report-settings-grid">
                  {group.fields.map((field) => (
                    <label className={`report-settings-field ${field.type === "textarea" ? "wide" : ""}`} key={field.key}>
                      <span>{field.label}</span>
                      {field.type === "textarea" ? (
                        <textarea
                          rows={field.rows || 6}
                          value={settings[field.key] || ""}
                          onChange={(event) => handleChange(field.key, event.target.value)}
                          disabled={!isAdmin || saving}
                        />
                      ) : (
                        <input
                          type="text"
                          value={settings[field.key] || ""}
                          onChange={(event) => handleChange(field.key, event.target.value)}
                          disabled={!isAdmin || saving}
                        />
                      )}
                      {field.hint ? <small>{field.hint}</small> : null}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            <div className="report-settings-actions">
              <button
                type="submit"
                className="submit-btn action-btn-primary-solid"
                disabled={!isAdmin || saving}
              >
                {saving ? "Menyimpan..." : "Simpan pengaturan"}
              </button>
              {!isAdmin ? (
                <small className="report-settings-hint">
                  Hanya admin yang dapat mengubah pengaturan.
                </small>
              ) : null}
            </div>
          </form>
        )}
      </section>

      <Toast kind={toast.kind} message={toast.message} />
    </>
  );
}
