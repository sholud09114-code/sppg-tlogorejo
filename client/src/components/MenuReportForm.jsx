import { useEffect, useMemo, useState } from "react";
import { extractMenuReportImage } from "../api/menuReportApi.js";
import { MobileSubmitBar, QuickActionBar, StickyFormHeader, SummaryPanelCard } from "./ui/FormPatterns.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

const MENU_NAME_FIELDS = [
  "menu_name_1",
  "menu_name_2",
  "menu_name_3",
  "menu_name_4",
  "menu_name_5",
];

const NUTRITION_ROWS = [
  {
    key: "energy",
    label: "Energi",
    unit: "kkal",
    smallField: "small_energy",
    largeField: "large_energy",
  },
  {
    key: "protein",
    label: "Protein",
    unit: "g",
    smallField: "small_protein",
    largeField: "large_protein",
  },
  {
    key: "fat",
    label: "Lemak",
    unit: "g",
    smallField: "small_fat",
    largeField: "large_fat",
  },
  {
    key: "carbohydrate",
    label: "Karbohidrat",
    unit: "g",
    smallField: "small_carbohydrate",
    largeField: "large_carbohydrate",
  },
  {
    key: "fiber",
    label: "Serat",
    unit: "g",
    smallField: "small_fiber",
    largeField: "large_fiber",
  },
];

const SMALL_FIELDS = NUTRITION_ROWS.map((row) => row.smallField);
const LARGE_FIELDS = NUTRITION_ROWS.map((row) => row.largeField);
const MAX_IMAGE_IMPORT_SIZE_BYTES = 8 * 1024 * 1024;

