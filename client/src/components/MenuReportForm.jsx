import { useEffect, useState } from "react";
import { extractMenuReportImage } from "../api/menuReportApi.js";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

const MENU_NAME_FIELDS = [
  "menu_name_1",
  "menu_name_2",
  "menu_name_3",
  "menu_name_4",
  "menu_name_5",
];
const SMALL_FIELDS = [
  "small_energy",
  "small_protein",
  "small_fat",
  "small_carbohydrate",
  "small_fiber",
];
const LARGE_FIELDS = [
  "large_energy",
  "large_protein",
  "large_fat",
  "large_carbohydrate",
  "large_fiber",
];
const FIELD_LABELS = {
  small_energy: "Energi (kkal)",
  small_protein: "Protein (g)",
  small_fat: "Lemak (g)",
  small_carbohydrate: "Karbohidrat (g)",
  small_fiber: "Serat (g)",
  large_energy: "Energi (kkal)",
  large_protein: "Protein (g)",
  large_fat: "Lemak (g)",
  large_carbohydrate: "Karbohidrat (g)",
  large_fiber: "Serat (g)",
};

function getInitialState(initialData) {
  return {
    menu_date: initialData?.menu_date || "",
    menu_name_1: initialData?.menu_name_1 || "",
    menu_name_2: initialData?.menu_name_2 || "",
    menu_name_3: initialData?.menu_name_3 || "",
    menu_name_4: initialData?.menu_name_4 || "",
    menu_name_5: initialData?.menu_name_5 || "",
    small_energy: initialData?.small_energy ?? 0,
    small_protein: initialData?.small_protein ?? 0,
    small_fat: initialData?.small_fat ?? 0,
    small_carbohydrate: initialData?.small_carbohydrate ?? 0,
    small_fiber: initialData?.small_fiber ?? 0,
    large_energy: initialData?.large_energy ?? 0,
    large_protein: initialData?.large_protein ?? 0,
    large_fat: initialData?.large_fat ?? 0,
    large_carbohydrate: initialData?.large_carbohydrate ?? 0,
    large_fiber: initialData?.large_fiber ?? 0,
  };
}

function roundToTwoDecimals(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
}

function reorderMenuFields(formState, fromIndex, toIndex) {
  if (fromIndex === toIndex) return formState;
  if (
    fromIndex < 0 ||
    fromIndex >= MENU_NAME_FIELDS.length ||
    toIndex < 0 ||
    toIndex >= MENU_NAME_FIELDS.length
  ) {
    return formState;
  }

  const nextValues = MENU_NAME_FIELDS.map((field) => formState[field]);
  const [movedValue] = nextValues.splice(fromIndex, 1);
  nextValues.splice(toIndex, 0, movedValue);

  const nextFormState = { ...formState };
  MENU_NAME_FIELDS.forEach((field, index) => {
    nextFormState[field] = nextValues[index];
  });

  return nextFormState;
}

function normalizePortionNutritionOrder(smallNutrition, largeNutrition) {
  const normalizedSmall = { ...smallNutrition };
  const normalizedLarge = { ...largeNutrition };

  for (const field of ["energy", "protein", "fat", "carbohydrate", "fiber"]) {
    const smallValue = Number(normalizedSmall[field] || 0);
    const largeValue = Number(normalizedLarge[field] || 0);

    if (smallValue > largeValue) {
      normalizedSmall[field] = largeValue;
      normalizedLarge[field] = smallValue;
    }
  }

  return {
    smallNutrition: normalizedSmall,
    largeNutrition: normalizedLarge,
  };
}

