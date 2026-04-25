import { useEffect, useMemo, useState } from "react";
import { fetchReportByDate } from "../api/dailyReportApi.js";
import { extractShoppingReportImage } from "../api/shoppingReportApi.js";
import { formatMoney } from "../shared/utils/formatters.js";

const UNIT_OPTIONS = ["kg", "gram", "liter", "ml", "pack", "pcs", "ikat", "buah"];
const SMALL_PORTION_RATE = 8000;
const LARGE_PORTION_RATE = 10000;

function createEmptyItem() {
  return {
    master_item_id: null,
    item_lookup: "",
    description: "",
    show_suggestions: false,
    qty: 0,
    unit_name: "",
    price: 0,
    amount: 0,
    notes: "",
  };
}

function getInitialState(initialData) {
  return {
    report_date: initialData?.report_date || "",
    menu_name: initialData?.menu_name || "",
    small_portion_count: initialData?.small_portion_count ?? 0,
    large_portion_count: initialData?.large_portion_count ?? 0,
    notes: initialData?.notes || "",
    items:
      initialData?.items?.length > 0
        ? initialData.items.map((item) => ({
            master_item_id: item.master_item_id ?? null,
            item_lookup: item.master_item_code
              ? `${item.master_item_code} - ${item.master_item_name || item.description}`
              : item.description || "",
            description: item.description || "",
            show_suggestions: false,
            qty: Number(item.qty ?? 0),
            unit_name: item.unit_name || "",
            price: Number(item.price ?? 0),
            amount: Number(item.amount ?? 0),
            notes: item.notes || "",
          }))
        : [createEmptyItem()],
  };
}

function getMenuReportName(report) {
  const names = [
    report?.menu_name_1,
    report?.menu_name_2,
    report?.menu_name_3,
    report?.menu_name_4,
    report?.menu_name_5,
  ].filter(Boolean);

  return names.join(", ") || report?.menu_name || "";
}

function getUnitOptions(currentValue) {
  return Array.from(
    new Set([String(currentValue || "").trim(), ...UNIT_OPTIONS].filter(Boolean))
  );
}

