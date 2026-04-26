import { useEffect, useMemo, useState } from "react";
import { fetchReportByDate } from "../api/dailyReportApi.js";
import { extractShoppingReportImage } from "../api/shoppingReportApi.js";
import ShoppingReportHeaderSection from "../features/shopping-reports/components/ShoppingReportHeaderSection.jsx";
import ShoppingReportImageImport from "../features/shopping-reports/components/ShoppingReportImageImport.jsx";
import ShoppingReportItemsSection from "../features/shopping-reports/components/ShoppingReportItemsSection.jsx";
import ShoppingReportSummaryCards from "../features/shopping-reports/components/ShoppingReportSummaryCards.jsx";
import {
  LARGE_PORTION_RATE,
  SMALL_PORTION_RATE,
  createEmptyItem,
  formatImageDraftError,
  getInitialState,
  getMenuReportName,
  matchesMasterItemExactly,
  scoreMasterItemSuggestion,
} from "../features/shopping-reports/utils/shoppingReportFormUtils.js";

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
            <ShoppingReportImageImport
              imageDraftStatus={imageDraftStatus}
              imageProcessing={imageProcessing}
              loading={loading}
              onFileChange={handleImageFileChange}
              onProcessImage={handleProcessImage}
              selectedImageFile={selectedImageFile}
            />

            <ShoppingReportHeaderSection
              form={form}
              loading={loading}
              onHeaderChange={handleHeaderChange}
              onMenuNameChange={(value) => {
                setMenuNameAutoFilled(false);
                handleHeaderChange("menu_name", value);
              }}
              onNumberChange={handleNumberChange}
            />

            <div className="rounded-2xl border border-black/8 bg-black/2 px-4 py-3 text-sm text-black/55">
              Pagu harian dihitung otomatis: porsi kecil x Rp 8.000 + porsi besar x Rp 10.000.
              Jika tanggal sudah ada di Laporan harian, jumlah porsi akan terisi otomatis.
            </div>

            <ShoppingReportSummaryCards
              dailyBudget={dailyBudget}
              differenceAmount={differenceAmount}
              totalSpending={totalSpending}
            />

            <ShoppingReportItemsSection
              itemSuggestions={itemSuggestions}
              items={form.items}
              loading={loading}
              onAddItem={addItemRow}
              onItemChange={handleItemChange}
              onNumberChange={handleNumberChange}
              onRemoveItem={removeItemRow}
              onSelectMasterItem={handleSelectMasterItem}
            />
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
