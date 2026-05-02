import { useEffect, useMemo, useState } from "react";
import { fetchReportByDate } from "../api/dailyReportApi.js";
import { fetchFoodWasteMenuReference } from "../api/foodWasteApi.js";
import { formatNumber, formatPortions, formatWeight } from "../shared/utils/formatters.js";
import { MobileSubmitBar, StickyFormHeader, SummaryPanelCard } from "./ui/FormPatterns.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

const WASTE_ROWS = [
  { field: "carb_source", label: "Sumber karbohidrat", shortLabel: "Karbohidrat" },
  { field: "protein_source", label: "Sumber protein", shortLabel: "Protein" },
  { field: "vegetable", label: "Sayur", shortLabel: "Sayur" },
  { field: "fruit", label: "Buah", shortLabel: "Buah" },
];

function getInitialState(initialData) {
  return {
    report_date: initialData?.report_date || "",
    total_portions: initialData?.total_portions ?? 0,
    carb_source: initialData?.carb_source ?? 0,
    protein_source: initialData?.protein_source ?? 0,
    vegetable: initialData?.vegetable ?? 0,
    fruit: initialData?.fruit ?? 0,
    total_kg: initialData?.total_kg ?? 0,
    menu_notes: initialData?.menu_notes || "",
  };
}

function formatInfoState(referenceState) {
  if (!referenceState) return null;
  if (referenceState.kind === "success") {
    return `Menu tanggal ini ditemukan dan diisikan otomatis. Tetap bisa Anda edit bila perlu.`;
  }
  return "Data menu pada tanggal ini tidak tersedia. Kolom menu bisa diisi manual.";
}

function focusWasteField(field) {
  window.setTimeout(() => {
    const input = document.querySelector(`[data-food-waste-field="${field}"]`);
    input?.focus();
    input?.select?.();
  }, 0);
}

