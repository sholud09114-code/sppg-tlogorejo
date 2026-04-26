export default function ShoppingReportImageImport({
  imageDraftStatus,
  imageProcessing,
  loading,
  onFileChange,
  onProcessImage,
  selectedImageFile,
}) {
  return (
    <section className="shopping-import-card data-form-section">
      <div className="data-form-section-head">
        <span className="data-form-step">1.</span>
        <div>
          <h4>
            Import Gambar <span>(Opsional)</span>
          </h4>
          <p className="shopping-items-copy">
            Upload foto nota atau gambar draft belanja. Hasil proses hanya mengisi draft form dan
            tetap perlu dicek sebelum disimpan.
          </p>
        </div>
      </div>

      <div className="menu-import-layout">
        <div>
          <label className="menu-upload-dropzone" htmlFor="shopping_import_image">
            <span className="menu-upload-icon">↥</span>
            <strong>Drag & drop gambar di sini</strong>
            <span>atau klik untuk memilih file</span>
            <small>PNG, JPG, JPEG (maks. 5MB)</small>
          </label>
          <input
            id="shopping_import_image"
            className="menu-upload-input"
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            onChange={onFileChange}
            disabled={loading || imageProcessing}
          />
        </div>

        <div className="menu-import-side">
          <div className="form-field">
            <label>File terpilih</label>
            <div className="shopping-import-file">
              {selectedImageFile?.name || "Belum ada file dipilih"}
            </div>
          </div>

          <div className="shopping-import-actions">
            <button
              type="button"
              className="menu-process-btn"
              onClick={onProcessImage}
              disabled={loading || imageProcessing}
            >
              {imageProcessing ? "Memproses..." : "Proses gambar"}
            </button>
          </div>

          <p className="menu-import-note">
            Hasil import hanya berupa draft dan tetap perlu dicek sebelum disimpan.
          </p>
        </div>
      </div>

      {imageDraftStatus && (
        <div className={`shopping-import-status ${imageDraftStatus.kind || "info"}`}>
          {imageDraftStatus.message}
        </div>
      )}
    </section>
  );
}
