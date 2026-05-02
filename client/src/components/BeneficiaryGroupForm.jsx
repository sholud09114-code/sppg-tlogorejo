import { useEffect, useMemo, useState } from "react";
import { MobileSubmitBar, StickyFormHeader, SummaryPanelCard } from "./ui/FormPatterns.jsx";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

const GROUP_TYPE_OPTIONS = ["Paud/KB/TK", "SD", "SMP/MTs", "SMK"];
const NUMBER_FIELDS = [
  "student_small_portion",
  "student_large_portion",
  "staff_small_portion",
  "staff_large_portion",
];

function getInitialState(initialData) {
  return {
    group_type: initialData?.group_type || "Paud/KB/TK",
    group_name: initialData?.group_name || "",
    student_small_portion: initialData?.student_small_portion ?? 0,
    student_large_portion: initialData?.student_large_portion ?? 0,
    staff_small_portion: initialData?.staff_small_portion ?? 0,
    staff_large_portion: initialData?.staff_large_portion ?? 0,
  };
}

export default function BeneficiaryGroupForm({ open, initialData, loading, onClose, onSubmit }) {
  const [form, setForm] = useState(getInitialState(initialData));
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(getInitialState(initialData));
      setSubmitAttempted(false);
    }
  }, [open, initialData]);

  const totalPortion = useMemo(
    () => NUMBER_FIELDS.reduce((sum, field) => sum + Number(form[field] || 0), 0),
    [form]
  );

  const validation = useMemo(() => {
    const fieldErrors = {};

    if (!GROUP_TYPE_OPTIONS.includes(form.group_type)) {
      fieldErrors.group_type = "Jenis kelompok wajib dipilih.";
    }

    if (!String(form.group_name || "").trim()) {
      fieldErrors.group_name = "Nama kelompok wajib diisi.";
    }

    NUMBER_FIELDS.forEach((field) => {
      const value = form[field] === "" ? 0 : Number(form[field]);
      if (!Number.isFinite(value) || value < 0) {
        fieldErrors[field] = "Isi 0 atau lebih.";
      }
    });

    if (totalPortion <= 0) {
      fieldErrors.total = "Total porsi masih 0.";
    }

    return {
      fieldErrors,
      isValid: Object.keys(fieldErrors).length === 0,
    };
  }, [form, totalPortion]);

  const validationMessages = Object.values(validation.fieldErrors);

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
    if (!Number.isFinite(nextValue)) {
      return;
    }

    handleChange(field, nextValue);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitAttempted(true);

    const payload = {
      group_type: form.group_type,
      group_name: form.group_name.trim(),
    };

    for (const field of NUMBER_FIELDS) {
      const value = form[field] === "" ? 0 : Number(form[field]);
      payload[field] = value;
    }

    if (!validation.isValid) return;
    onSubmit(payload);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card data-form-card data-form-card-lg" role="dialog" aria-modal="true">
        <StickyFormHeader className="beneficiary-form-header">
          <button
            type="button"
            className="daily-form-close-icon daily-form-close-leading"
            onClick={onClose}
            disabled={loading}
            aria-label="Tutup form"
          >
            <AppIcon name="close" size={18} weight={APP_ICON_WEIGHT.action} />
          </button>

          <div className="unified-modal-title">
            <span className="unified-modal-icon">
              <AppIcon name="beneficiaries" size={22} weight={APP_ICON_WEIGHT.summary} />
            </span>
            <div className="unified-modal-title-copy">
              <h3>{initialData?.id ? "Edit kelompok" : "Tambah kelompok"}</h3>
              <p>Master target PM untuk laporan harian dan agregasi operasional.</p>
            </div>
          </div>

          <div className="beneficiary-form-header-status">
            <span>Total PM</span>
            <strong>{totalPortion.toLocaleString("id-ID")}</strong>
          </div>
        </StickyFormHeader>

        <form className="modal-form data-form" onSubmit={handleSubmit}>
          <div className="data-form-body beneficiary-form-layout">
            <div className="beneficiary-form-main">
            <section className="data-form-section">
              <div className="data-form-section-head">
                <span className="data-form-step">1.</span>
                <div>
                  <h4>Data Kelompok</h4>
                  <p>Pilih jenis kelompok dan isi nama penerima manfaat.</p>
                </div>
              </div>
              <div className="form-grid grid-cols-1 md:grid-cols-2">
                <div className="form-field">
                  <label htmlFor="group_type">Jenis Kelompok</label>
                  <select
                    id="group_type"
                    className="w-full"
                    value={form.group_type}
                    onChange={(e) => handleChange("group_type", e.target.value)}
                    disabled={loading}
                    aria-invalid={Boolean(validation.fieldErrors.group_type)}
                  >
                    {GROUP_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {validation.fieldErrors.group_type ? (
                    <span className="field-error-text">{validation.fieldErrors.group_type}</span>
                  ) : null}
                </div>

                <div className="form-field form-field-wide">
                  <label htmlFor="group_name">Nama Kelompok</label>
                  <input
                    id="group_name"
                    type="text"
                    className="w-full"
                    value={form.group_name}
                    onChange={(e) => handleChange("group_name", e.target.value)}
                    placeholder="Contoh: SDN 1 Tlogorejo"
                    disabled={loading}
                    aria-invalid={Boolean(validation.fieldErrors.group_name)}
                  />
                  {validation.fieldErrors.group_name ? (
                    <span className="field-error-text">{validation.fieldErrors.group_name}</span>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="data-form-section">
              <div className="data-form-section-head">
                <span className="data-form-step">2.</span>
                <div>
                  <h4>Rincian Porsi</h4>
                  <p>Isi jumlah porsi siswa dan guru/tendik untuk kelompok ini.</p>
                </div>
              </div>
              <div className="form-grid grid-cols-1 md:grid-cols-2">
                <div className="form-field">
                  <label htmlFor="student_small_portion">Porsi Siswa Kecil</label>
                  <input
                    id="student_small_portion"
                    type="number"
                    className="w-full"
                    min="0"
                    value={form.student_small_portion}
                    onChange={(e) => handleNumberChange("student_small_portion", e.target.value)}
                    disabled={loading}
                    aria-invalid={Boolean(validation.fieldErrors.student_small_portion)}
                  />
                  {validation.fieldErrors.student_small_portion ? (
                    <span className="field-error-text">{validation.fieldErrors.student_small_portion}</span>
                  ) : null}
                </div>

                <div className="form-field">
                  <label htmlFor="student_large_portion">Porsi Siswa Besar</label>
                  <input
                    id="student_large_portion"
                    type="number"
                    className="w-full"
                    min="0"
                    value={form.student_large_portion}
                    onChange={(e) => handleNumberChange("student_large_portion", e.target.value)}
                    disabled={loading}
                    aria-invalid={Boolean(validation.fieldErrors.student_large_portion)}
                  />
                  {validation.fieldErrors.student_large_portion ? (
                    <span className="field-error-text">{validation.fieldErrors.student_large_portion}</span>
                  ) : null}
                </div>

                <div className="form-field">
                  <label htmlFor="staff_small_portion">Porsi Guru/Tendik Kecil</label>
                  <input
                    id="staff_small_portion"
                    type="number"
                    className="w-full"
                    min="0"
                    value={form.staff_small_portion}
                    onChange={(e) => handleNumberChange("staff_small_portion", e.target.value)}
                    disabled={loading}
                    aria-invalid={Boolean(validation.fieldErrors.staff_small_portion)}
                  />
                  {validation.fieldErrors.staff_small_portion ? (
                    <span className="field-error-text">{validation.fieldErrors.staff_small_portion}</span>
                  ) : null}
                </div>

                <div className="form-field">
                  <label htmlFor="staff_large_portion">Porsi Guru/Tendik Besar</label>
                  <input
                    id="staff_large_portion"
                    type="number"
                    className="w-full"
                    min="0"
                    value={form.staff_large_portion}
                    onChange={(e) => handleNumberChange("staff_large_portion", e.target.value)}
                    disabled={loading}
                    aria-invalid={Boolean(validation.fieldErrors.staff_large_portion)}
                  />
                  {validation.fieldErrors.staff_large_portion ? (
                    <span className="field-error-text">{validation.fieldErrors.staff_large_portion}</span>
                  ) : null}
                </div>
              </div>
            </section>
            </div>

            <SummaryPanelCard
              className="beneficiary-form-summary"
              title="Ringkasan kelompok"
              icon="beneficiaries"
              rows={[
                { label: "Jenis", value: form.group_type || "-" },
                { label: "Siswa", value: (Number(form.student_small_portion || 0) + Number(form.student_large_portion || 0)).toLocaleString("id-ID") },
                { label: "Guru/Tendik", value: (Number(form.staff_small_portion || 0) + Number(form.staff_large_portion || 0)).toLocaleString("id-ID") },
                { label: "Status", value: validation.isValid ? "Siap disimpan" : `${validationMessages.length} perlu cek` },
              ]}
              totalLabel="Total target PM"
              totalValue={totalPortion.toLocaleString("id-ID")}
              submitLabel="Simpan kelompok"
              loading={loading}
              disabled={!validation.isValid}
              disabledReason={validationMessages[0] || ""}
              note={validation.fieldErrors.total ? validation.fieldErrors.total : "Perubahan hanya mengubah master data kelompok, bukan laporan yang sudah tersimpan."}
            />
          </div>

          {submitAttempted && !validation.isValid ? (
            <div className="error-message">{validationMessages[0]}</div>
          ) : null}

          <div className="modal-actions data-form-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="submit-btn" disabled={loading || !validation.isValid}>
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>

          <MobileSubmitBar
            title={`${totalPortion.toLocaleString("id-ID")} target PM`}
            subtitle={validation.isValid ? "Siap disimpan" : `${validationMessages.length} perlu cek`}
          >
            <button type="submit" className="submit-btn" disabled={loading || !validation.isValid}>
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </MobileSubmitBar>
        </form>
      </div>
    </div>
  );
}
