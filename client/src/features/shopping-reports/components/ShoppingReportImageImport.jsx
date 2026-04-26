export default function ShoppingReportImageImport({
  imageDraftStatus,
  imageProcessing,
  loading,
  onFileChange,
  onProcessImage,
  selectedImageFile,
}) {
  return (
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
            onChange={onFileChange}
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
          onClick={onProcessImage}
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
  );
}
