import { useEffect, useMemo, useState } from "react";

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
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(getInitialState(initialData));
      setError(null);
    }
  }, [open, initialData]);

  const totalPortion = useMemo(
    () => NUMBER_FIELDS.reduce((sum, field) => sum + Number(form[field] || 0), 0),
    [form]
  );

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

    if (!form.group_type) {
      setError("Jenis kelompok wajib dipilih.");
      return;
    }

    if (!form.group_name.trim()) {
      setError("Nama kelompok wajib diisi.");
      return;
    }

    const payload = {
      group_type: form.group_type,
      group_name: form.group_name.trim(),
    };

    for (const field of NUMBER_FIELDS) {
      const value = form[field] === "" ? 0 : Number(form[field]);
      if (!Number.isFinite(value) || value < 0) {
        setError("Semua jumlah porsi harus bernilai 0 atau lebih.");
        return;
      }
      payload[field] = value;
    }

    setError(null);
    onSubmit(payload);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card data-form-card data-form-card-md" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h3>{initialData?.id ? "Edit kelompok" : "Tambah kelompok"}</h3>
            <p>Kelola jumlah porsi berdasarkan kelompok penerima manfaat.</p>
          </div>
          <button type="button" onClick={onClose} disabled={loading}>
            Tutup
          </button>
        </div>

        <form className="modal-form data-form" onSubmit={handleSubmit}>
          <div className="data-form-body">
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
                  >
                    {GROUP_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
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
                  />
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
                  />
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
                  />
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
                  />
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
                  />
                </div>
              </div>
            </section>

            <div className="modal-total">
              <span>Total Porsi</span>
              <strong>{totalPortion.toLocaleString("id-ID")}</strong>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions data-form-actions">
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
