import { useEffect, useMemo, useState } from "react";
import { fetchReportByDate } from "../api/dailyReportApi.js";
import { extractShoppingReportImage } from "../api/shoppingReportApi.js";
import { formatMoney } from "../shared/utils/formatters.js";
import { MobileSubmitBar, QuickActionBar, StickyFormHeader, SummaryPanelCard, compactRowClass } from "./ui/FormPatterns.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";
import {
  LARGE_PORTION_RATE,
  SMALL_PORTION_RATE,
  createEmptyItem,
  formatImageDraftError,
  getInitialState,
  getMenuReportName,
  getUnitOptions,
  matchesMasterItemExactly,
  scoreMasterItemSuggestion,
} from "../features/shopping-reports/utils/shoppingReportFormUtils.js";

const SHOPPING_ITEM_FIELDS = ["item_lookup", "description", "qty", "unit_name", "price", "amount", "notes"];
const MAX_IMAGE_IMPORT_SIZE_BYTES = 8 * 1024 * 1024;

function formatRupiahDisplay(value) {
  if (value === "" || value == null) return "";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  return formatMoney(numericValue);
}

function parseRupiahInput(value) {
  const numericText = String(value || "").replace(/[^\d]/g, "");
  return numericText ? Number(numericText) : "";
}

function formatPortionCountInput(value) {
  if (value === "" || value == null) return "";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  return String(Math.trunc(numericValue));
}

function parsePortionCountInput(value) {
  const numericText = String(value || "").replace(/[^\d]/g, "");
  return numericText ? Number(numericText) : "";
}

function focusShoppingField(rowIndex, fieldName) {
  window.setTimeout(() => {
    const input = document.querySelector(`[data-shopping-row="${rowIndex}"] [data-shopping-field="${fieldName}"]`);
    input?.focus();
    input?.select?.();
  }, 0);
}

