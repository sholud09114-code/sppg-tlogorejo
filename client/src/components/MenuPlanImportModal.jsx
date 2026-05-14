import { useEffect, useRef, useState } from "react";
import { extractMenuPlanImage } from "../api/menuPlanApi.js";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";
import {
  MENU_PLAN_CATEGORIES,
  MENU_PLAN_DAYS,
  addDays,
  buildEmptyItems,
  groupItemsByDayCategory,
  isCellHoliday,
  joinCellItems,
  monthLabel,
  parseIsoDate,
  toIsoDate,
  weekNumberOfMonth,
} from "../shared/utils/menuPlanHelpers.js";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function mergeWithEmptyGrid(draft) {
  const startIso = draft.start_date;
  const start = parseIsoDate(startIso);
  if (!start) return draft;

  const baseItems = buildEmptyItems(start);
  const draftGroups = groupItemsByDayCategory(draft.items || []);

  const merged = baseItems.map((cell) => {
    const key = `${cell.day_of_week}|${cell.category}`;
    const existing = draftGroups.get(key);
    if (!existing || existing.length === 0) return cell;
    return existing[0];
  });

  // For multi-item cells (PMB+PMK) re-merge all entries
  const multiItems = [];
  draftGroups.forEach((items, key) => {
    if (items.length > 1) {
      const [dow, category] = key.split("|");
      items.forEach((item, idx) => {
        multiItems.push({ ...item, day_of_week: Number(dow), category, sort_order: idx });
      });
    }
  });
  if (multiItems.length === 0) return { ...draft, items: merged };

  // Replace the cells that have multi items
  const filtered = merged.filter((cell) => {
    const key = `${cell.day_of_week}|${cell.category}`;
    const replaced = draftGroups.get(key);
    return !replaced || replaced.length <= 1;
  });
  return { ...draft, items: [...filtered, ...multiItems] };
}