function normalizeSuggestionText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSuggestionTokens(value) {
  return normalizeSuggestionText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function scoreMasterItemSuggestion(masterItem, query) {
  const normalizedQuery = normalizeSuggestionText(query);
  if (!normalizedQuery) return -1;

  const queryTokens = buildSuggestionTokens(normalizedQuery);
  if (!queryTokens.length) return -1;

  const itemCode = normalizeSuggestionText(masterItem?.item_code);
  const itemName = normalizeSuggestionText(masterItem?.item_name);
  const haystack = `${itemCode} ${itemName}`.trim();
  if (!haystack) return -1;

  let score = 0;

  if (itemName.includes(normalizedQuery)) score += 120;
  if (itemCode.includes(normalizedQuery)) score += 100;

  for (const token of queryTokens) {
    if (itemName.includes(token)) {
      score += token.length >= 4 ? 40 : 25;
      continue;
    }

    if (itemCode.includes(token)) {
      score += 20;
      continue;
    }

    const itemTokens = haystack.split(" ");
    const nearMatch = itemTokens.some(
      (itemToken) =>
        itemToken.startsWith(token) ||
        token.startsWith(itemToken) ||
        itemToken.includes(token) ||
        token.includes(itemToken)
    );

    if (nearMatch) {
      score += 10;
      continue;
    }

    return -1;
  }

  if (itemName.startsWith(queryTokens[0])) score += 20;
  if (queryTokens.length > 1) score += queryTokens.length * 5;

  return score;
}

function matchesMasterItemExactly(masterItem, value) {
  const normalizedValue = normalizeSuggestionText(value);
  if (!normalizedValue) return false;

  const itemCode = normalizeSuggestionText(masterItem?.item_code);
  const itemName = normalizeSuggestionText(masterItem?.item_name);
  const lookupLabel = normalizeSuggestionText(
    [masterItem?.item_code, masterItem?.item_name].filter(Boolean).join(" - ")
  );

  return (
    normalizedValue === itemCode ||
    normalizedValue === itemName ||
    normalizedValue === lookupLabel
  );
}

function formatImageDraftError(message) {
  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    return "Gagal memproses gambar.";
  }

  if (
    normalizedMessage.includes("GEMINI_API_KEY") ||
    normalizedMessage.includes("server/.env") ||
    normalizedMessage.includes("Fitur import gambar belum aktif")
  ) {
    return "Fitur import gambar belum aktif. Isi GEMINI_API_KEY di file server/.env, lalu restart backend (`cd server && npm run dev`).";
  }

  return normalizedMessage;
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

  useEffect(() => {
    if (open) {
      setForm(getInitialState(initialData));
      setError(null);
      setMenuNameAutoFilled(false);
      setSelectedImageFile(null);
      setImageDraftStatus(null);
      setImageProcessing(false);
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!open || !form.report_date) return;

    const matchedReport = menuReports.find(
      (report) => report.menu_date === form.report_date
    );

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
      } catch (err) {
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
    setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
  };

  const removeItemRow = (index) => {
    setForm((prev) => {
      if (prev.items.length === 1) return prev;
      return {
        ...prev,
        items: prev.items.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

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
        master_item_id:
          Number.isInteger(masterItemId) && masterItemId > 0 ? masterItemId : null,
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

      setImageDraftStatus({
        kind: draft?.warnings?.length ? "warning" : "success",
        message: draft?.warnings?.length
          ? `Draft berhasil diisi. Cek kembali: ${draft.warnings.join(" | ")}`
          : "Draft berhasil diisi dari gambar. Periksa kembali sebelum disimpan.",
      });
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
      <div
        className="modal-card flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div>
            <h3>{initialData?.id ? "Edit laporan belanja" : "Tambah laporan belanja"}</h3>
            <p>Input header laporan dan daftar item belanja harian.</p>
          </div>
          <button type="button" onClick={onClose} disabled={loading}>
            Tutup
          </button>
        </div>

        <form className="modal-form flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 sm:pr-2">
            <div className="shopping-import-card rounded-2xl p-4">
              <div className="shopping-import-head">
                <div>
                  <span className="summary-card-label">Import Gambar</span>
                  <p className="shopping-items-copy">
                    Upload foto nota atau gambar draft belanja. Hasil proses hanya mengisi draft form dan tetap perlu dicek sebelum disimpan.
                  </p>
                </div>
              </div>

              <div className="shopping-import-grid mt-3">
                <div className="form-field">
                  <label htmlFor="shopping_import_image">Upload file gambar</label>
                  <input
                    id="shopping_import_image"
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={handleImageFileChange}
                    disabled={loading || imageProcessing}
                  />
                </div>
                <div className="form-field">
                  <label>File terpilih</label>
                  <div className="shopping-import-file">
                    {selectedImageFile?.name || "Belum ada file dipilih"}
                  </div>
                </div>
              </div>

              <div className="shopping-import-actions mt-3">
                <button
                  type="button"
                  onClick={handleProcessImage}
                  disabled={loading || imageProcessing}
                >
                  {imageProcessing ? "Memproses..." : "Proses gambar"}
                </button>
              </div>

              {imageDraftStatus && (
                <div className={`shopping-import-status ${imageDraftStatus.kind || "info"}`}>
                  {imageDraftStatus.message}
                </div>
              )}
            </div>

            <div className="form-grid grid-cols-1 md:grid-cols-2">
              <div className="form-field">
                <label htmlFor="shopping_report_date">Tanggal laporan</label>
                <input
                  id="shopping_report_date"
                  type="date"
                  className="w-full"
                  value={form.report_date}
                  onChange={(e) => handleHeaderChange("report_date", e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="form-field">
                <label htmlFor="shopping_menu_name">Nama menu</label>
                <input
                  id="shopping_menu_name"
                  type="text"
                  className="w-full"
                  value={form.menu_name}
                  onChange={(e) => {
                    setMenuNameAutoFilled(false);
                    handleHeaderChange("menu_name", e.target.value);
                  }}
                  placeholder="Contoh: Nasi, ayam, sayur"
                  disabled={loading}
                />
              </div>
              <div className="form-field">
                <label htmlFor="shopping_small_portion_count">Jumlah porsi kecil</label>
                <input
                  id="shopping_small_portion_count"
                  type="number"
                  className="w-full"
                  min="0"
                  step="0.01"
                  value={form.small_portion_count}
                  onChange={(e) =>
                    handleNumberChange("header", null, "small_portion_count", e.target.value)
                  }
                  disabled={loading}
                />
              </div>
              <div className="form-field">
                <label htmlFor="shopping_large_portion_count">Jumlah porsi besar</label>
                <input
                  id="shopping_large_portion_count"
                  type="number"
                  className="w-full"
                  min="0"
                  step="0.01"
                  value={form.large_portion_count}
                  onChange={(e) =>
                    handleNumberChange("header", null, "large_portion_count", e.target.value)
                  }
                  disabled={loading}
                />
              </div>
              <div className="form-field">
                <label htmlFor="shopping_notes">Catatan</label>
                <input
                  id="shopping_notes"
                  type="text"
                  className="w-full"
                  value={form.notes}
                  onChange={(e) => handleHeaderChange("notes", e.target.value)}
                  placeholder="Opsional"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-black/8 bg-black/2 px-4 py-3 text-sm text-black/55">
              Pagu harian dihitung otomatis: porsi kecil x Rp 8.000 + porsi besar x Rp 10.000.
              Jika tanggal sudah ada di Laporan harian, jumlah porsi akan terisi otomatis.
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="summary-card rounded-2xl p-4">
                <span className="summary-card-label">Total belanja</span>
                <strong>{formatMoney(totalSpending)}</strong>
              </div>
              <div className="summary-card rounded-2xl p-4">
                <span className="summary-card-label">Pagu harian</span>
                <strong>{formatMoney(dailyBudget)}</strong>
              </div>
              <div className="summary-card rounded-2xl p-4">
                <span className="summary-card-label">Selisih</span>
                <strong>{formatMoney(differenceAmount)}</strong>
              </div>
            </div>

            <div className="shopping-items-card rounded-2xl p-4">
              <div className="shopping-items-head">
                <div>
                  <span className="summary-card-label">Item belanja</span>
                  <p className="shopping-items-copy">
                    Tambah atau hapus baris sesuai kebutuhan. Jumlah akan ikut dihitung dari qty x harga.
                  </p>
                </div>
                <button type="button" onClick={addItemRow} disabled={loading}>
                  + Tambah baris
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {form.items.map((item, index) => (
                  <div key={`shopping-item-${index}`} className="shopping-item-row rounded-2xl p-3">
                    <div className="shopping-item-grid">
                      <div className="form-field shopping-item-wide">
                        <label>Cari barang</label>
                        <input
                          type="text"
                          className="w-full"
                          value={item.item_lookup || ""}
                          onChange={(e) => {
                            handleItemChange(index, "item_lookup", e.target.value);
                            handleItemChange(index, "master_item_id", null);
                          }}
                          placeholder="Cari kode / nama barang"
                          disabled={loading}
                        />
                        {String(item.item_lookup || "").trim() && (
                          <div className="shopping-item-suggestions">
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
                        )}
                      </div>
                      <div className="form-field shopping-item-wide">
                        <label>Uraian</label>
                        <input
                          type="text"
                          className="w-full"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(index, "description", e.target.value)
                          }
                          placeholder="Contoh: Beras"
                          disabled={loading}
                        />
                      </div>
                      <div className="form-field">
                        <label>Qty</label>
                        <input
                          type="number"
                          className="w-full"
                          min="0"
                          step="0.01"
                          value={item.qty}
                          onChange={(e) =>
                            handleNumberChange("item", index, "qty", e.target.value)
                          }
                          disabled={loading}
                        />
                      </div>
                      <div className="form-field">
                        <label>Satuan</label>
                        <select
                          className="w-full"
                          value={item.unit_name}
                          onChange={(e) =>
                            handleItemChange(index, "unit_name", e.target.value)
                          }
                          disabled={loading}
                        >
                          <option value="">Pilih satuan</option>
                          {getUnitOptions(item.unit_name).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-field">
                        <label>Harga</label>
                        <input
                          type="number"
                          className="w-full"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) =>
                            handleNumberChange("item", index, "price", e.target.value)
                          }
                          disabled={loading}
                        />
                      </div>
                      <div className="form-field">
                        <label>Jumlah</label>
                        <input
                          type="number"
                          className="w-full"
                          min="0"
                          step="0.01"
                          value={item.amount}
                          onChange={(e) =>
                            handleNumberChange("item", index, "amount", e.target.value)
                          }
                          disabled={loading}
                        />
                      </div>
                      <div className="form-field shopping-item-wide">
                        <label>Keterangan</label>
                        <input
                          type="text"
                          className="w-full"
                          value={item.notes}
                          onChange={(e) => handleItemChange(index, "notes", e.target.value)}
                          placeholder="Opsional"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="shopping-item-actions">
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => removeItemRow(index)}
                        disabled={loading || form.items.length === 1}
                      >
                        Hapus baris
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions border-t border-black/8 pt-3">
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
