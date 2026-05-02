import { useMemo, useState } from "react";
import {
  importReportsBatch,
  previewReportImport,
} from "../api/dailyReportApi.js";
import { formatDateLong } from "../shared/utils/formatters.js";
import { AppIcon, APP_ICON_WEIGHT } from "./ui/appIcons.jsx";

const MAX_BATCH_IMPORT_SIZE_BYTES = 5 * 1024 * 1024;

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function downloadTemplate(units) {
  const headers = [
    "tanggal",
    "hari",
    "keterangan",
    "total_penerima_manfaat",
    ...units.map((unit) => unit.name),
  ];

  const sampleRows = [
    ["21-04-2026", "Selasa", "", "", ...units.map((unit) => unit.default_target)],
    ["22-04-2026", "Rabu", "Sebagian libur", "", ...units.map(() => "LIBUR")],
    [
      "23-04-2026",
      "Kamis",
      "",
      "",
      ...units.map((unit, index) =>
        index % 3 === 0 ? "LIBUR" : Math.max(unit.default_target - 5, 0)
      ),
    ],
  ];

  const template = [
    "# Template import batch laporan harian. Satu baris mewakili satu tanggal laporan.",
    "# Isi kolom sekolah dengan angka aktual atau LIBUR. Kolom total_penerima_manfaat boleh dikosongkan.",
    headers.join(";"),
    ...sampleRows.map((row) => row.join(";")),
  ].join("\n");

  const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "template-import-laporan-harian-batch.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function DailyReportImportModal({
  open,
  onClose,
  onImported,
  units,
}) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [filePayload, setFilePayload] = useState(null);

  const hasInvalidRows = useMemo(
    () => preview?.rows?.some((row) => row.errors.length > 0),
    [preview]
  );

  if (!open) return null;

  const reset = () => {
    setPreview(null);
    setLoading(false);
    setImporting(false);
    setError(null);
    setFilePayload(null);
  };

  const handleClose = () => {
    if (loading || importing) return;
    reset();
    onClose();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BATCH_IMPORT_SIZE_BYTES) {
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
      const result = await previewReportImport(payload);
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
      const result = await importReportsBatch(filePayload);
      reset();
      onImported(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-backdrop p-3 sm:p-4" role="presentation">
      <div
        className="modal-card flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="unified-modal-title">
            <span className="unified-modal-icon">
              <AppIcon name="import" size={22} weight={APP_ICON_WEIGHT.summary} />
            </span>
            <div className="unified-modal-title-copy">
              <h3>Import CSV/Excel laporan harian</h3>
              <p>
                Upload file matriks harian untuk memuat beberapa tanggal laporan
                sekaligus.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading || importing}
            aria-label="Tutup import laporan harian"
          >
            Tutup
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Format file</span>
            <strong>Matriks tanggal x sekolah</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Nilai sel sekolah</span>
            <strong>Angka aktual atau LIBUR</strong>
          </div>
          <div className="summary-card rounded-2xl p-4">
            <span className="summary-card-label">Jumlah kolom sekolah</span>
            <strong>{units.length.toLocaleString("id-ID")}</strong>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
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
            onClick={() => downloadTemplate(units)}
            disabled={loading || importing}
          >
            Download template CSV
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-black/8 bg-[#fcfbf8] px-4 py-3 text-sm text-[#5f5e5a]">
          Kolom wajib: <strong>tanggal</strong>, lalu satu kolom untuk setiap
          sekolah aktif. Kolom <strong>hari</strong>,{" "}
          <strong>keterangan</strong>, dan{" "}
          <strong>total_penerima_manfaat</strong> bersifat opsional.
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {!preview && !loading && !error && (
            <div className="empty-state rounded-2xl px-4 py-8">
              Pilih file CSV atau Excel untuk melihat preview import batch
              laporan harian.
            </div>
          )}

          {loading && (
            <div className="loading">Membaca file dan memvalidasi data batch...</div>
          )}

          {error && (
            <div className="toast danger mt-4 rounded-xl px-4 py-3">{error}</div>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="summary-card rounded-2xl p-4">
                  <span className="summary-card-label">Total tanggal preview</span>
                  <strong>{preview.rows.length.toLocaleString("id-ID")}</strong>
                </div>
                <div className="summary-card rounded-2xl p-4">
                  <span className="summary-card-label">Akumulasi PM</span>
                  <strong>
                    {preview.rows
                      .reduce((sum, row) => sum + Number(row.total_pm || 0), 0)
                      .toLocaleString("id-ID")}
                  </strong>
                </div>
                <div className="summary-card rounded-2xl p-4">
                  <span className="summary-card-label">Status validasi</span>
                  <strong
                    className={hasInvalidRows ? "text-[#a34040]" : "text-[#2f6b11]"}
                  >
                    {hasInvalidRows ? "Ada baris tidak valid" : "Semua baris valid"}
                  </strong>
                </div>
              </div>

              <div className="table-wrap overflow-x-auto rounded-2xl">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th className="text-center">Baris</th>
                      <th className="text-left">Tanggal</th>
                      <th className="text-right">Total PM</th>
                      <th className="text-right">Unit Terisi</th>
                      <th className="text-center">Validasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={`${row.row_number}-${row.report_date}`}>
                        <td className="text-center">{row.row_number}</td>
                        <td className="text-left">{formatDateLong(row.report_date)}</td>
                        <td className="text-right">{Number(row.total_pm || 0).toLocaleString("id-ID")}</td>
                        <td className="text-right">{Number(row.filled_units || 0).toLocaleString("id-ID")}</td>
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
          <button
            type="button"
            onClick={handleClose}
            disabled={loading || importing}
          >
            Batal
          </button>
          <button
            type="button"
            className="submit-btn"
            onClick={handleImport}
            disabled={!preview || hasInvalidRows || loading || importing}
          >
            {importing ? "Mengimpor..." : "Import laporan"}
          </button>
        </div>
      </div>
    </div>
  );
}