export default function FoodWasteForm({ open, initialData, loading, onClose, onSubmit }) {
  const [form, setForm] = useState(getInitialState(initialData));
  const [error, setError] = useState(null);
  const [menuReferenceState, setMenuReferenceState] = useState(null);
  const [menuAutoFilled, setMenuAutoFilled] = useState(false);
  const [loadingMenuReference, setLoadingMenuReference] = useState(false);
  const [portionReferenceState, setPortionReferenceState] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(getInitialState(initialData));
      setError(null);
      setMenuReferenceState(null);
      setMenuAutoFilled(false);
      setLoadingMenuReference(false);
      setPortionReferenceState(null);
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!open || !form.report_date) {
      return undefined;
    }

    let cancelled = false;

    const loadMenuReference = async () => {
      try {
        setLoadingMenuReference(true);
        const response = await fetchFoodWasteMenuReference(form.report_date);
        if (cancelled) return;

        if (response.exists) {
          setMenuReferenceState({ kind: "success", message: response.menu_text });
          setForm((prev) => ({
            ...prev,
            menu_notes:
              !prev.menu_notes ||
              menuAutoFilled ||
              (initialData?.id && prev.report_date !== initialData.report_date)
                ? response.menu_text || prev.menu_notes
                : prev.menu_notes,
          }));
          setMenuAutoFilled(
            !form.menu_notes ||
              menuAutoFilled ||
              (initialData?.id && form.report_date !== initialData.report_date)
          );
          return;
        }

        setMenuReferenceState({ kind: "info", message: response.message });
        if (menuAutoFilled) {
          setForm((prev) => ({ ...prev, menu_notes: "" }));
          setMenuAutoFilled(false);
        }
      } catch (_err) {
        if (cancelled) return;
        setMenuReferenceState({
          kind: "warning",
          message: "Gagal mengambil referensi menu untuk tanggal ini.",
        });
      } finally {
        if (!cancelled) {
          setLoadingMenuReference(false);
        }
      }
    };

    loadMenuReference();

    return () => {
      cancelled = true;
    };
  }, [
    form.report_date,
    form.menu_notes,
    open,
    menuAutoFilled,
    initialData?.id,
    initialData?.report_date,
  ]);

  useEffect(() => {
    if (!open || !form.report_date) {
      return undefined;
    }

    let cancelled = false;

    const loadPortionReference = async () => {
      try {
        const response = await fetchReportByDate(form.report_date);
        if (cancelled) return;

        if (!response?.exists) {
          setPortionReferenceState({
            kind: "info",
            message: "Data total porsi pada tanggal ini tidak tersedia. Bisa diisi manual.",
          });
          if (initialData?.id && form.report_date === initialData.report_date) {
            return;
          }
          setForm((prev) => (prev.total_portions ? prev : { ...prev, total_portions: 0 }));
          return;
        }

        const detailRows = Array.isArray(response.details) ? response.details : [];
        const totalPortions = detailRows.reduce(
          (sum, item) =>
            sum + Number(item.actual_small_portion || 0) + Number(item.actual_large_portion || 0),
          0
        );

        setPortionReferenceState({
          kind: "success",
          message:
            "Total porsi diisi otomatis dari Laporan Harian. Tetap bisa Anda ubah bila perlu.",
        });

        setForm((prev) => ({
          ...prev,
          total_portions:
            !prev.total_portions ||
            (initialData?.id && prev.report_date !== initialData.report_date)
              ? totalPortions
              : prev.total_portions,
        }));
      } catch (_err) {
        if (cancelled) return;
        setPortionReferenceState({
          kind: "warning",
          message: "Gagal mengambil total porsi dari Laporan Harian. Bisa diisi manual.",
        });
      }
    };

    loadPortionReference();

    return () => {
      cancelled = true;
    };
  }, [form.report_date, form.total_portions, open, initialData?.id, initialData?.report_date]);

  const autoTotalKg = useMemo(
    () =>
      Number(form.carb_source || 0) +
      Number(form.protein_source || 0) +
      Number(form.vegetable || 0) +
      Number(form.fruit || 0),
    [form.carb_source, form.protein_source, form.vegetable, form.fruit]
  );
  const wastePercentage = useMemo(() => {
    const totalPortions = Number(form.total_portions || 0);
    if (!Number.isFinite(totalPortions) || totalPortions <= 0) return 0;
    return (Number(form.total_kg || 0) / totalPortions) * 100;
  }, [form.total_kg, form.total_portions]);
  const wastePerPortion = useMemo(() => {
    const totalPortions = Number(form.total_portions || 0);
    if (!Number.isFinite(totalPortions) || totalPortions <= 0) return 0;
    return Number(form.total_kg || 0) / totalPortions;
  }, [form.total_kg, form.total_portions]);
  const validationErrors = useMemo(() => {
    const errors = [];
    if (!form.report_date) errors.push("Tanggal wajib diisi.");

    for (const [field, label] of [
      ["total_portions", "Total porsi"],
      ["carb_source", "Sumber karbohidrat"],
      ["protein_source", "Sumber protein"],
      ["vegetable", "Sayur"],
      ["fruit", "Buah"],
      ["total_kg", "Total kg"],
    ]) {
      const value = Number(form[field] || 0);
      if (!Number.isFinite(value) || value < 0) {
        errors.push(`${label} tidak boleh negatif.`);
      }
    }

    return errors;
  }, [form]);
  const hasBlockingError = validationErrors.length > 0;

  useEffect(() => {
    if (!open) return;

    setForm((prev) => {
      const roundedAuto = Math.round((autoTotalKg + Number.EPSILON) * 100) / 100;
      return { ...prev, total_kg: roundedAuto };
    });
  }, [autoTotalKg, open]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  const handleSubmit = (event) => {
    event.preventDefault();
    setError(null);

    if (hasBlockingError) {
      setError(validationErrors[0]);
      return;
    }

    if (!form.report_date) {
      setError("Tanggal wajib diisi.");
      return;
    }

    for (const [field, label] of [
      ["total_portions", "Total porsi"],
      ["carb_source", "Sumber karbohidrat"],
      ["protein_source", "Sumber protein"],
      ["vegetable", "Sayur"],
      ["fruit", "Buah"],
      ["total_kg", "Total kg"],
    ]) {
      if (Number(form[field] || 0) < 0) {
        setError(`${label} tidak boleh negatif.`);
        return;
      }
    }

    onSubmit({
      report_date: form.report_date,
      total_portions: Number(form.total_portions || 0),
      carb_source: Number(form.carb_source || 0),
      protein_source: Number(form.protein_source || 0),
      vegetable: Number(form.vegetable || 0),
      fruit: Number(form.fruit || 0),
      total_kg: Number(form.total_kg || 0),
      menu_notes: String(form.menu_notes || "").trim(),
    });
  };

  const handleWasteKeyDown = (event, field) => {
    if (event.key !== "Enter") return;
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();

    const fieldOrder = ["total_portions", ...WASTE_ROWS.map((row) => row.field), "menu_notes"];
    const currentIndex = fieldOrder.indexOf(field);
    const nextField = fieldOrder[Math.min(currentIndex + 1, fieldOrder.length - 1)];
    focusWasteField(nextField);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="modal-card data-form-card data-form-card-lg food-waste-compact-card"
        role="dialog"
        aria-modal="true"
        onSubmit={handleSubmit}
      >
        <div className="modal-header daily-report-editor-header food-waste-editor-header">
          <button
            type="button"
            className="daily-form-close-icon daily-form-close-leading"
            aria-label="Tutup form input sisa pangan"
            onClick={onClose}
            disabled={loading}
          >
            <AppIcon name="close" size={20} weight={APP_ICON_WEIGHT.action} />
          </button>
          <div className="daily-form-header-main min-w-0 flex-1">
            <div className="daily-form-header-icon">
              <AppIcon name="foodWaste" size={24} weight={APP_ICON_WEIGHT.summary} />
            </div>
            <div className="daily-form-header-copy">
              <h3>{initialData?.id ? "Edit sisa pangan" : "Tambah sisa pangan"}</h3>
              <p>Catat sisa pangan harian dengan input ringkas dan konteks otomatis.</p>
            </div>
          </div>
        </div>

        <div className="modal-form data-form food-waste-compact-form">
          <StickyFormHeader className="food-waste-sticky-header">
            <div className="daily-editor-command-row food-waste-command-row">
              <div className="daily-editor-date-field">
                <div className="date-input-wrap">
                  <label htmlFor="food_waste_date">Tanggal</label>
                  <input
                    id="food_waste_date"
                    type="date"
                    value={form.report_date}
                    onChange={(event) => handleChange("report_date", event.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="daily-editor-metric">
                <span>Total porsi</span>
                <strong>{formatPortions(form.total_portions)}</strong>
              </div>
              <div className="daily-editor-metric food-waste-total-metric">
                <span>Total sisa</span>
                <strong>{formatWeight(form.total_kg)}</strong>
              </div>
              <div className={`daily-editor-metric ${hasBlockingError ? "menu-warning-metric" : ""}`}>
                <span>Persentase sisa</span>
                <strong>{wastePercentage.toFixed(2)}%</strong>
              </div>
            </div>

            <div className="daily-editor-tools food-waste-editor-tools">
              <div className={`daily-realtime-status ${hasBlockingError ? "warning" : "ready"}`}>
                <AppIcon
                  name={hasBlockingError ? "statusPartial" : "statusFull"}
                  size={16}
                  weight={APP_ICON_WEIGHT.action}
                />
                {hasBlockingError
                  ? `${validationErrors.length} data wajib belum valid.`
                  : "Data otomatis ditampilkan sebagai konteks. Enter pindah field berikutnya."}
              </div>
              <div className="food-waste-context-pills">
                <span className={`food-waste-context-pill ${portionReferenceState?.kind || "info"}`}>
                  Porsi: {portionReferenceState?.kind === "success" ? "otomatis" : "manual"}
                </span>
                <span className={`food-waste-context-pill ${menuReferenceState?.kind || "info"}`}>
                  Menu: {menuAutoFilled ? "otomatis" : "manual"}
                </span>
              </div>
            </div>
          </StickyFormHeader>

          <div className="food-waste-compact-workspace">
            <div className="food-waste-compact-main">
              <section className="food-waste-spreadsheet-section">
                <div className="menu-spreadsheet-head">
                  <div>
                    <span className="menu-spreadsheet-kicker">Konteks laporan</span>
                    <h4>Tanggal, porsi, dan menu</h4>
                  </div>
                  <span>{loadingMenuReference ? "Memuat menu..." : menuAutoFilled ? "Menu otomatis" : "Menu manual"}</span>
                </div>

                <div className="food-waste-context-grid">
                  <label className="food-waste-context-field">
                    <span>Total porsi</span>
                    <input
                      id="food_waste_total_portions"
                      data-food-waste-field="total_portions"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.total_portions}
                      onChange={(event) => handleNumberChange("total_portions", event.target.value)}
                      onKeyDown={(event) => handleWasteKeyDown(event, "total_portions")}
                      disabled={loading}
                    />
                    <small>{portionReferenceState?.message || "Diambil dari Laporan Harian bila tersedia."}</small>
                  </label>
                  <label className="food-waste-context-field food-waste-menu-field">
                    <span>Menu / keterangan bahan sisa</span>
                    <textarea
                      id="food_waste_menu_notes"
                      data-food-waste-field="menu_notes"
                      rows="3"
                      value={form.menu_notes}
                      onChange={(event) => {
                        setMenuAutoFilled(false);
                        handleChange("menu_notes", event.target.value);
                      }}
                      disabled={loading}
                      placeholder="Akan terisi otomatis dari laporan menu jika tanggal tersedia."
                    />
                    {form.report_date ? (
                      <small>
                        {loadingMenuReference
                          ? "Memuat referensi menu..."
                          : menuReferenceState?.message || formatInfoState(menuReferenceState)}
                      </small>
                    ) : null}
                  </label>
                </div>
              </section>

              <section className="food-waste-spreadsheet-section">
                <div className="menu-spreadsheet-head">
                  <div>
                    <span className="menu-spreadsheet-kicker">Kategori sisa</span>
                    <h4>Input berat per kategori</h4>
                  </div>
                  <span>Total dihitung otomatis</span>
                </div>

                <div className="food-waste-row-table" role="table" aria-label="Kategori sisa pangan">
                  <div className="food-waste-row food-waste-row-head" role="row">
                    <span>Kategori</span>
                    <span>Berat</span>
                    <span>Satuan</span>
                  </div>
                  {WASTE_ROWS.map((row) => (
                    <div className="food-waste-row" role="row" key={row.field}>
                      <strong>{row.label}</strong>
                      <input
                        id={`food_waste_${row.field}`}
                        data-food-waste-field={row.field}
                        type="number"
                        min="0"
                        step="0.01"
                        value={form[row.field]}
                        onChange={(event) => handleNumberChange(row.field, event.target.value)}
                        onKeyDown={(event) => handleWasteKeyDown(event, row.field)}
                        disabled={loading}
                      />
                      <span>kg</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <SummaryPanelCard
              className="food-waste-compact-summary"
              title="Ringkasan sisa"
              rows={[
                { label: "Total porsi", value: formatPortions(form.total_portions) },
                { label: "Total sisa", value: formatWeight(form.total_kg) },
                { label: "Sisa per porsi", value: `${formatNumber(wastePerPortion)} kg` },
              ]}
              totalLabel="Persentase sisa"
              totalValue={`${wastePercentage.toFixed(2)}%`}
              submitLabel="Simpan sisa"
              loading={loading}
              disabled={hasBlockingError}
              disabledReason={validationErrors[0]}
              note="Total kg otomatis dari empat kategori. Payload tetap memakai field lama."
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <MobileSubmitBar
            className="food-waste-mobile-submit-bar"
            title={formatWeight(form.total_kg)}
            subtitle={`${wastePercentage.toFixed(2)}% dari ${formatPortions(form.total_portions)} porsi`}
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
        </div>
      </form>
    </div>
  );
}