export default function MenuReportForm({
  open,
  initialData,
  loading,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(getInitialState(initialData));
  const [error, setError] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imageDraftStatus, setImageDraftStatus] = useState(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [draggedMenuIndex, setDraggedMenuIndex] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(getInitialState(initialData));
      setError(null);
      setSelectedImageFile(null);
      setImageDraftStatus(null);
      setImageProcessing(false);
      setDraggedMenuIndex(null);
    }
  }, [open, initialData]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNumberChange = (field, value) => {
    if (value === "") {
      handleChange(field, "");
      return;
    }

    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) return;
    handleChange(field, nextValue);
  };

  const handleImageFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setSelectedImageFile(nextFile);
    setImageDraftStatus(null);
  };

  const handleMenuDragStart = (index) => {
    setDraggedMenuIndex(index);
  };

  const handleMenuDrop = (targetIndex) => {
    if (draggedMenuIndex == null) return;

    setForm((prev) => reorderMenuFields(prev, draggedMenuIndex, targetIndex));
    setDraggedMenuIndex(null);
  };

  const handleMenuDragEnd = () => {
    setDraggedMenuIndex(null);
  };

  const handleMoveMenu = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= MENU_NAME_FIELDS.length) return;
    setForm((prev) => reorderMenuFields(prev, index, targetIndex));
  };

  const handleProcessImage = async () => {
    if (!selectedImageFile) {
      setImageDraftStatus({
        kind: "warning",
        message: "Pilih file gambar terlebih dahulu.",
      });
      return;
    }

    if (!["image/jpeg", "image/jpg", "image/png"].includes(selectedImageFile.type)) {
      setImageDraftStatus({
        kind: "danger",
        message: "Format file harus jpg, jpeg, atau png.",
      });
      return;
    }

    try {
      setImageProcessing(true);
      setImageDraftStatus({
        kind: "info",
        message: "Gambar poster menu sedang diproses menjadi draft form.",
      });

      const response = await extractMenuReportImage({
        file: selectedImageFile,
      });
      const draft = response?.draft || {};
      const menuItems = draft?.menu_items || {};
      const { smallNutrition, largeNutrition } = normalizePortionNutritionOrder(
        draft?.small_portion_nutrition || {},
        draft?.large_portion_nutrition || {}
      );

      setForm((prev) => ({
        ...prev,
        menu_date: draft.report_date || prev.menu_date,
        menu_name_1: menuItems.menu_1 || prev.menu_name_1,
        menu_name_2: menuItems.menu_2 || prev.menu_name_2,
        menu_name_3: menuItems.menu_3 || prev.menu_name_3,
        menu_name_4: menuItems.menu_4 || prev.menu_name_4,
        menu_name_5: menuItems.menu_5 || prev.menu_name_5,
        small_energy:
          smallNutrition.energy == null
            ? prev.small_energy
            : roundToTwoDecimals(smallNutrition.energy || 0),
        small_protein:
          smallNutrition.protein == null
            ? prev.small_protein
            : roundToTwoDecimals(smallNutrition.protein || 0),
        small_fat:
          smallNutrition.fat == null ? prev.small_fat : roundToTwoDecimals(smallNutrition.fat || 0),
        small_carbohydrate:
          smallNutrition.carbohydrate == null
            ? prev.small_carbohydrate
            : roundToTwoDecimals(smallNutrition.carbohydrate || 0),
        small_fiber:
          smallNutrition.fiber == null
            ? prev.small_fiber
            : roundToTwoDecimals(smallNutrition.fiber || 0),
        large_energy:
          largeNutrition.energy == null
            ? prev.large_energy
            : roundToTwoDecimals(largeNutrition.energy || 0),
        large_protein:
          largeNutrition.protein == null
            ? prev.large_protein
            : roundToTwoDecimals(largeNutrition.protein || 0),
        large_fat:
          largeNutrition.fat == null ? prev.large_fat : roundToTwoDecimals(largeNutrition.fat || 0),
        large_carbohydrate:
          largeNutrition.carbohydrate == null
            ? prev.large_carbohydrate
            : roundToTwoDecimals(largeNutrition.carbohydrate || 0),
        large_fiber:
          largeNutrition.fiber == null
            ? prev.large_fiber
            : roundToTwoDecimals(largeNutrition.fiber || 0),
      }));

      setImageDraftStatus({
        kind: draft?.warnings?.length ? "warning" : "success",
        message: draft?.warnings?.length
          ? `Draft berhasil diisi. Cek kembali: ${draft.warnings.join(" | ")}`
          : "Draft berhasil diisi dari gambar. Periksa kembali sebelum disimpan.",
      });
    } catch (err) {
      setImageDraftStatus({
        kind: "danger",
        message: `Gagal memproses gambar: ${err.message}`,
      });
    } finally {
      setImageProcessing(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.menu_date) {
      setError("Tanggal menu wajib diisi.");
      return;
    }

    const hasMenuName = MENU_NAME_FIELDS.some((field) => form[field].trim());
    if (!hasMenuName) {
      setError("Minimal satu nama menu wajib diisi.");
      return;
    }

    const payload = {
      menu_date: form.menu_date,
    };

    MENU_NAME_FIELDS.forEach((field) => {
      payload[field] = form[field].trim();
    });

    for (const field of [...SMALL_FIELDS, ...LARGE_FIELDS]) {
      const value = form[field] === "" ? 0 : Number(form[field]);
      if (!Number.isFinite(value) || value < 0) {
        setError("Semua nilai gizi harus bernilai 0 atau lebih.");
        return;
      }
      payload[field] = value;
    }

    setError(null);
    onSubmit(payload);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card menu-report-form-card"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="unified-modal-title">
            <span className="unified-modal-icon">
              <AppIcon name="menuReports" size={22} weight={APP_ICON_WEIGHT.summary} />
            </span>
            <div className="unified-modal-title-copy">
              <h3>{initialData?.id ? "Edit menu" : "Tambah menu"}</h3>
              <p>Input data menu dan kandungan gizi harian.</p>
            </div>
          </div>
          <button type="button" className="menu-form-close-btn" onClick={onClose} disabled={loading}>
            Tutup
          </button>
        </div>

        <form className="modal-form menu-report-form" onSubmit={handleSubmit}>
          <div className="menu-report-form-body">
            <section className="menu-form-section">
              <div className="menu-form-section-head">
                <span className="menu-form-step">1.</span>
                <div>
                  <h4>Unggah Gambar <span>(Opsional)</span></h4>
                  <p>Upload poster atau gambar menu untuk memudahkan identifikasi.</p>
                </div>
              </div>

              <div className="menu-import-layout">
                <div>
                  <label className="menu-upload-dropzone" htmlFor="menu_import_image">
                    <span className="menu-upload-icon">↥</span>
                    <strong>Drag & drop gambar di sini</strong>
                    <span>atau klik untuk memilih file</span>
                    <small>PNG, JPG, JPEG (maks. 5MB)</small>
                  </label>
                  <input
                    id="menu_import_image"
                    className="menu-upload-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={handleImageFileChange}
                    disabled={loading || imageProcessing}
                  />
                </div>

                <div className="menu-import-side">
                  <div className="form-field">
                    <label>File terpilih</label>
                    <div className="shopping-import-file">
                      {selectedImageFile?.name || "Belum ada file dipilih"}
                    </div>
                  </div>
                  <div className="shopping-import-actions">
                  <button
                    type="button"
                    className="menu-process-btn"
                    onClick={handleProcessImage}
                    disabled={loading || imageProcessing}
                  >
                    {imageProcessing ? "Memproses..." : "Proses gambar"}
                  </button>
                </div>
                  <p className="menu-import-note">Hasil import hanya berupa draft dan tetap perlu dicek sebelum disimpan.</p>
                </div>
              </div>

                {imageDraftStatus && (
                  <div className={`shopping-import-status ${imageDraftStatus.kind || "info"}`}>
                    {imageDraftStatus.message}
                  </div>
                )}
            </section>

            <section className="menu-form-section">
              <div className="menu-form-section-head">
                <span className="menu-form-step">2.</span>
                <div>
                  <h4>Tanggal</h4>
                </div>
              </div>
              <div className="form-field menu-date-field">
                <label htmlFor="menu_date">Tanggal</label>
                <input
                  id="menu_date"
                  type="date"
                  className="w-full"
                  value={form.menu_date}
                  onChange={(e) => handleChange("menu_date", e.target.value)}
                  disabled={loading}
                />
              </div>
            </section>

            <section className="menu-form-section">
              <div className="menu-form-section-head">
                <span className="menu-form-step">3.</span>
                <div>
                  <h4>Daftar Menu</h4>
                  <p>Ubah urutan menu dengan tombol naik/turun. Drag tetap tersedia di desktop.</p>
                </div>
              </div>
              <div className="menu-sort-grid">
                {MENU_NAME_FIELDS.map((field, index) => (
                  <div
                    key={field}
                    className={`menu-sort-card ${draggedMenuIndex === index ? "dragging" : ""}`}
                    draggable={!loading}
                    onDragStart={() => handleMenuDragStart(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleMenuDrop(index)}
                    onDragEnd={handleMenuDragEnd}
                  >
                    <div className="menu-sort-card-head">
                      <span className="menu-sort-index">{index + 1}</span>
                      <div className="menu-sort-controls">
                        <button
                          type="button"
                          className="menu-sort-move-btn"
                          onClick={() => handleMoveMenu(index, -1)}
                          disabled={loading || index === 0}
                          aria-label={`Pindahkan menu ${index + 1} ke atas`}
                        >
                          <AppIcon name="chevronUp" size={16} weight={APP_ICON_WEIGHT.action} />
                        </button>
                        <button
                          type="button"
                          className="menu-sort-move-btn"
                          onClick={() => handleMoveMenu(index, 1)}
                          disabled={loading || index === MENU_NAME_FIELDS.length - 1}
                          aria-label={`Pindahkan menu ${index + 1} ke bawah`}
                        >
                          <AppIcon name="chevronDown" size={16} weight={APP_ICON_WEIGHT.action} />
                        </button>
                        <span className="menu-sort-grip" aria-hidden="true">
                          ⋮⋮
                        </span>
                      </div>
                    </div>
                    <label htmlFor={`menu_name_${index + 1}`}>Nama menu {index + 1}</label>
                    <input
                      id={`menu_name_${index + 1}`}
                      type="text"
                      className="w-full"
                      value={form[field]}
                      onChange={(e) => handleChange(field, e.target.value)}
                      placeholder={`Menu ${index + 1}`}
                      disabled={loading}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="menu-form-section">
              <div className="menu-form-section-head menu-form-section-head-inline">
                <div className="menu-form-section-title">
                  <span className="menu-form-step">4.</span>
                  <div>
                    <h4>Kandungan Gizi</h4>
                    <p>Isi nilai gizi untuk porsi kecil dan porsi besar.</p>
                  </div>
                </div>
              </div>

              <div className="menu-nutrition-grid">
                <div className="menu-nutrition-card">
                <span className="menu-nutrition-title">Porsi Kecil</span>
                <div className="menu-nutrition-fields">
                  {SMALL_FIELDS.map((field) => (
                    <div className="form-field" key={field}>
                      <label htmlFor={field}>{FIELD_LABELS[field]}</label>
                      <input
                        id={field}
                        type="number"
                        className="w-full"
                        min="0"
                        step="0.01"
                        value={form[field]}
                        onChange={(e) =>
                          handleNumberChange(field, e.target.value)
                        }
                        disabled={loading}
                      />
                    </div>
                  ))}
                </div>
              </div>

                <div className="menu-nutrition-card">
                <span className="menu-nutrition-title">Porsi Besar</span>
                <div className="menu-nutrition-fields">
                  {LARGE_FIELDS.map((field) => (
                    <div className="form-field" key={field}>
                      <label htmlFor={field}>{FIELD_LABELS[field]}</label>
                      <input
                        id={field}
                        type="number"
                        className="w-full"
                        min="0"
                        step="0.01"
                        value={form[field]}
                        onChange={(e) =>
                          handleNumberChange(field, e.target.value)
                        }
                        disabled={loading}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
              <div className="menu-form-info">Pastikan semua nilai sudah sesuai. Data yang disimpan akan digunakan untuk laporan dan analisis gizi.</div>
            </section>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions menu-form-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
