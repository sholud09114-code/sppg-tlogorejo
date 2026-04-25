import { useEffect, useMemo, useState } from "react";
import { fetchReportByDate } from "../api/dailyReportApi.js";
import { fetchFoodWasteMenuReference } from "../api/foodWasteApi.js";

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

export default function FoodWasteForm({
  open,
  initialData,
  loading,
  onClose,
  onSubmit,
}) {
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
      } catch (err) {
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
  }, [form.report_date, form.menu_notes, open, menuAutoFilled, initialData?.id, initialData?.report_date]);

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
            sum +
            Number(item.actual_small_portion || 0) +
            Number(item.actual_large_portion || 0),
          0
        );

        setPortionReferenceState({
          kind: "success",
          message: "Total porsi diisi otomatis dari Laporan Harian. Tetap bisa Anda ubah bila perlu.",
        });

        setForm((prev) => ({
          ...prev,
          total_portions:
            !prev.total_portions ||
            (initialData?.id && prev.report_date !== initialData.report_date)
              ? totalPortions
              : prev.total_portions,
        }));
      } catch (err) {
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

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="modal-card report-modal-card w-full max-w-4xl rounded-2xl p-4 sm:p-5"
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <div>
            <h3>{initialData?.id ? "Edit sisa pangan" : "Tambah sisa pangan"}</h3>
            <p>Input data sisa pangan harian dan hubungkan menu otomatis berdasarkan tanggal.</p>
          </div>
          <button type="button" onClick={onClose} disabled={loading}>
            Tutup
          </button>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="food_waste_date">Tanggal</label>
            <input
              id="food_waste_date"
              type="date"
              value={form.report_date}
              onChange={(event) => handleChange("report_date", event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="food_waste_total_portions">Total porsi</label>
            <input
              id="food_waste_total_portions"
              type="number"
              min="0"
              step="0.01"
              value={form.total_portions}
              onChange={(event) => handleNumberChange("total_portions", event.target.value)}
              disabled={loading}
            />
            <small className="field-hint">
              {portionReferenceState?.message ||
                "Akan diambil dari Laporan Harian jika tanggal tersedia, tetap bisa disesuaikan."}
            </small>
          </div>

          <div className="form-field">
            <label htmlFor="food_waste_carb">Sumber Karbohidrat (kg)</label>
            <input
              id="food_waste_carb"
              type="number"
              min="0"
              step="0.01"
              value={form.carb_source}
              onChange={(event) => handleNumberChange("carb_source", event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="food_waste_protein">Sumber Protein (kg)</label>
            <input
              id="food_waste_protein"
              type="number"
              min="0"
              step="0.01"
              value={form.protein_source}
              onChange={(event) => handleNumberChange("protein_source", event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="food_waste_vegetable">Sayur (kg)</label>
            <input
              id="food_waste_vegetable"
              type="number"
              min="0"
              step="0.01"
              value={form.vegetable}
              onChange={(event) => handleNumberChange("vegetable", event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="food_waste_fruit">Buah (kg)</label>
            <input
              id="food_waste_fruit"
              type="number"
              min="0"
              step="0.01"
              value={form.fruit}
              onChange={(event) => handleNumberChange("fruit", event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field form-field-wide">
            <label htmlFor="food_waste_total">Total (kg)</label>
            <input
              id="food_waste_total"
              type="number"
              min="0"
              step="0.01"
              value={form.total_kg}
              readOnly
              disabled
            />
            <small className="field-hint">Otomatis dari sumber karbohidrat + protein + sayur + buah.</small>
          </div>
        </div>

        <div className="form-field mt-4">
          <label htmlFor="food_waste_menu_notes">Menu / Keterangan bahan sisa</label>
          <textarea
            id="food_waste_menu_notes"
            rows="4"
            value={form.menu_notes}
            onChange={(event) => {
              setMenuAutoFilled(false);
              handleChange("menu_notes", event.target.value);
            }}
            disabled={loading}
            placeholder="Akan terisi otomatis dari laporan menu jika tanggal tersedia."
          />
          {form.report_date && (
            <div
              className={`toast mt-2 rounded-xl px-4 py-3 text-sm ${
                menuReferenceState?.kind || "info"
              }`}
            >
              {loadingMenuReference
                ? "Memuat referensi menu..."
                : menuReferenceState?.message || formatInfoState(menuReferenceState)}
            </div>
          )}
        </div>

        {error && <div className="error-message mt-3">{error}</div>}

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={loading}>
            Batal
          </button>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