function getInitialState(initialData, defaultData) {
  const sourceData = initialData || defaultData || {};
  const isEditing = Boolean(initialData);

  return {
    menu_date: isEditing ? sourceData.menu_date || "" : "",
    menu_name_1: sourceData.menu_name_1 || "",
    menu_name_2: sourceData.menu_name_2 || "",
    menu_name_3: sourceData.menu_name_3 || "",
    menu_name_4: sourceData.menu_name_4 || "",
    menu_name_5: sourceData.menu_name_5 || "",
    small_energy: sourceData.small_energy ?? 0,
    small_protein: sourceData.small_protein ?? 0,
    small_fat: sourceData.small_fat ?? 0,
    small_carbohydrate: sourceData.small_carbohydrate ?? 0,
    small_fiber: sourceData.small_fiber ?? 0,
    large_energy: sourceData.large_energy ?? 0,
    large_protein: sourceData.large_protein ?? 0,
    large_fat: sourceData.large_fat ?? 0,
    large_carbohydrate: sourceData.large_carbohydrate ?? 0,
    large_fiber: sourceData.large_fiber ?? 0,
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

  for (const row of NUTRITION_ROWS) {
    const smallValue = Number(normalizedSmall[row.key] || 0);
    const largeValue = Number(normalizedLarge[row.key] || 0);

    if (smallValue > largeValue) {
      normalizedSmall[row.key] = largeValue;
      normalizedLarge[row.key] = smallValue;
    }
  }

  return {
    smallNutrition: normalizedSmall,
    largeNutrition: normalizedLarge,
  };
}

function focusElement(selector) {
  window.setTimeout(() => {
    const input = document.querySelector(selector);
    input?.focus();
    input?.select?.();
  }, 0);
}

export default function MenuReportForm({
  open,
  initialData,
  defaultData,
  loading,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(getInitialState(initialData, defaultData));
  const [error, setError] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imageDraftStatus, setImageDraftStatus] = useState(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const [reviewFields, setReviewFields] = useState(() => new Set());
  const [showReviewOnly, setShowReviewOnly] = useState(false);
  const [hasImportedDraft, setHasImportedDraft] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(getInitialState(initialData, defaultData));
      setError(null);
      setSelectedImageFile(null);
      setImageDraftStatus(null);
      setImageProcessing(false);
      setActiveMenuIndex(0);
      setReviewFields(new Set());
      setShowReviewOnly(false);
      setHasImportedDraft(false);
    }
  }, [open, initialData, defaultData]);

  const filledMenuCount = useMemo(
    () => MENU_NAME_FIELDS.filter((field) => form[field].trim()).length,
    [form]
  );
  const totalEnergy = Number(form.small_energy || 0) + Number(form.large_energy || 0);
  const reviewCount = reviewFields.size;
  const isUsingPreviousDefault = !initialData?.id && Boolean(defaultData?.id);
  const importReviewLabel = hasImportedDraft
    ? reviewCount > 0
      ? "Hasil import belum diverifikasi"
      : "Hasil import sudah diverifikasi"
    : isUsingPreviousDefault
    ? "Default dari menu terakhir"
    : "Input manual";
  const hasInvalidNutrition = [...SMALL_FIELDS, ...LARGE_FIELDS].some((field) => {
    const value = form[field] === "" ? 0 : Number(form[field]);
    return !Number.isFinite(value) || value < 0;
  });
  const saveDisabled = loading || hasInvalidNutrition || !form.menu_date || filledMenuCount === 0;

  if (!open) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setReviewFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
    if (error) setError(null);
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
    if (nextFile && nextFile.size > MAX_IMAGE_IMPORT_SIZE_BYTES) {
      event.target.value = "";
      setSelectedImageFile(null);
      setImageDraftStatus({
        kind: "danger",
        message: "Ukuran gambar maksimal 8 MB agar proses import tetap stabil.",
      });
      return;
    }
    setSelectedImageFile(nextFile);
    setImageDraftStatus(null);
  };

  const handleMoveMenu = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= MENU_NAME_FIELDS.length) return;
    setForm((prev) => reorderMenuFields(prev, index, targetIndex));
    setActiveMenuIndex(targetIndex);
    focusElement(`[data-menu-row-index="${targetIndex}"] input`);
  };

  const focusNextMenuRow = (index) => {
    const nextIndex = Math.min(index + 1, MENU_NAME_FIELDS.length - 1);
    setActiveMenuIndex(nextIndex);
    focusElement(`[data-menu-row-index="${nextIndex}"] input`);
  };

  const focusFirstEmptyMenu = () => {
    const nextIndex = MENU_NAME_FIELDS.findIndex((field) => !form[field].trim());
    const targetIndex = nextIndex === -1 ? MENU_NAME_FIELDS.length - 1 : nextIndex;
    setActiveMenuIndex(targetIndex);
    focusElement(`[data-menu-row-index="${targetIndex}"] input`);
  };

  const handleMenuKeyDown = (event, index) => {
    if (event.key !== "Enter") return;
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    focusNextMenuRow(index);
  };

  const handleNutritionKeyDown = (event, field) => {
    if (event.key !== "Enter") return;
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();

    const nutritionFields = NUTRITION_ROWS.flatMap((row) => [row.smallField, row.largeField]);
    const currentIndex = nutritionFields.indexOf(field);
    const nextField = nutritionFields[Math.min(currentIndex + 1, nutritionFields.length - 1)];
    focusElement(`[data-nutrition-field="${nextField}"]`);
  };

  const copySmallToLarge = (multiplier = 1) => {
    setForm((prev) => {
      const next = { ...prev };
      NUTRITION_ROWS.forEach((row) => {
        next[row.largeField] = roundToTwoDecimals(Number(prev[row.smallField] || 0) * multiplier);
      });
      return next;
    });
    setReviewFields((prev) => {
      if (!prev.size) return prev;
      const next = new Set(prev);
      LARGE_FIELDS.forEach((field) => next.delete(field));
      return next;
    });
  };

  const clearNutrition = () => {
    setForm((prev) => {
      const next = { ...prev };
      [...SMALL_FIELDS, ...LARGE_FIELDS].forEach((field) => {
        next[field] = 0;
      });
      return next;
    });
    setReviewFields((prev) => {
      if (!prev.size) return prev;
      const next = new Set(prev);
      [...SMALL_FIELDS, ...LARGE_FIELDS].forEach((field) => next.delete(field));
      return next;
    });
  };

  const applyPreviousMenu = () => {
    if (!defaultData) return;
    setForm((prev) => ({
      ...getInitialState(null, defaultData),
      menu_date: prev.menu_date,
    }));
    setReviewFields(new Set());
    setHasImportedDraft(false);
    setShowReviewOnly(false);
    setImageDraftStatus({
      kind: "info",
      message: "Menu dan kandungan gizi dari data terakhir sudah dipakai. Tanggal tetap memakai input saat ini.",
    });
    focusElement('[data-menu-row-index="0"] input');
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
      const nextReviewFields = new Set();

      MENU_NAME_FIELDS.forEach((field, index) => {
        if (menuItems[`menu_${index + 1}`]) nextReviewFields.add(field);
      });
      NUTRITION_ROWS.forEach((row) => {
        if (smallNutrition[row.key] != null) nextReviewFields.add(row.smallField);
        if (largeNutrition[row.key] != null) nextReviewFields.add(row.largeField);
      });

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
      setReviewFields(nextReviewFields);
      setHasImportedDraft(true);
      setShowReviewOnly(nextReviewFields.size > 0);

      setImageDraftStatus({
        kind: draft?.warnings?.length ? "warning" : "success",
        message: draft?.warnings?.length
          ? `Draft berhasil diisi. Cek kembali: ${draft.warnings.join(" | ")}`
          : `Draft berhasil diisi dari gambar. ${nextReviewFields.size} field ditandai untuk dicek cepat.`,
      });
      focusElement('[data-menu-row-index="0"] input');
    } catch (err) {
      setImageDraftStatus({
        kind: "danger",
        message: `Gagal memproses gambar: ${err.message}`,
      });
    } finally {
      setImageProcessing(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.menu_date) {
      setError("Tanggal menu wajib diisi.");
      return;
    }

    const hasMenuName = MENU_NAME_FIELDS.some((field) => form[field].trim());
    if (!hasMenuName) {
      setError("Minimal satu nama menu wajib diisi.");
      focusFirstEmptyMenu();
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
      <div className="modal-card menu-report-form-card menu-report-compact-card" role="dialog" aria-modal="true">
        <div className="modal-header daily-report-editor-header menu-report-editor-header">
          <button
            type="button"
            className="daily-form-close-icon daily-form-close-leading"
            aria-label="Tutup form input laporan menu"
            onClick={onClose}
            disabled={loading}
          >
            <AppIcon name="close" size={20} weight={APP_ICON_WEIGHT.action} />
          </button>
          <div className="daily-form-header-main min-w-0 flex-1">
            <div className="daily-form-header-icon">
              <AppIcon name="menuReports" size={24} weight={APP_ICON_WEIGHT.summary} />
            </div>
            <div className="daily-form-header-copy">
              <h3>{initialData?.id ? "Edit laporan menu" : "Tambah laporan menu"}</h3>
              <p>Input menu harian dengan tabel ringkas dan koreksi cepat hasil import.</p>
            </div>
          </div>
        </div>

        <form className="modal-form menu-report-form menu-report-compact-form" onSubmit={handleSubmit}>
          <div className="menu-mobile-date-sticky">
            <div className="daily-editor-date-field">
              <div className="date-input-wrap">
                <label htmlFor="menu_date_mobile">Tanggal menu</label>
                <input
                  id="menu_date_mobile"
                  type="date"
                  value={form.menu_date}
                  onChange={(event) => handleChange("menu_date", event.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <StickyFormHeader className="menu-editor-sticky-header">
            <div className="daily-editor-command-row menu-editor-command-row">
              <div className="daily-editor-date-field">
                <div className="date-input-wrap">
                  <label htmlFor="menu_date">Tanggal menu</label>
                  <input
                    id="menu_date"
                    type="date"
                    value={form.menu_date}
                    onChange={(event) => handleChange("menu_date", event.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="daily-editor-metric">
                <span>Menu terisi</span>
                <strong>
                  {filledMenuCount}/{MENU_NAME_FIELDS.length}
                </strong>
              </div>
              <div className={`daily-editor-metric ${hasInvalidNutrition ? "menu-warning-metric" : ""}`}>
                <span>Total energi</span>
                <strong>{totalEnergy.toLocaleString("id-ID")} kkal</strong>
              </div>
            </div>

            <div className="daily-editor-tools menu-editor-tools">
              <div className="daily-editor-tools-main">
                <QuickActionBar ariaLabel="Aksi cepat laporan menu">
                  <div className="menu-action-group menu-action-group-primary">
                    <button type="button" className="status-quick-btn" onClick={focusFirstEmptyMenu} disabled={loading}>
                      <AppIcon name="statusFull" size={17} weight={APP_ICON_WEIGHT.action} />
                      Tambah menu
                    </button>
                    <label className="menu-inline-import-btn" htmlFor="menu_import_image">
                      <AppIcon name="import" size={17} weight={APP_ICON_WEIGHT.action} />
                      Import gambar
                    </label>
                    <input
                      id="menu_import_image"
                      className="menu-upload-input"
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={handleImageFileChange}
                      disabled={loading || imageProcessing}
                    />
                    <button
                      type="button"
                      className="holiday-quick-btn"
                      onClick={handleProcessImage}
                      disabled={loading || imageProcessing || !selectedImageFile}
                    >
                      <AppIcon name="history" size={17} weight={APP_ICON_WEIGHT.action} />
                      {imageProcessing ? "Memproses..." : "Proses draft"}
                    </button>
                  </div>
                  <div className="menu-action-group menu-action-group-secondary">
                    <button
                      type="button"
                      className={`status-filter-chip ${showReviewOnly ? "active" : ""}`}
                      onClick={() => setShowReviewOnly((prev) => !prev)}
                      disabled={loading || reviewCount === 0}
                    >
                      Perlu dicek
                      <strong>{reviewCount}</strong>
                    </button>
                    {defaultData?.id ? (
                      <button type="button" className="status-filter-chip" onClick={applyPreviousMenu} disabled={loading}>
                        Pakai menu terakhir
                      </button>
                    ) : null}
                  </div>
                </QuickActionBar>
              </div>
              <div className={`daily-realtime-status ${hasInvalidNutrition ? "warning" : "ready"}`}>
                <AppIcon
                  name={reviewCount ? "statusPartial" : "statusFull"}
                  size={16}
                  weight={APP_ICON_WEIGHT.action}
                />
                <span>
                  <strong>{importReviewLabel}</strong>
                  {reviewCount
                    ? ` | ${reviewCount} field perlu dicek.`
                    : selectedImageFile?.name
                    ? ` | File: ${selectedImageFile.name}`
                    : " | Enter pindah ke baris berikutnya."}
                </span>
              </div>
            </div>
            {imageDraftStatus && (
              <div className={`shopping-import-status ${imageDraftStatus.kind || "info"}`}>
                {imageDraftStatus.message}
              </div>
            )}
          </StickyFormHeader>

          <div className="menu-compact-workspace">
            <div className="menu-compact-main">
              <section className="menu-spreadsheet-section">
                <div className="menu-spreadsheet-head">
                  <div>
                    <span className="menu-spreadsheet-kicker">Daftar menu</span>
                    <h4>Item menu harian</h4>
                  </div>
                  <span>{filledMenuCount} menu terisi</span>
                </div>
                <div className="menu-row-table" role="table" aria-label="Daftar menu harian">
                  <div className="menu-row menu-row-head" role="row">
                    <span>No</span>
                    <span>Nama menu</span>
                    <span>Aksi</span>
                  </div>
                  {MENU_NAME_FIELDS.map((field, index) => {
                    if (showReviewOnly && !reviewFields.has(field)) return null;

                    return (
                      <div
                        key={field}
                        className={`menu-row ${activeMenuIndex === index ? "active-row" : ""} ${
                          reviewFields.has(field) ? "needs-review" : ""
                        } ${hasImportedDraft && !reviewFields.has(field) ? "verified-row" : ""}`}
                        role="row"
                        data-menu-row-index={index}
                      >
                        <span className="menu-row-index">{index + 1}</span>
                        <input
                          id={`menu_name_${index + 1}`}
                          type="text"
                          value={form[field]}
                          onFocus={() => setActiveMenuIndex(index)}
                          onChange={(event) => handleChange(field, event.target.value)}
                          onKeyDown={(event) => handleMenuKeyDown(event, index)}
                          placeholder={`Menu ${index + 1}`}
                          disabled={loading}
                        />
                        <div className="menu-row-actions">
                          <button
                            type="button"
                            className="menu-sort-move-btn"
                            onClick={() => handleMoveMenu(index, -1)}
                            disabled={loading || index === 0}
                            aria-label={`Pindahkan menu ${index + 1} ke atas`}
                          >
                            <AppIcon name="chevronUp" size={15} weight={APP_ICON_WEIGHT.action} />
                          </button>
                          <button
                            type="button"
                            className="menu-sort-move-btn"
                            onClick={() => handleMoveMenu(index, 1)}
                            disabled={loading || index === MENU_NAME_FIELDS.length - 1}
                            aria-label={`Pindahkan menu ${index + 1} ke bawah`}
                          >
                            <AppIcon name="chevronDown" size={15} weight={APP_ICON_WEIGHT.action} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="menu-spreadsheet-section">
                <div className="menu-spreadsheet-head">
                  <div>
                    <span className="menu-spreadsheet-kicker">Kandungan gizi</span>
                    <h4>Matrix porsi kecil dan besar</h4>
                  </div>
                  <span>Auto-save lokal saat diketik</span>
                </div>
                <div className="menu-nutrition-table" role="table" aria-label="Kandungan gizi menu">
                  <div className="menu-nutrition-row menu-nutrition-row-head" role="row">
                    <span>Nutrisi</span>
                    <span>Porsi kecil</span>
                    <span>Porsi besar</span>
                    <span>Satuan</span>
                  </div>
                  {NUTRITION_ROWS.map((row) => {
                    const needsReview = reviewFields.has(row.smallField) || reviewFields.has(row.largeField);
                    if (showReviewOnly && !needsReview) return null;

                    return (
                      <div
                        className={`menu-nutrition-row menu-nutrition-row-${row.key} ${
                          row.key === "energy" ? "primary-row" : "secondary-row"
                        } ${
                          needsReview ? "needs-review" : ""
                        } ${hasImportedDraft && !needsReview ? "verified-row" : ""}`}
                        role="row"
                        key={row.key}
                      >
                        <strong>{row.label}</strong>
                        <input
                          id={row.smallField}
                          data-nutrition-field={row.smallField}
                          type="number"
                          min="0"
                          step="0.01"
                          value={form[row.smallField]}
                          onChange={(event) => handleNumberChange(row.smallField, event.target.value)}
                          onKeyDown={(event) => handleNutritionKeyDown(event, row.smallField)}
                          disabled={loading}
                        />
                        <input
                          id={row.largeField}
                          data-nutrition-field={row.largeField}
                          type="number"
                          min="0"
                          step="0.01"
                          value={form[row.largeField]}
                          onChange={(event) => handleNumberChange(row.largeField, event.target.value)}
                          onKeyDown={(event) => handleNutritionKeyDown(event, row.largeField)}
                          disabled={loading}
                        />
                        <span>{row.unit}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="menu-nutrition-actions" aria-label="Aksi cepat kandungan gizi">
                  <button type="button" className="status-quick-btn" onClick={() => copySmallToLarge(1)} disabled={loading}>
                    Salin kecil ke besar
                  </button>
                  <button type="button" className="status-quick-btn" onClick={() => copySmallToLarge(1.5)} disabled={loading}>
                    Besar = kecil x 1,5
                  </button>
                  <button type="button" className="status-filter-chip" onClick={clearNutrition} disabled={loading}>
                    Reset gizi
                  </button>
                  {reviewCount > 0 && (
                    <button
                      type="button"
                      className="status-filter-chip active"
                      onClick={() => setReviewFields(new Set())}
                      disabled={loading}
                    >
                      Tandai sudah dicek
                    </button>
                  )}
                </div>
              </section>
            </div>

            <SummaryPanelCard
              className="menu-compact-summary"
              title="Ringkasan menu"
              rows={[
                { label: "Menu terisi", value: filledMenuCount },
                { label: "Energi porsi kecil", value: Number(form.small_energy || 0).toLocaleString("id-ID") },
                { label: "Energi porsi besar", value: Number(form.large_energy || 0).toLocaleString("id-ID") },
                { label: "Perlu cek", value: reviewCount },
              ]}
              totalLabel="Total energi"
              totalValue={totalEnergy.toLocaleString("id-ID")}
              submitLabel="Simpan menu"
              loading={loading}
              disabled={saveDisabled}
              disabledReason="Lengkapi tanggal, minimal satu menu, dan nilai gizi valid."
              note="Payload tetap memakai field menu dan gizi yang sudah ada."
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <MobileSubmitBar
            title={`${filledMenuCount} menu`}
            subtitle={`${totalEnergy.toLocaleString("id-ID")} kkal${reviewCount ? ` | ${reviewCount} perlu cek` : ""}`}
          >
            <button
              type="submit"
              className="submit-btn mobile-submit-btn"
              disabled={saveDisabled}
              title={saveDisabled ? "Lengkapi tanggal, minimal satu menu, dan nilai gizi valid." : undefined}
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </MobileSubmitBar>
        </form>
      </div>
    </div>
  );
}