export default function ShoppingReportForm({
  open,
  initialData,
  itemMasters = [],
  menuReports = [],
  loading,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(getInitialState(initialData));
  const [error, setError] = useState(null);
  const [menuNameAutoFilled, setMenuNameAutoFilled] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imageDraftStatus, setImageDraftStatus] = useState(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [reviewRows, setReviewRows] = useState(() => new Set());
  const [showReviewOnly, setShowReviewOnly] = useState(false);
  const [hasImportedDraft, setHasImportedDraft] = useState(false);
  const [focusedMoneyField, setFocusedMoneyField] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(getInitialState(initialData));
      setError(null);
      setMenuNameAutoFilled(false);
      setSelectedImageFile(null);
      setImageDraftStatus(null);
      setImageProcessing(false);
      setActiveItemIndex(0);
      setReviewRows(new Set());
      setShowReviewOnly(false);
      setHasImportedDraft(false);
      setFocusedMoneyField(null);
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!open || !form.report_date) return;

    const matchedReport = menuReports.find((report) => report.menu_date === form.report_date);

    if (matchedReport) {
      const nextMenuName = getMenuReportName(matchedReport);
      setForm((prev) =>
        prev.menu_name === nextMenuName ? prev : { ...prev, menu_name: nextMenuName }
      );
      setMenuNameAutoFilled(true);
      return;
    }

    if (menuNameAutoFilled) {
      setForm((prev) => ({ ...prev, menu_name: "" }));
      setMenuNameAutoFilled(false);
    }
  }, [form.report_date, menuReports, open, initialData?.id, menuNameAutoFilled]);

  useEffect(() => {
    if (!open || !form.report_date) return undefined;

    let cancelled = false;

    const loadDailyPortions = async () => {
      try {
        const report = await fetchReportByDate(form.report_date);
        if (cancelled || !report?.exists) return;

        const detailRows = Array.isArray(report.details) ? report.details : [];
        const nextSmall = detailRows.reduce(
          (sum, item) => sum + Number(item.actual_small_portion || 0),
          0
        );
        const nextLarge = detailRows.reduce(
          (sum, item) => sum + Number(item.actual_large_portion || 0),
          0
        );

        setForm((prev) => ({
          ...prev,
          small_portion_count: nextSmall,
          large_portion_count: nextLarge,
        }));
      } catch (_err) {
        if (cancelled) return;
        setForm((prev) => ({
          ...prev,
          small_portion_count: 0,
          large_portion_count: 0,
        }));
      }
    };

    loadDailyPortions();

    return () => {
      cancelled = true;
    };
  }, [form.report_date, open]);

  const totalSpending = useMemo(
    () => form.items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [form.items]
  );
  const dailyBudget = useMemo(
    () =>
      Number(form.small_portion_count || 0) * SMALL_PORTION_RATE +
      Number(form.large_portion_count || 0) * LARGE_PORTION_RATE,
    [form.small_portion_count, form.large_portion_count]
  );
  const differenceAmount = Number(dailyBudget || 0) - Number(totalSpending || 0);
  const reviewCount = reviewRows.size;
  const visibleItems = useMemo(
    () =>
      form.items
        .map((item, index) => ({ item, index }))
        .filter(({ index }) => !showReviewOnly || reviewRows.has(index)),
    [form.items, reviewRows, showReviewOnly]
  );
  const importReviewLabel = hasImportedDraft
    ? reviewCount > 0
      ? "Hasil import belum diverifikasi"
      : "Hasil import sudah diverifikasi"
    : "Input manual";
  const validationErrors = useMemo(() => {
    const errors = [];
    if (!form.report_date) errors.push("Tanggal laporan wajib diisi.");
    if (!String(form.menu_name || "").trim()) errors.push("Nama menu wajib diisi.");

    const smallPortionCount = Number(form.small_portion_count === "" ? 0 : form.small_portion_count);
    const largePortionCount = Number(form.large_portion_count === "" ? 0 : form.large_portion_count);
    if (
      !Number.isFinite(smallPortionCount) ||
      !Number.isFinite(largePortionCount) ||
      smallPortionCount < 0 ||
      largePortionCount < 0
    ) {
      errors.push("Jumlah porsi harus bernilai 0 atau lebih.");
    }

    if (!form.items.length) {
      errors.push("Minimal ada 1 item belanja.");
    }

    form.items.forEach((item, index) => {
      const description = String(item.description || "").trim();
      const qty = Number(item.qty === "" ? 0 : item.qty);
      const price = Number(item.price === "" ? 0 : item.price);
      const amount = Number(item.amount === "" ? 0 : item.amount);

      if (!description) errors.push(`Baris ${index + 1}: uraian wajib diisi.`);
      if (
        !Number.isFinite(qty) ||
        !Number.isFinite(price) ||
        !Number.isFinite(amount) ||
        qty < 0 ||
        price < 0 ||
        amount < 0
      ) {
        errors.push(`Baris ${index + 1}: nilai item tidak boleh negatif.`);
      }
    });

    return errors;
  }, [form]);
  const hasBlockingError = validationErrors.length > 0;
  const itemSuggestions = useMemo(
    () =>
      form.items.map((item) => {
        const query = String(item.item_lookup || "").trim();
        if (!query) return [];

        const hasExactMatch = itemMasters.some(
          (masterItem) =>
            matchesMasterItemExactly(masterItem, item.item_lookup) ||
            matchesMasterItemExactly(masterItem, item.description)
        );

        if (hasExactMatch && !item.show_suggestions) return [];

        return itemMasters
          .map((masterItem) => ({
            masterItem,
            score: scoreMasterItemSuggestion(masterItem, query),
          }))
          .filter((entry) => entry.score >= 0)
          .sort((left, right) => {
            if (right.score !== left.score) {
              return right.score - left.score;
            }

            return String(left.masterItem.item_name || "").localeCompare(
              String(right.masterItem.item_name || ""),
              "id-ID"
            );
          })
          .slice(0, 8)
          .map((entry) => entry.masterItem);
      }),
    [form.items, itemMasters]
  );

  if (!open) return null;

  const handleHeaderChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleItemChange = (index, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      const current = { ...items[index] };
      current[field] = value;

      if (field === "item_lookup" || field === "description") {
        current.show_suggestions = Boolean(
          String(field === "item_lookup" ? value : current.item_lookup || "").trim()
        );
      }

      if (field === "qty" || field === "price") {
        const qty = Number(field === "qty" ? value : current.qty) || 0;
        const price = Number(field === "price" ? value : current.price) || 0;
        current.amount = qty * price;
      }

      items[index] = current;
      return { ...prev, items };
    });
    setReviewRows((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    if (error) setError(null);
  };

  const handleSelectMasterItem = (index, masterItem) => {
    setForm((prev) => {
      const items = [...prev.items];
      const current = { ...items[index] };
      items[index] = {
        ...current,
        master_item_id: masterItem.id,
        item_lookup: `${masterItem.item_code} - ${masterItem.item_name}`,
        description: masterItem.item_name,
        show_suggestions: false,
      };
      return { ...prev, items };
    });
    setReviewRows((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const handleNumberChange = (scope, index, field, value) => {
    const nextValue = value === "" ? "" : Number(value);
    if (nextValue !== "" && !Number.isFinite(nextValue)) return;

    if (scope === "header") {
      handleHeaderChange(field, nextValue);
      return;
    }

    handleItemChange(index, field, nextValue);
  };

  const addItemRow = () => {
    const nextIndex = form.items.length;
    setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
    setActiveItemIndex(nextIndex);
    focusShoppingField(nextIndex, "item_lookup");
  };

  const removeItemRow = (index) => {
    setForm((prev) => {
      if (prev.items.length === 1) return prev;
      return {
        ...prev,
        items: prev.items.filter((_, itemIndex) => itemIndex !== index),
      };
    });
    setReviewRows((prev) => {
      if (!prev.size) return prev;
      const next = new Set();
      prev.forEach((rowIndex) => {
        if (rowIndex < index) next.add(rowIndex);
        if (rowIndex > index) next.add(rowIndex - 1);
      });
      return next;
    });
  };

  const handleItemKeyDown = (event, index, field) => {
    if (event.key !== "Enter") return;
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.currentTarget?.tagName === "SELECT") return;
    event.preventDefault();

    const fieldIndex = SHOPPING_ITEM_FIELDS.indexOf(field);
    if (fieldIndex < SHOPPING_ITEM_FIELDS.length - 1) {
      focusShoppingField(index, SHOPPING_ITEM_FIELDS[fieldIndex + 1]);
      return;
    }

    if (index === form.items.length - 1) {
      addItemRow();
      return;
    }

    setActiveItemIndex(index + 1);
    focusShoppingField(index + 1, SHOPPING_ITEM_FIELDS[0]);
  };

  const markAllReviewed = () => {
    setReviewRows(new Set());
    setShowReviewOnly(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (hasBlockingError) {
      setError(validationErrors[0]);
      return;
    }

    if (!form.report_date) {
      setError("Tanggal laporan wajib diisi.");
      return;
    }
    if (!String(form.menu_name || "").trim()) {
      setError("Nama menu wajib diisi.");
      return;
    }

    const smallPortionCount = Number(
      form.small_portion_count === "" ? 0 : form.small_portion_count
    );
    const largePortionCount = Number(
      form.large_portion_count === "" ? 0 : form.large_portion_count
    );
    if (
      !Number.isFinite(smallPortionCount) ||
      !Number.isFinite(largePortionCount) ||
      smallPortionCount < 0 ||
      largePortionCount < 0
    ) {
      setError("Jumlah porsi kecil dan porsi besar harus bernilai 0 atau lebih.");
      return;
    }

    if (!form.items.length) {
      setError("Minimal ada 1 item belanja.");
      return;
    }

    const items = [];
    for (let index = 0; index < form.items.length; index += 1) {
      const item = form.items[index];
      const masterItemId =
        item.master_item_id == null || item.master_item_id === ""
          ? null
          : Number(item.master_item_id);
      const description = String(item.description || "").trim();
      const notes = String(item.notes || "").trim();
      const unitName = String(item.unit_name || "").trim();
      const qty = Number(item.qty === "" ? 0 : item.qty);
      const price = Number(item.price === "" ? 0 : item.price);
      const amount = Number(item.amount === "" ? 0 : item.amount);

      if (!description) {
        setError(`Uraian item pada baris ${index + 1} wajib diisi.`);
        return;
      }
      if (
        !Number.isFinite(qty) ||
        !Number.isFinite(price) ||
        !Number.isFinite(amount) ||
        qty < 0 ||
        price < 0 ||
        amount < 0
      ) {
        setError(`Nilai item pada baris ${index + 1} tidak boleh negatif.`);
        return;
      }

      items.push({
        master_item_id: Number.isInteger(masterItemId) && masterItemId > 0 ? masterItemId : null,
        description,
        qty,
        unit_name: unitName,
        price,
        amount,
        notes,
      });
    }

    setError(null);
    onSubmit({
      report_date: form.report_date,
      menu_name: String(form.menu_name || "").trim(),
      small_portion_count: smallPortionCount,
      large_portion_count: largePortionCount,
      daily_budget: dailyBudget,
      notes: String(form.notes || "").trim(),
      items,
    });
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
        message: "Gambar sedang diproses menjadi draft laporan belanja.",
      });

      const response = await extractShoppingReportImage({
        file: selectedImageFile,
      });

      const draft = response?.draft || {};
      const draftItems =
        Array.isArray(draft.items) && draft.items.length > 0
          ? draft.items.map((item) => ({
              master_item_id: null,
              item_lookup: item.uraian || "",
              description: item.uraian || "",
              show_suggestions: true,
              qty: Number(item.qty ?? 0),
              unit_name: item.satuan || "",
              price: Number(item.harga ?? 0),
              amount:
                item.jumlah === "" || item.jumlah == null
                  ? (Number(item.qty ?? 0) || 0) * (Number(item.harga ?? 0) || 0)
                  : Number(item.jumlah ?? 0),
              notes: item.keterangan || "",
            }))
          : [createEmptyItem()];

      setForm((prev) => ({
        ...prev,
        report_date: draft.report_date || prev.report_date,
        menu_name: draft.menu_name || prev.menu_name,
        small_portion_count:
          draft.small_portion_count == null
            ? prev.small_portion_count
            : Number(draft.small_portion_count || 0),
        large_portion_count:
          draft.large_portion_count == null
            ? prev.large_portion_count
            : Number(draft.large_portion_count || 0),
        items: draftItems,
      }));
      setReviewRows(new Set(draftItems.map((_, index) => index)));
      setShowReviewOnly(draftItems.length > 0);
      setHasImportedDraft(true);
      setActiveItemIndex(0);

      setImageDraftStatus({
        kind: draft?.warnings?.length ? "warning" : "success",
        message: draft?.warnings?.length
          ? `Draft berhasil diisi. Cek kembali: ${draft.warnings.join(" | ")}`
          : `Draft berhasil diisi dari gambar. ${draftItems.length} baris ditandai untuk dicek cepat.`,
      });
      focusShoppingField(0, "item_lookup");
    } catch (err) {
      setImageDraftStatus({
        kind: "danger",
        message: `Gagal memproses gambar: ${formatImageDraftError(err.message)}`,
      });
    } finally {
      setImageProcessing(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card data-form-card data-form-card-xl shopping-report-compact-card" role="dialog" aria-modal="true">
        <div className="modal-header daily-report-editor-header shopping-report-editor-header">
          <button
            type="button"
            className="daily-form-close-icon daily-form-close-leading"
            aria-label="Tutup form input laporan belanja"
            onClick={onClose}
            disabled={loading}
          >
            <AppIcon name="close" size={20} weight={APP_ICON_WEIGHT.action} />
          </button>
          <div className="daily-form-header-main min-w-0 flex-1">
            <div className="daily-form-header-icon">
              <AppIcon name="shoppingReports" size={24} weight={APP_ICON_WEIGHT.summary} />
            </div>
            <div className="daily-form-header-copy">
              <h3>{initialData?.id ? "Edit laporan belanja" : "Tambah laporan belanja"}</h3>
              <p>Input belanja harian dengan tabel ringkas, total otomatis, dan review cepat.</p>
            </div>
          </div>
        </div>

        <form className="modal-form data-form shopping-report-compact-form" onSubmit={handleSubmit}>
          <StickyFormHeader className="shopping-editor-sticky-header">
            <div className="daily-editor-command-row shopping-editor-command-row">
              <div className="daily-editor-date-field">
                <div className="date-input-wrap">
                  <label htmlFor="shopping_report_date">Tanggal laporan</label>
                  <input
                    id="shopping_report_date"
                    type="date"
                    value={form.report_date}
                    onChange={(event) => handleHeaderChange("report_date", event.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="daily-editor-metric">
                <span>Item</span>
                <strong>{form.items.length}</strong>
              </div>
              <div className="daily-editor-metric shopping-total-metric">
                <span>Total belanja</span>
                <strong>{formatMoney(totalSpending)}</strong>
              </div>
              <div className={`daily-editor-metric shopping-money-metric ${differenceAmount < 0 ? "menu-warning-metric" : ""}`}>
                <span>Selisih pagu</span>
                <strong>{formatMoney(differenceAmount)}</strong>
              </div>
            </div>

            <div className="shopping-header-grid">
              <label className="shopping-header-field shopping-header-menu">
                <span>Nama menu</span>
                <input
                  type="text"
                  value={form.menu_name}
                  onChange={(event) => {
                    setMenuNameAutoFilled(false);
                    handleHeaderChange("menu_name", event.target.value);
                  }}
                  placeholder="Nama menu"
                  disabled={loading}
                />
              </label>
              <label className="shopping-header-field">
                <span>Porsi kecil</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formatPortionCountInput(form.small_portion_count)}
                  onChange={(event) =>
                    handleNumberChange("header", null, "small_portion_count", parsePortionCountInput(event.target.value))
                  }
                  disabled={loading}
                />
              </label>
              <label className="shopping-header-field">
                <span>Porsi besar</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formatPortionCountInput(form.large_portion_count)}
                  onChange={(event) =>
                    handleNumberChange("header", null, "large_portion_count", parsePortionCountInput(event.target.value))
                  }
                  disabled={loading}
                />
              </label>
              <label className="shopping-header-field shopping-header-notes">
                <span>Catatan</span>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(event) => handleHeaderChange("notes", event.target.value)}
                  placeholder="Opsional"
                  disabled={loading}
                />
              </label>
            </div>

            <div className="daily-editor-tools shopping-editor-tools">
              <div className="daily-editor-tools-main">
                <QuickActionBar className="shopping-quick-actions" ariaLabel="Aksi cepat laporan belanja">
                  <div className="menu-action-group menu-action-group-primary">
                    <label className="menu-inline-import-btn" htmlFor="shopping_import_image">
                      <AppIcon name="import" size={17} weight={APP_ICON_WEIGHT.action} />
                      Import gambar
                    </label>
                    <input
                      id="shopping_import_image"
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
                      className={`status-filter-chip shopping-review-filter ${showReviewOnly ? "active" : ""}`}
                      onClick={() => setShowReviewOnly((prev) => !prev)}
                      disabled={loading || reviewCount === 0}
                    >
                      Perlu dicek
                      <strong>{reviewCount}</strong>
                    </button>
                    {reviewCount > 0 ? (
                      <button type="button" className="status-filter-chip active" onClick={markAllReviewed} disabled={loading}>
                        Tandai dicek
                      </button>
                    ) : null}
                  </div>
                </QuickActionBar>
              </div>
              <div className={`daily-realtime-status ${reviewCount || hasBlockingError ? "warning" : "ready"}`}>
                <AppIcon name={reviewCount ? "statusPartial" : "statusFull"} size={16} weight={APP_ICON_WEIGHT.action} />
                <span>
                  <strong>{importReviewLabel}</strong>
                  {hasBlockingError
                    ? ` | ${validationErrors.length} data wajib belum valid.`
                    : reviewCount
                    ? ` | ${reviewCount} baris perlu dicek.`
                    : selectedImageFile?.name
                    ? ` | File: ${selectedImageFile.name}`
                    : " | Enter pindah field/baris."}
                </span>
              </div>
            </div>
            {imageDraftStatus && (
              <div className={`shopping-import-status ${imageDraftStatus.kind || "info"}`}>
                {imageDraftStatus.message}
              </div>
            )}
          </StickyFormHeader>

          <div className="shopping-compact-workspace">
            <div className="shopping-compact-main">
              <section className="shopping-spreadsheet-section">
                <div className="menu-spreadsheet-head">
                  <div>
                    <span className="menu-spreadsheet-kicker">Item belanja</span>
                    <h4>Daftar pembelian harian</h4>
                  </div>
                  <span>{visibleItems.length}/{form.items.length} baris tampil</span>
                </div>

                <div className="shopping-row-table" role="table" aria-label="Daftar item belanja">
                  <div className="shopping-row shopping-row-head" role="row">
                    <span>No</span>
                    <span>Cari barang</span>
                    <span>Uraian</span>
                    <span>Qty</span>
                    <span>Satuan</span>
                    <span>Harga</span>
                    <span>Jumlah</span>
                    <span>Keterangan</span>
                    <span></span>
                  </div>

                  {visibleItems.map(({ item, index }) => {
                    const rowNeedsReview = reviewRows.has(index);
                    const priceFocused = focusedMoneyField?.index === index && focusedMoneyField?.field === "price";
                    const amountFocused = focusedMoneyField?.index === index && focusedMoneyField?.field === "amount";
                    return (
                      <div
                        className={compactRowClass("shopping-row", {
                          active: activeItemIndex === index,
                          needsReview: rowNeedsReview,
                          verified: hasImportedDraft && !rowNeedsReview,
                        }) + (String(item.item_lookup || "").trim() && itemSuggestions[index]?.length > 0 ? " has-open-suggestions" : "")}
                        role="row"
                        key={`shopping-item-${index}`}
                        data-shopping-row={index}
                      >
                        <span className="shopping-row-index">{index + 1}</span>
                        <div className="shopping-field-wrap">
                          <span className="shopping-mobile-field-label">Kode / barang</span>
                          <input
                            data-shopping-field="item_lookup"
                            type="text"
                            value={item.item_lookup || ""}
                            onFocus={() => setActiveItemIndex(index)}
                            onChange={(event) => {
                              handleItemChange(index, "item_lookup", event.target.value);
                              handleItemChange(index, "master_item_id", null);
                            }}
                            onKeyDown={(event) => handleItemKeyDown(event, index, "item_lookup")}
                            placeholder="Kode / barang"
                            disabled={loading}
                          />
                          {String(item.item_lookup || "").trim() && itemSuggestions[index]?.length > 0 ? (
                            <div className="shopping-item-suggestions shopping-compact-suggestions">
                              {itemSuggestions[index].map((masterItem) => (
                                <button
                                  key={masterItem.id}
                                  type="button"
                                  className="shopping-item-suggestion"
                                  onClick={() => handleSelectMasterItem(index, masterItem)}
                                >
                                  <span>{masterItem.item_code}</span>
                                  <strong>{masterItem.item_name}</strong>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <label className="shopping-mobile-field shopping-mobile-field-description">
                          <span className="shopping-mobile-field-label">Uraian</span>
                          <input
                            data-shopping-field="description"
                            type="text"
                            value={item.description}
                            onFocus={() => setActiveItemIndex(index)}
                            onChange={(event) => handleItemChange(index, "description", event.target.value)}
                            onKeyDown={(event) => handleItemKeyDown(event, index, "description")}
                            placeholder="Uraian"
                            disabled={loading}
                          />
                        </label>
                        <label className="shopping-mobile-field shopping-mobile-field-qty">
                          <span className="shopping-mobile-field-label">Qty</span>
                          <input
                            data-shopping-field="qty"
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.qty}
                            onFocus={() => setActiveItemIndex(index)}
                            onChange={(event) => handleNumberChange("item", index, "qty", event.target.value)}
                            onKeyDown={(event) => handleItemKeyDown(event, index, "qty")}
                            placeholder="Qty"
                            disabled={loading}
                          />
                        </label>
                        <label className="shopping-mobile-field shopping-mobile-field-unit">
                          <span className="shopping-mobile-field-label">Satuan</span>
                          <select
                            data-shopping-field="unit_name"
                            value={item.unit_name}
                            onFocus={() => setActiveItemIndex(index)}
                            onChange={(event) => handleItemChange(index, "unit_name", event.target.value)}
                            onKeyDown={(event) => handleItemKeyDown(event, index, "unit_name")}
                            disabled={loading}
                          >
                            <option value="">Satuan</option>
                            {getUnitOptions(item.unit_name).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="shopping-mobile-field shopping-mobile-field-price">
                          <span className="shopping-mobile-field-label">Harga</span>
                          <input
                            data-shopping-field="price"
                            className="shopping-money-input"
                            type="text"
                            inputMode="numeric"
                            value={priceFocused ? item.price : formatRupiahDisplay(item.price)}
                            onFocus={() => {
                              setActiveItemIndex(index);
                              setFocusedMoneyField({ index, field: "price" });
                            }}
                            onBlur={() => setFocusedMoneyField(null)}
                            onChange={(event) => handleNumberChange("item", index, "price", parseRupiahInput(event.target.value))}
                            onKeyDown={(event) => handleItemKeyDown(event, index, "price")}
                            placeholder="Rp 0"
                            disabled={loading}
                          />
                        </label>
                        <label className="shopping-mobile-field shopping-mobile-field-amount">
                          <span className="shopping-mobile-field-label">Jumlah</span>
                          <input
                            data-shopping-field="amount"
                            className="shopping-money-input"
                            type="text"
                            inputMode="numeric"
                            value={amountFocused ? item.amount : formatRupiahDisplay(item.amount)}
                            onFocus={() => {
                              setActiveItemIndex(index);
                              setFocusedMoneyField({ index, field: "amount" });
                            }}
                            onBlur={() => setFocusedMoneyField(null)}
                            onChange={(event) => handleNumberChange("item", index, "amount", parseRupiahInput(event.target.value))}
                            onKeyDown={(event) => handleItemKeyDown(event, index, "amount")}
                            placeholder="Rp 0"
                            disabled={loading}
                          />
                        </label>
                        <label className="shopping-mobile-field shopping-mobile-field-notes">
                          <span className="shopping-mobile-field-label">Catatan</span>
                          <input
                            data-shopping-field="notes"
                            type="text"
                            value={item.notes}
                            onFocus={() => setActiveItemIndex(index)}
                            onChange={(event) => handleItemChange(index, "notes", event.target.value)}
                            onKeyDown={(event) => handleItemKeyDown(event, index, "notes")}
                            placeholder="Opsional"
                            disabled={loading}
                          />
                        </label>
                        <button
                          type="button"
                          className="menu-sort-move-btn shopping-remove-row-btn"
                          onClick={() => removeItemRow(index)}
                          disabled={loading || form.items.length === 1}
                          aria-label={`Hapus baris belanja ${index + 1}`}
                        >
                          <AppIcon name="delete" size={15} weight={APP_ICON_WEIGHT.action} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="status-quick-btn shopping-add-row-bottom"
                  onClick={addItemRow}
                  disabled={loading}
                >
                  <AppIcon name="add" size={17} weight={APP_ICON_WEIGHT.action} />
                  Tambah baris
                </button>
              </section>
            </div>

            <SummaryPanelCard
              className="shopping-compact-summary"
              title="Ringkasan belanja"
              rows={[
                { label: "Total belanja", value: formatMoney(totalSpending) },
                { label: "Pagu harian", value: formatMoney(dailyBudget) },
                { label: "Item", value: form.items.length },
                { label: "Perlu cek", value: reviewCount },
              ]}
              totalLabel="Selisih"
              totalValue={formatMoney(differenceAmount)}
              submitLabel="Simpan belanja"
              loading={loading}
              disabled={hasBlockingError}
              disabledReason={validationErrors[0]}
              note="Jumlah otomatis dihitung dari qty x harga dan payload tetap kompatibel."
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <MobileSubmitBar
            className="shopping-mobile-submit-bar"
            title={formatMoney(totalSpending)}
            subtitle={`${form.items.length} item${reviewCount ? ` | ${reviewCount} perlu cek` : ""}`}
          >
            <button
              type="submit"
              className="submit-btn mobile-submit-btn"
              disabled={loading || hasBlockingError}
              title={hasBlockingError ? validationErrors[0] : undefined}
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </MobileSubmitBar>
        </form>
      </div>
    </div>
  );
}
