import { getUnitOptions } from "../utils/shoppingReportFormUtils.js";

export default function ShoppingReportItemRow({
  canRemove,
  index,
  item,
  loading,
  onItemChange,
  onNumberChange,
  onRemove,
  onSelectMasterItem,
  suggestions,
}) {
  return (
    <div className="shopping-item-row rounded-2xl p-3">
      <div className="shopping-item-grid">
        <div className="form-field shopping-item-wide">
          <label>Cari barang</label>
          <input
            type="text"
            className="w-full"
            value={item.item_lookup || ""}
            onChange={(e) => {
              onItemChange(index, "item_lookup", e.target.value);
              onItemChange(index, "master_item_id", null);
            }}
            placeholder="Cari kode / nama barang"
            disabled={loading}
          />
          {String(item.item_lookup || "").trim() && (
            <div className="shopping-item-suggestions">
              {suggestions.map((masterItem) => (
                <button
                  key={masterItem.id}
                  type="button"
                  className="shopping-item-suggestion"
                  onClick={() => onSelectMasterItem(index, masterItem)}
                >
                  <span>{masterItem.item_code}</span>
                  <strong>{masterItem.item_name}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="form-field shopping-item-wide">
          <label>Uraian</label>
          <input
            type="text"
            className="w-full"
            value={item.description}
            onChange={(e) => onItemChange(index, "description", e.target.value)}
            placeholder="Contoh: Beras"
            disabled={loading}
          />
        </div>
        <div className="form-field">
          <label>Qty</label>
          <input
            type="number"
            className="w-full"
            min="0"
            step="0.01"
            value={item.qty}
            onChange={(e) => onNumberChange("item", index, "qty", e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-field">
          <label>Satuan</label>
          <select
            className="w-full"
            value={item.unit_name}
            onChange={(e) => onItemChange(index, "unit_name", e.target.value)}
            disabled={loading}
          >
            <option value="">Pilih satuan</option>
            {getUnitOptions(item.unit_name).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Harga</label>
          <input
            type="number"
            className="w-full"
            min="0"
            step="0.01"
            value={item.price}
            onChange={(e) => onNumberChange("item", index, "price", e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-field">
          <label>Jumlah</label>
          <input
            type="number"
            className="w-full"
            min="0"
            step="0.01"
            value={item.amount}
            onChange={(e) => onNumberChange("item", index, "amount", e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-field shopping-item-wide">
          <label>Keterangan</label>
          <input
            type="text"
            className="w-full"
            value={item.notes}
            onChange={(e) => onItemChange(index, "notes", e.target.value)}
            placeholder="Opsional"
            disabled={loading}
          />
        </div>
      </div>

      <div className="shopping-item-actions">
        <button
          type="button"
          className="danger-btn"
          onClick={() => onRemove(index)}
          disabled={loading || !canRemove}
        >
          Hapus baris
        </button>
      </div>
    </div>
  );
}
