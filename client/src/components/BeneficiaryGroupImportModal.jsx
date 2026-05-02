import { useMemo, useState } from "react";
import {
  importBeneficiaryGroups,
  previewBeneficiaryGroupImport,
} from "../api/beneficiaryGroupApi.js";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

const TEMPLATE_HEADERS = [
  "jenis_kelompok",
  "nama_kelompok",
  "porsi_siswa_kecil",
  "porsi_siswa_besar",
  "porsi_guru_tendik_kecil",
  "porsi_guru_tendik_besar",
];
const MAX_GROUP_IMPORT_SIZE_BYTES = 5 * 1024 * 1024;

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function downloadTemplate() {
  const template = [
    "# Petunjuk: isi kolom sesuai header di bawah.",
    "# Jenis Kelompok yang valid: Paud/KB/TK | SD | SMP/MTs | SMK",
    TEMPLATE_HEADERS.join(";"),
    "Paud/KB/TK;KB Mawar;12;4;1;1",
    "SD;SD Tlogorejo 1;30;10;2;1",
  ].join("\n");

  const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "template-import-kelompok.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function BeneficiaryGroupImportModal({
  open,
  onClose,
  onImported,
}) {
  const [filePayload, setFilePayload] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const hasInvalidRows = useMemo(
    () => preview?.rows?.some((row) => row.errors.length > 0),
    [preview]
  );
  const previewStats = useMemo(() => {
    const rows = preview?.rows || [];
    const invalidRows = rows.filter((row) => row.errors.length > 0).length;
    return {
      total: rows.length,
      invalid: invalidRows,
      valid: rows.length - invalidRows,
    };
  }, [preview]);

  if (!open) return null;

  const resetState = () => {
    setFilePayload(null);
    setPreview(null);
    setLoading(false);
    setImporting(false);
    setError(null);
  };

  const handleClose = () => {
    if (loading || importing) return;
    resetState();
    onClose();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_GROUP_IMPORT_SIZE_BYTES) {
      event.target.value = "";
      setError("Ukuran file import maksimal 5 MB agar preview tetap stabil.");
      setPreview(null);
      setFilePayload(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const buffer = await file.arrayBuffer();
      const payload = {
        file_name: file.name,
        file_content_base64: arrayBufferToBase64(buffer),
      };

      const result = await previewBeneficiaryGroupImport(payload);
      setFilePayload(payload);
      setPreview(result);
    } catch (err) {
      setError(err.message);
      setPreview(null);
      setFilePayload(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!filePayload || !preview || hasInvalidRows) return;

    try {
      setImporting(true);
      setError(null);
      const result = await importBeneficiaryGroups(filePayload);
      resetState();
      onImported(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card beneficiary-import-modal flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header beneficiary-import-header">
          <div className="unified-modal-title">
            <span className="unified-modal-icon">
              <AppIcon name="import" size={22} weight={APP_ICON_WEIGHT.summary} />
            </span>
            <div className="unified-modal-title-copy">
              <h3>Import CSV/Excel</h3>
              <p>Upload file, cek preview, lalu simpan data kelompok secara batch.</p>
            </div>
          </div>
          <button
            type="button"
            className="daily-form-close-icon"
            onClick={handleClose}
            disabled={loading || importing}
            aria-label="Tutup import"
          >
            <AppIcon name="close" size={18} weight={APP_ICON_WEIGHT.action} />
          </button>
        </div>

        <div className="beneficiary-import-toolbar">
          <label className="status-quick-btn beneficiary-file-picker">
            <AppIcon name="import" size={16} weight={APP_ICON_WEIGHT.action} />
            Pilih file
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
              disabled={loading || importing}
            />
          </label>

          <button
            type="button"
            className="daily-reset-btn"
            onClick={downloadTemplate}
            disabled={loading || importing}
          >
            <span className="button-with-icon">
              <AppIcon name="docs" size={16} weight={APP_ICON_WEIGHT.action} />
              Download template CSV
            </span>
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {!preview && !loading && !error && (
            <div className="empty-state rounded-2xl px-4 py-8">
              Pilih file CSV atau Excel untuk melihat preview import.
            </div>
          )}

          {loading && <div className="loading">Membaca file dan memvalidasi data...</div>}

          {error && <div className="toast danger mt-4 rounded-xl px-4 py-3">{error}</div>}

          {preview && (
            <div className="space-y-4">
              <div className="beneficiary-import-stats">
                <div className="summary-card rounded-2xl p-4">
                  <span className="summary-card-label">Total baris preview</span>
                  <strong>{previewStats.total.toLocaleString("id-ID")}</strong>
                </div>
                <div className="summary-card rounded-2xl p-4">
                  <span className="summary-card-label">Siap import</span>
                  <strong className="text-[#2f6b11]">{previewStats.valid.toLocaleString("id-ID")}</strong>
                </div>
                <div className="summary-card rounded-2xl p-4">
                  <span className="summary-card-label">Perlu cek</span>
                  <strong className={hasInvalidRows ? "text-[#a34040]" : "text-[#2f6b11]"}>
                    {previewStats.invalid.toLocaleString("id-ID")}
                  </strong>
                </div>
              </div>

              <div className="beneficiary-import-mobile-list">
                {preview.rows.map((row) => {
                  const invalid = row.errors.length > 0;
                  return (
                    <article className={`mobile-data-card beneficiary-import-preview-card ${invalid ? "needs-review" : ""}`} key={row.row_number}>
                      <div className="mobile-data-card-head">
                        <div>
                          <div className="mobile-data-card-title">
                            {row.data?.group_name || row.raw.group_name || "-"}
                          </div>
                          <div className="mobile-data-card-subtitle">
                            Baris {row.row_number} · {row.data?.group_type || row.raw.group_type || "-"}
                          </div>
                        </div>
                        <span className={`beneficiary-status-pill ${invalid ? "warning" : "ok"}`}>
                          {invalid ? "Error" : "Valid"}
                        </span>
                      </div>
                      <div className="mobile-metric-grid">
                        <div className="mobile-metric">
                          <span>Siswa kecil</span>
                          <strong>{Number(row.data?.student_small_portion || 0).toLocaleString("id-ID")}</strong>
                        </div>
                        <div className="mobile-metric">
                          <span>Siswa besar</span>
                          <strong>{Number(row.data?.student_large_portion || 0).toLocaleString("id-ID")}</strong>
                        </div>
                        <div className="mobile-metric">
                          <span>Guru kecil</span>
                          <strong>{Number(row.data?.staff_small_portion || 0).toLocaleString("id-ID")}</strong>
                        </div>
                        <div className="mobile-metric">
                          <span>Guru besar</span>
                          <strong>{Number(row.data?.staff_large_portion || 0).toLocaleString("id-ID")}</strong>
                        </div>
                      </div>
                      {invalid ? <div className="beneficiary-issue-list"><span>{row.errors.join(", ")}</span></div> : null}
                    </article>
                  );
                })}
              </div>

              <div className="table-wrap beneficiary-import-table-wrap overflow-x-auto rounded-2xl">
                <table className="data-table beneficiary-import-table min-w-[1120px]">
                  <thead>
                    <tr>
                      <th className="text-center">Baris</th>
                      <th className="text-left">Jenis Kelompok</th>
                      <th className="text-left">Nama Kelompok</th>
                      <th className="text-right">Porsi Siswa Kecil</th>
                      <th className="text-right">Porsi Siswa Besar</th>
                      <th className="text-right">Porsi Guru/Tendik Kecil</th>
                      <th className="text-right">Porsi Guru/Tendik Besar</th>
                      <th className="text-center">Validasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.row_number} className={row.errors.length ? "needs-review" : ""}>
                        <td className="text-center">{row.row_number}</td>
                        <td className="text-left">{row.data?.group_type || row.raw.group_type || "-"}</td>
                        <td className="text-left">{row.data?.group_name || row.raw.group_name || "-"}</td>
                        <td className="text-right">{Number(row.data?.student_small_portion || 0).toLocaleString("id-ID")}</td>
                        <td className="text-right">{Number(row.data?.student_large_portion || 0).toLocaleString("id-ID")}</td>
                        <td className="text-right">{Number(row.data?.staff_small_portion || 0).toLocaleString("id-ID")}</td>
                        <td className="text-right">{Number(row.data?.staff_large_portion || 0).toLocaleString("id-ID")}</td>
                        <td className="text-center">
                          {row.errors.length ? (
                            <span className="beneficiary-status-note text-[#a34040]">{row.errors.join(", ")}</span>
                          ) : (
                            <span className="beneficiary-status-pill ok">Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions border-t border-black/8 pt-3">
          <button type="button" onClick={handleClose} disabled={loading || importing}>
            Batal
          </button>
          <button
            type="button"
            className="submit-btn"
            onClick={handleImport}
            disabled={!preview || hasInvalidRows || loading || importing}
          >
            {importing ? "Mengimpor..." : "Import data"}
          </button>
        </div>
      </div>
    </div>
  );
}
