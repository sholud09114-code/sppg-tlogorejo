import { useEffect, useMemo, useState } from "react";

function getInitialForm(initialData) {
  return {
    item_code: initialData?.item_code || "",
    item_name: initialData?.item_name || "",
    category: initialData?.category || "",
    default_unit: initialData?.default_unit || "",
    default_price: initialData?.default_price ?? 0,
    is_active: initialData?.is_active ?? 1,
  };
}

import ActionIconButton from "./ActionIconButton.jsx";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

export default function ItemMasterModal({
  open,
  items,
  loading,
  saving,
  selectedItem,
  onClose,
  onCreate,
  onUpdate,
  onEdit,
  onDelete,
}) {
  const [form, setForm] = useState(getInitialForm(selectedItem));
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setForm(getInitialForm(selectedItem));
      setError(null);
    }
  }, [open, selectedItem]);

  const filteredItems = useMemo(() => {
    const keyword = String(query || "")
      .trim()
      .toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [item.item_code, item.item_name, item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [items, query]);

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!String(form.item_code || "").trim()) {
      setError("Kode barang wajib diisi.");
      return;
    }
    if (!String(form.item_name || "").trim()) {
      setError("Nama barang wajib diisi.");
      return;
    }
    const price = Number(form.default_price === "" ? 0 : form.default_price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Harga default tidak boleh negatif.");
      return;
    }

    setError(null);
    const payload = {
      item_code: String(form.item_code || "").trim(),
      item_name: String(form.item_name || "").trim(),
      category: String(form.category || "").trim(),
      default_unit: String(form.default_unit || "").trim(),
      default_price: price,
      is_active: form.is_active ? 1 : 0,
    };

    if (selectedItem?.id) {
      onUpdate(selectedItem.id, payload);
      return;
    }

    onCreate(payload);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card data-form-card data-form-card-xl" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h3>Master Barang</h3>
            <p>Kelola daftar barang untuk autofill item di laporan belanja.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving}>
            Tutup
          </button>
        </div>

        <div className="report-modal-grid data-form-body grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <section className="data-form-section">
              <div className="data-form-section-head">
                <span className="data-form-step">1.</span>
                <div>
                  <h4>Daftar Barang</h4>
                  <p>Cari dan kelola master barang yang dipakai di laporan belanja.</p>
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="item_master_search">Cari barang</label>
                <input
                  id="item_master_search"
                  type="text"
                  className="w-full"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari kode / nama / kategori"
                  disabled={saving}
                />
              </div>
            </section>

            <div className="table-wrap overflow-x-auto rounded-2xl">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Barang</th>
                    <th>Kategori</th>
                    <th>Satuan</th>
                    <th>Harga Default</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center">
                        Memuat master barang...
                      </td>
                    </tr>
                  ) : filteredItems.length ? (
                    filteredItems.map((item) => (
                      <tr key={item.id}>
                        <td className="text-left">{item.item_code}</td>
                        <td className="text-left">{item.item_name}</td>
                        <td className="text-left">{item.category || "-"}</td>
                        <td className="text-center">{item.default_unit || "-"}</td>
                        <td className="text-right">{formatMoney(item.default_price)}</td>
                        <td className="text-center">{item.is_active ? "Aktif" : "Nonaktif"}</td>
                        <td className="text-center">
                          <div className="table-actions">
                            <ActionIconButton
                              action="edit"
                              label="Edit"
                              onClick={() => onEdit(item)}
                            />
                            <ActionIconButton
                              action="delete"
                              label="Hapus"
                              onClick={() => onDelete(item)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center">
                        Belum ada data master barang.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <form className="data-form-section" onSubmit={handleSubmit}>
            <div className="data-form-section-head">
              <span className="data-form-step">2.</span>
              <div>
                <h4>{selectedItem?.id ? "Edit Barang" : "Tambah Barang"}</h4>
                <p>Isi detail barang untuk autofill item belanja.</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="form-field">
                <label htmlFor="item_code">Kode barang</label>
                <input
                  id="item_code"
                  type="text"
                  className="w-full"
                  value={form.item_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, item_code: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div className="form-field">
                <label htmlFor="item_name">Nama barang</label>
                <input
                  id="item_name"
                  type="text"
                  className="w-full"
                  value={form.item_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, item_name: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div className="form-field">
                <label htmlFor="item_category">Kategori</label>
                <input
                  id="item_category"
                  type="text"
                  className="w-full"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div className="form-field">
                <label htmlFor="item_default_unit">Satuan default</label>
                <input
                  id="item_default_unit"
                  type="text"
                  className="w-full"
                  value={form.default_unit}
                  onChange={(e) => setForm((prev) => ({ ...prev, default_unit: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div className="form-field">
                <label htmlFor="item_default_price">Harga default</label>
                <input
                  id="item_default_price"
                  type="number"
                  className="w-full"
                  min="0"
                  step="0.01"
                  value={form.default_price}
                  onChange={(e) => setForm((prev) => ({ ...prev, default_price: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-[#5f5e5a]">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_active)}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, is_active: e.target.checked ? 1 : 0 }))
                  }
                  disabled={saving}
                />
                Aktif
              </label>
            </div>

            {error && <div className="error-message mt-3">{error}</div>}

            <div className="modal-actions data-form-actions">
              <button
                type="button"
                onClick={() => {
                  if (saving) return;
                  onEdit(null);
                }}
                disabled={saving}
              >
                Reset
              </button>
              <button type="submit" className="submit-btn" disabled={saving}>
                {saving ? "Menyimpan..." : selectedItem?.id ? "Simpan perubahan" : "Tambah barang"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
