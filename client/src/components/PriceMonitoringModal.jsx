import { useEffect, useMemo, useState } from "react";
import { fetchItemPriceMonitoring } from "../api/reportApi.js";

function formatDateLong(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatMoney(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function normalizeSuggestionText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesItem(masterItem, query) {
  const normalizedQuery = normalizeSuggestionText(query);
  if (!normalizedQuery) return true;

  return [masterItem?.item_code, masterItem?.item_name, masterItem?.category]
    .filter(Boolean)
    .some((value) => normalizeSuggestionText(value).includes(normalizedQuery));
}

function PriceLineChart({ points }) {
  if (!points.length) {
    return <div className="empty-state">Belum ada data harga pada rentang ini.</div>;
  }

  const width = 760;
  const height = 260;
  const padding = 28;
  const prices = points.map((point) => Number(point.harga || 0));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((Number(point.harga || 0) - minPrice) / range) * (height - padding * 2);
    return { x, y, point };
  });

  const path = coords.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`).join(" ");

  return (
    <div className="price-chart-card">
      <svg viewBox={`0 0 ${width} ${height}`} className="price-chart-svg" role="img" aria-label="Grafik perubahan harga barang">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="price-chart-axis" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="price-chart-axis" />
        <path d={path} className="price-chart-line" />
        {coords.map((coord) => (
          <g key={`${coord.point.report_date}-${coord.point.report_id}`}>
            <circle cx={coord.x} cy={coord.y} r="4" className="price-chart-point" />
            <text x={coord.x} y={height - 8} textAnchor="middle" className="price-chart-label">
              {new Date(`${coord.point.report_date}T00:00:00`).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </text>
          </g>
        ))}
        <text x={padding} y={padding - 8} className="price-chart-value">
          {formatMoney(maxPrice)}
        </text>
        <text x={padding} y={height - padding + 18} className="price-chart-value">
          {formatMoney(minPrice)}
        </text>
      </svg>
    </div>
  );
}

export default function PriceMonitoringModal({
  open = true,
  itemMasters = [],
  onClose,
  embedded = false,
  externalRequest = null,
}) {
  const [filters, setFilters] = useState({
    item_id: "",
    query: "",
    start_date: "",
    end_date: "",
  });
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (open) {
      setResults(null);
      setError(null);
      setLoading(false);
      setShowSuggestions(false);
    }
  }, [open]);

  const loadMonitoringData = async ({
    itemId,
    itemCode,
    itemName,
    startDate,
    endDate,
    queryLabel,
  }) => {
    setLoading(true);
    setError(null);

    setFilters((prev) => ({
      ...prev,
      item_id: itemId ? String(itemId) : "",
      query: queryLabel || prev.query,
      start_date: startDate || prev.start_date,
      end_date: endDate || prev.end_date,
    }));

    try {
      const data = await fetchItemPriceMonitoring({
        itemId,
        itemCode,
        itemName,
        startDate,
        endDate,
      });
      setResults(data);
    } catch (err) {
      setResults(null);
      setError("Gagal memuat monitoring harga: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      (!externalRequest?.itemId && !externalRequest?.itemName && !externalRequest?.itemCode) ||
      !externalRequest?.startDate ||
      !externalRequest?.endDate
    ) {
      return;
    }

    const queryLabel =
      externalRequest.queryLabel ||
      [externalRequest.itemCode, externalRequest.itemName].filter(Boolean).join(" - ");

    loadMonitoringData({
      itemId: externalRequest.itemId,
      itemCode: externalRequest.itemCode,
      itemName: externalRequest.itemName,
      startDate: externalRequest.startDate,
      endDate: externalRequest.endDate,
      queryLabel,
    });
  }, [externalRequest]);

  const filteredItems = useMemo(() => {
    return itemMasters.filter((item) => matchesItem(item, filters.query)).slice(0, 8);
  }, [filters.query, itemMasters]);

  if (!embedded && !open) return null;

  const handleSelectItem = (item) => {
    setFilters((prev) => ({
      ...prev,
      item_id: item.id,
      query: `${item.item_code} - ${item.item_name}`,
    }));
    setShowSuggestions(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const typedQuery = filters.query.trim();

    if (!filters.item_id && !typedQuery) {
      setError("Barang wajib diisi. Bisa pilih dari master atau ketik nama barang.");
      return;
    }
    if (!filters.start_date) {
      setError("Tanggal mulai wajib diisi.");
      return;
    }
    if (!filters.end_date) {
      setError("Tanggal selesai wajib diisi.");
      return;
    }
    if (filters.end_date < filters.start_date) {
      setError("Tanggal selesai tidak boleh lebih kecil dari tanggal mulai.");
      return;
    }

    try {
      await loadMonitoringData({
        itemId: filters.item_id,
        itemCode: "",
        itemName: filters.item_id ? "" : typedQuery,
        startDate: filters.start_date,
        endDate: filters.end_date,
        queryLabel: typedQuery,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const summary = results?.summary || {};
  const history = results?.history || [];

  const content = (
    <div
      className={
        embedded
          ? "price-monitoring-embedded"
          : "modal-card report-modal-card w-full max-w-6xl rounded-2xl p-4 sm:p-5"
      }
      role="dialog"
      aria-modal={embedded ? undefined : "true"}
    >
        <div className="modal-header">
          <div>
            <h3>Monitoring Harga</h3>
            <p>Pantau perubahan harga barang dari data laporan belanja yang sudah tersimpan.</p>
          </div>
          {!embedded && (
            <button type="button" onClick={onClose} disabled={loading}>
              Tutup
            </button>
          )}
        </div>

        <div className="price-monitoring-body">
          <form
            className={`weekly-filter-panel ${showSuggestions && filteredItems.length > 0 ? "has-open-suggestions" : ""}`}
            onSubmit={handleSubmit}
          >
            <div className="filter-field price-monitoring-search">
              <label htmlFor="price_monitoring_item">Barang</label>
              <div className="price-monitoring-search-wrap">
                <input
                  id="price_monitoring_item"
                  type="text"
                  className="w-full"
                  value={filters.query}
                  onChange={(event) => {
                    setFilters((prev) => ({
                      ...prev,
                      item_id: "",
                      query: event.target.value,
                    }));
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Cari kode / nama barang"
                  disabled={loading}
                />
                {showSuggestions && filteredItems.length > 0 && (
                  <div className="price-monitoring-suggestions">
                    {filteredItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="price-monitoring-suggestion"
                        onClick={() => handleSelectItem(item)}
                      >
                        <strong>{item.item_code}</strong>
                        <span>{item.item_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="filter-field">
              <label htmlFor="price_monitoring_start_date">Tanggal mulai</label>
              <input
                id="price_monitoring_start_date"
                type="date"
                value={filters.start_date}
                onChange={(event) => setFilters((prev) => ({ ...prev, start_date: event.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="price_monitoring_end_date">Tanggal selesai</label>
              <input
                id="price_monitoring_end_date"
                type="date"
                value={filters.end_date}
                onChange={(event) => setFilters((prev) => ({ ...prev, end_date: event.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="weekly-filter-action">
              <button type="submit" className="submit-btn w-full sm:w-auto" disabled={loading}>
                {loading ? "Memuat..." : "Tampilkan"}
              </button>
            </div>
          </form>

          {error && <div className="error-message mt-3">{error}</div>}

          {results && (
            <div className="price-monitoring-results">
              <div className="weekly-summary-grid">
                <div className="summary-card">
                  <span className="summary-card-label">Harga terakhir</span>
                  <strong>{formatMoney(summary.latest_price)}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card-label">Harga rata-rata</span>
                  <strong>{formatMoney(summary.average_price)}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card-label">Harga tertinggi</span>
                  <strong>{formatMoney(summary.highest_price)}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card-label">Harga terendah</span>
                  <strong>{formatMoney(summary.lowest_price)}</strong>
                </div>
                <div className="summary-card">
                  <span className="summary-card-label">Selisih tertinggi-terendah</span>
                  <strong>{formatMoney(summary.price_range)}</strong>
                </div>
              </div>

              <PriceLineChart points={history} />

              {history.length > 0 && (
                <div className="table-wrap price-monitoring-table-wrap">
                  <table className="data-table min-w-[1180px]">
                    <thead>
                      <tr>
                        <th className="text-left">Tanggal</th>
                        <th className="text-left">Kode Barang</th>
                        <th className="text-left">Nama Barang</th>
                        <th className="text-right">Harga</th>
                        <th className="text-center">Perubahan</th>
                        <th className="text-right">Qty</th>
                        <th className="text-center">Satuan</th>
                        <th className="text-right">Jumlah</th>
                        <th className="text-left">Laporan/Menu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={`${row.report_id}-${row.report_date}-${row.harga}`}>
                          <td className="text-left">{formatDateLong(row.report_date)}</td>
                          <td className="text-left">{row.code_barang}</td>
                          <td className="text-left">{row.nama_barang}</td>
                          <td className="text-right">{formatMoney(row.harga)}</td>
                          <td className="text-center">
                            <span className={`price-change-indicator ${row.price_direction}`}>
                              {row.price_direction === "up"
                                ? `Naik ${formatMoney(row.price_change)}`
                                : row.price_direction === "down"
                                  ? `Turun ${formatMoney(Math.abs(row.price_change))}`
                                  : "Tetap"}
                            </span>
                          </td>
                          <td className="text-right">{Number(row.qty || 0).toLocaleString("id-ID")}</td>
                          <td className="text-center">{row.satuan || "-"}</td>
                          <td className="text-right">{formatMoney(row.jumlah)}</td>
                          <td className="text-left">{row.laporan_menu || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      {content}
    </div>
  );
}
