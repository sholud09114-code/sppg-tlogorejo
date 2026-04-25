import { useMemo, useState } from "react";
import {
  importBeneficiaryGroups,
  previewBeneficiaryGroupImport,
} from "../api/beneficiaryGroupApi.js";

const TEMPLATE_HEADERS = [
  "jenis_kelompok",
  "nama_kelompok",
  "porsi_siswa_kecil",
  "porsi_siswa_besar",
  "porsi_guru_tendik_kecil",
  "porsi_guru_tendik_besar",
];

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
        className="modal-card flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div>
            <h3>Import CSV/Excel</h3>
            <p>Upload file, cek preview, lalu simpan data kelompok secara batch.</p>
          </div>
          <button type="button" onClick={handleClose} disabled={loading || importing}>
            Tutup
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-black/8 bg-white px-4 py-2 text-sm">
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
            onClick={downloadTemplate}
            disabled={loading || importing}
          >
            Download template CSV
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
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="summary-card rounded-2xl p-4">
                  <span className="summary-card-label">Total baris preview</span>
                  <strong>{preview.rows.length.toLocaleString("id-ID")}</strong>
                </div>
                <div className="summary-card rounded-2xl p-4">
                  <span className="summary-card-label">Status validasi</span>
                  <strong className={hasInvalidRows ? "text-[#a34040]" : "text-[#2f6b11]"}>
                    {hasInvalidRows ? "Ada baris tidak valid" : "Semua baris valid"}
                  </strong>
                </div>
              </div>

              <div className="table-wrap overflow-x-auto rounded-2xl">
                <table className="data-table min-w-[1120px]">
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
                      <tr key={row.row_number}>
                        <td className="text-center">{row.row_number}</td>
                        <td className="text-left">{row.data?.group_type || row.raw.group_type || "-"}</td>
                        <td className="text-left">{row.data?.group_name || row.raw.group_name || "-"}</td>
                        <td className="text-right">{Number(row.data?.student_small_portion || 0).toLocaleString("id-ID")}</td>
                        <td className="text-right">{Number(row.data?.student_large_portion || 0).toLocaleString("id-ID")}</td>
                        <td className="text-right">{Number(row.data?.staff_small_portion || 0).toLocaleString("id-ID")}</td>
                        <td className="text-right">{Number(row.data?.staff_large_portion || 0).toLocaleString("id-ID")}</td>
                        <td className="text-center">
                          {row.errors.length ? (
                            <span className="text-[#a34040]">{row.errors.join(", ")}</span>
                          ) : (
                            <span className="text-[#2f6b11]">Valid</span>
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
