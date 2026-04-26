import ShoppingReportItemRow from "./ShoppingReportItemRow.jsx";

export default function ShoppingReportItemsSection({
  itemSuggestions,
  items,
  loading,
  onAddItem,
  onItemChange,
  onNumberChange,
  onRemoveItem,
  onSelectMasterItem,
}) {
  return (
    <section className="shopping-items-card data-form-section">
      <div className="shopping-items-head">
        <div>
          <div className="data-form-section-title">
            <span className="data-form-step">3.</span>
            <div>
              <h4>Item Belanja</h4>
              <p className="shopping-items-copy">
                Tambah atau hapus baris sesuai kebutuhan. Jumlah akan ikut dihitung dari qty x
                harga.
              </p>
            </div>
          </div>
        </div>
        <button type="button" onClick={onAddItem} disabled={loading}>
          + Tambah baris
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <ShoppingReportItemRow
            key={`shopping-item-${index}`}
            canRemove={items.length > 1}
            index={index}
            item={item}
            loading={loading}
            onItemChange={onItemChange}
            onNumberChange={onNumberChange}
            onRemove={onRemoveItem}
            onSelectMasterItem={onSelectMasterItem}
            suggestions={itemSuggestions[index] || []}
          />
        ))}
      </div>
    </section>
  );
}