export default function MenuPlanImportModal({ open, onClose, onApply }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewUrl(null);
      setDraft(null);
      setError("");
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!open) return null;

  const handleFileChange = (event) => {
    const next = event.target.files?.[0] || null;
    setError("");
    setDraft(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.has(next.type)) {
      setError("Format file tidak didukung. Gunakan jpg, jpeg, png, atau webp.");
      setFile(null);
      event.target.value = "";
      return;
    }
    if (next.size > MAX_IMAGE_SIZE_BYTES) {
      setError("Ukuran gambar maksimal 8 MB.");
      setFile(null);
      event.target.value = "";
      return;
    }
    setFile(next);
  };

  const handleExtract = async () => {
    if (!file) {
      setError("Pilih gambar tabel rencana menu terlebih dahulu.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await extractMenuPlanImage({ file });
      const sanitized = response?.draft;
      if (!sanitized || !Array.isArray(sanitized.items)) {
        throw new Error("Draft rencana menu kosong atau tidak valid.");
      }
      setDraft(sanitized);
    } catch (err) {
      setError(err?.message || "Gagal mengekstrak gambar rencana menu.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!draft) return;
    let payload = { ...draft };
    if (!payload.start_date) {
      const today = new Date();
      const monday = today;
      payload = {
        ...payload,
        start_date: toIsoDate(monday),
      };
    }
    if (!payload.end_date && payload.start_date) {
      const start = parseIsoDate(payload.start_date);
      if (start) payload.end_date = toIsoDate(addDays(start, 5));
    }
    if (!payload.year && payload.start_date) {
      payload.year = parseIsoDate(payload.start_date).getFullYear();
    }
    if (!payload.month && payload.start_date) {
      payload.month = parseIsoDate(payload.start_date).getMonth() + 1;
    }
    if (!payload.week_number && payload.start_date) {
      payload.week_number = weekNumberOfMonth(parseIsoDate(payload.start_date));
    }

    payload = mergeWithEmptyGrid(payload);
    onApply(payload);
  };

  const grouped = draft ? groupItemsByDayCategory(draft.items) : new Map();
  const dayDates = (() => {
    if (!draft?.start_date) return [];
    const start = parseIsoDate(draft.start_date);
    if (!start) return [];
    return MENU_PLAN_DAYS.map((_, idx) => toIsoDate(addDays(start, idx)));
  })();

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card menu-plan-modal w-full max-w-5xl rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-plan-import-title"
      >
        <div className="menu-plan-form-shell">
          <div className="menu-plan-form-head">
            <div>
              <span className="rich-detail-eyebrow">Import dari gambar</span>
              <h3 id="menu-plan-import-title">Ekstrak rencana menu dengan AI</h3>
              <p className="muted">
                Unggah foto/screenshot tabel rencana menu mingguan. AI akan mengisi grid Senin-Sabtu otomatis. Tag (PMB) atau (PMK) di sel akan dideteksi sebagai porsi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => !loading && onClose()}
              className="rich-detail-close-btn"
              aria-label="Tutup import gambar"
            >
              Tutup
            </button>
          </div>

          <div className="menu-plan-import-grid">
            <div className="menu-plan-import-uploader">
              <label className="menu-plan-import-dropzone">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                {previewUrl ? (
                  <img src={previewUrl} alt="Pratinjau gambar tabel menu" />
                ) : (
                  <div className="menu-plan-import-empty">
                    <AppIcon name="import" size={28} weight={APP_ICON_WEIGHT.summary} />
                    <strong>Pilih gambar</strong>
                    <span>JPG, PNG, atau WEBP. Maksimum 8 MB.</span>
                  </div>
                )}
              </label>

              <div className="menu-plan-import-actions">
                <button
                  type="button"
                  className="submit-btn action-btn-primary-solid button-with-icon"
                  onClick={handleExtract}
                  disabled={loading || !file}
                >
                  <AppIcon name="search" size={18} weight={APP_ICON_WEIGHT.action} />
                  <span>{loading ? "Memproses..." : "Ekstrak dengan AI"}</span>
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => !loading && onClose()}
                  disabled={loading}
                >
                  Batal
                </button>
              </div>

              {error ? (
                <div className="form-error" role="alert">{error}</div>
              ) : null}
            </div>

            <div className="menu-plan-import-preview">
              {draft ? (
                <>
                  <div className="menu-plan-import-summary">
                    <div>
                      <strong>
                        {draft.month
                          ? `${monthLabel(draft.month)} ${draft.year ?? ""}`
                          : "Periode belum terbaca"}
                      </strong>
                      <span>
                        {draft.week_number
                          ? `Minggu ke-${draft.week_number}`
                          : "Minggu belum terbaca"}{" "}
                        - {draft.start_date || "?"} s.d {draft.end_date || "?"}
                      </span>
                    </div>
                    <span className="menu-plan-import-count">
                      {draft.items.length} item terdeteksi
                    </span>
                  </div>

                  <div className="menu-plan-grid-wrap">
                    <table className="menu-plan-grid menu-plan-grid-compact">
                      <thead>
                        <tr>
                          <th className="menu-plan-grid-corner">Kategori</th>
                          {MENU_PLAN_DAYS.map((day, idx) => (
                            <th key={day.dow}>
                              <div className="menu-plan-day-head">
                                <strong>{day.short}</strong>
                                <span>{dayDates[idx] || "-"}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MENU_PLAN_CATEGORIES.map((cat) => (
                          <tr key={cat.key}>
                            <th scope="row" className="menu-plan-grid-rowhead">
                              {cat.label}
                            </th>
                            {MENU_PLAN_DAYS.map((day) => {
                              const cellItems =
                                grouped.get(`${day.dow}|${cat.key}`) || [];
                              const holiday = isCellHoliday(cellItems);
                              const text = joinCellItems(cellItems);
                              return (
                                <td
                                  key={`${cat.key}-${day.dow}`}
                                  className={holiday ? "is-holiday" : ""}
                                >
                                  {holiday ? (
                                    <div className="menu-plan-holiday-cell">LIBUR</div>
                                  ) : text ? (
                                    <pre className="menu-plan-detail-cell">{text}</pre>
                                  ) : (
                                    <span className="muted">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {draft.warnings?.length ? (
                    <ul className="menu-plan-import-warnings">
                      {draft.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="menu-plan-form-footer">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setDraft(null)}
                      disabled={loading}
                    >
                      Reset draft
                    </button>
                    <button
                      type="button"
                      className="submit-btn"
                      onClick={handleApply}
                      disabled={loading}
                    >
                      <span className="button-with-icon">
                        <AppIcon name="add" size={18} weight={APP_ICON_WEIGHT.action} />
                        <span>Pakai draft ini</span>
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="menu-plan-import-placeholder">
                  <AppIcon name="empty" size={32} weight={APP_ICON_WEIGHT.summary} />
                  <strong>Belum ada draft</strong>
                  <p>Unggah gambar lalu klik Ekstrak untuk membuat draft otomatis.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
