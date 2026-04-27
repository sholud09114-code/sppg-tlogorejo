import pool from "../config/db.js";

let ensureItemMastersTablePromise;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ensureItemMastersTable() {
  if (!ensureItemMastersTablePromise) {
    ensureItemMastersTablePromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS item_masters (
          id INT AUTO_INCREMENT PRIMARY KEY,
          item_code VARCHAR(50) NOT NULL,
          item_name VARCHAR(200) NOT NULL,
          category VARCHAR(100) NOT NULL DEFAULT '',
          default_unit VARCHAR(50) NOT NULL DEFAULT '',
          default_price DECIMAL(12,2) NOT NULL DEFAULT 0,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_item_master_code (item_code),
          INDEX idx_item_master_name (item_name),
          INDEX idx_item_master_active (is_active)
        ) ENGINE=InnoDB`
      );
    })().catch((err) => {
      ensureItemMastersTablePromise = null;
      throw err;
    });
  }

  return ensureItemMastersTablePromise;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function normalizePayload(body) {
  const itemCode = String(body.item_code || body.kode_barang || "").trim();
  const itemName = String(body.item_name || body.nama_barang || "").trim();
  const category = String(body.category || body.kategori || "").trim();
  const defaultUnit = String(body.default_unit || body.satuan_default || "").trim();
  const defaultPriceRaw = body.default_price ?? body.harga_default;
  const defaultPrice = defaultPriceRaw === "" || defaultPriceRaw == null ? 0 : Number(defaultPriceRaw);
  const isActive = body.is_active === false || body.is_active === 0 || body.is_active === "0" ? 0 : 1;

  if (!itemCode) {
    return { error: "Field 'item_code' wajib diisi." };
  }
  if (!itemName) {
    return { error: "Field 'item_name' wajib diisi." };
  }
  if (!Number.isFinite(defaultPrice) || defaultPrice < 0) {
    return { error: "Field 'default_price' tidak boleh negatif." };
  }

  return {
    payload: {
      item_code: itemCode,
      item_name: itemName,
      category,
      default_unit: defaultUnit,
      default_price: defaultPrice,
      is_active: isActive,
    },
  };
}

async function findItemMasterById(id) {
  await ensureItemMastersTable();
  const [rows] = await pool.query(
    `SELECT id, item_code, item_name, category, default_unit, default_price, is_active, created_at, updated_at
       FROM item_masters
      WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function listItemMasters(req, res, next) {
  try {
    const activeOnly = String(req.query.active_only || "") === "1";
    const [rows] = await pool.query(
      `SELECT id, item_code, item_name, category, default_unit, default_price, is_active, created_at, updated_at
         FROM item_masters
        ${activeOnly ? "WHERE is_active = 1" : ""}
        ORDER BY is_active DESC, item_name ASC, id ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getItemMasterById(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid item master id." });
    }
    const row = await findItemMasterById(id);
    if (!row) {
      return res.status(404).json({ error: "Item master not found." });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
}

export async function getItemPriceMonitoring(req, res, next) {
  try {
    await ensureItemMastersTable();

    const itemId = parseId(req.query.item_id);
    const itemCode = String(req.query.item_code || "").trim();
    const itemName = String(req.query.item_name || "").trim();
    const startDate = String(req.query.start_date || "").trim();
    const endDate = String(req.query.end_date || "").trim();
    const normalizedItemName = normalizeLookupText(itemName);

    if (!itemId && !itemCode && !normalizedItemName) {
      return res
        .status(400)
        .json({ error: "Query 'item_id', 'item_code', atau 'item_name' wajib diisi." });
    }

    if (!startDate || !DATE_REGEX.test(startDate)) {
      return res.status(400).json({
        error: "Query 'start_date' wajib diisi dengan format YYYY-MM-DD.",
      });
    }

    if (!endDate || !DATE_REGEX.test(endDate)) {
      return res.status(400).json({
        error: "Query 'end_date' wajib diisi dengan format YYYY-MM-DD.",
      });
    }

    if (endDate < startDate) {
      return res.status(400).json({
        error: "Query 'end_date' tidak boleh lebih kecil dari 'start_date'.",
      });
    }

    let itemMeta = null;

    let rows = [];

    if (itemId) {
      itemMeta = await findItemMasterById(itemId);
    } else if (itemCode) {
      const [rows] = await pool.query(
        `SELECT id, item_code, item_name, category, default_unit, default_price, is_active, created_at, updated_at
           FROM item_masters
          WHERE item_code = ?
          LIMIT 1`,
        [itemCode]
      );
      itemMeta = rows[0] || null;
    }

    if (!itemMeta && !normalizedItemName) {
      return res.status(404).json({ error: "Item master tidak ditemukan." });
    }

    if (itemMeta) {
      const [masterRows] = await pool.query(
        `SELECT r.report_date,
                r.menu_name,
                i.report_id,
                i.master_item_id,
                i.description,
                i.qty,
                i.unit_name,
                i.price,
                i.amount,
                i.notes,
                i.display_order,
                m.item_code,
                m.item_name
           FROM shopping_report_items i
           JOIN shopping_reports r ON r.id = i.report_id
           JOIN item_masters m ON m.id = i.master_item_id
          WHERE i.master_item_id = ?
            AND r.report_date >= ?
            AND r.report_date <= ?
          ORDER BY r.report_date ASC, i.display_order ASC, i.id ASC`,
        [itemMeta.id, startDate, endDate]
      );
      rows = masterRows;
    } else {
      const [nameRows] = await pool.query(
        `SELECT r.report_date,
                r.menu_name,
                i.report_id,
                i.master_item_id,
                i.description,
                i.qty,
                i.unit_name,
                i.price,
                i.amount,
                i.notes,
                i.display_order,
                COALESCE(m.item_code, '-') AS item_code,
                COALESCE(m.item_name, i.description) AS item_name
           FROM shopping_report_items i
           JOIN shopping_reports r ON r.id = i.report_id
           LEFT JOIN item_masters m ON m.id = i.master_item_id
          WHERE r.report_date >= ?
            AND r.report_date <= ?
          ORDER BY r.report_date ASC, i.display_order ASC, i.id ASC`,
        [startDate, endDate]
      );
      rows = nameRows.filter(
        (row) => normalizeLookupText(row.description || row.item_name) === normalizedItemName
      );
      itemMeta = {
        id: null,
        item_code: "-",
        item_name: rows[0]?.item_name || itemName,
        category: "",
        default_unit: rows[0]?.unit_name || "",
      };
    }

    let totalPrice = 0;
    let maxPrice = null;
    let minPrice = null;
    let latestPrice = 0;
    let previousPrice = null;

    const history = rows.map((row, index) => {
      const price = Number(row.price || 0);
      totalPrice += price;
      maxPrice = maxPrice == null ? price : Math.max(maxPrice, price);
      minPrice = minPrice == null ? price : Math.min(minPrice, price);
      latestPrice = price;

      let priceChange = 0;
      let priceDirection = "same";
      if (index > 0) {
        priceChange = price - previousPrice;
        if (priceChange > 0) priceDirection = "up";
        else if (priceChange < 0) priceDirection = "down";
      }
      previousPrice = price;

      return {
        report_date: row.report_date,
        code_barang: row.item_code,
        nama_barang: row.item_name,
        harga: price,
        qty: Number(row.qty || 0),
        satuan: row.unit_name || itemMeta?.default_unit || "",
        jumlah: Number(row.amount || 0),
        laporan_menu: row.menu_name || "",
        report_id: row.report_id,
        price_change: priceChange,
        price_direction: priceDirection,
      };
    });

    const averagePrice = history.length > 0 ? totalPrice / history.length : 0;

    res.json({
      ok: true,
      item: {
        id: itemMeta.id,
        item_code: itemMeta.item_code,
        item_name: itemMeta.item_name,
        category: itemMeta.category,
        default_unit: itemMeta.default_unit,
      },
      range: {
        start_date: startDate,
        end_date: endDate,
      },
      summary: {
        latest_price: latestPrice,
        average_price: averagePrice,
        highest_price: maxPrice ?? 0,
        lowest_price: minPrice ?? 0,
        price_range: maxPrice != null && minPrice != null ? maxPrice - minPrice : 0,
        total_records: history.length,
      },
      history,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPriceIncreaseDetection(req, res, next) {
  try {
    await ensureItemMastersTable();

    const reportDate = String(req.query.report_date || "").trim();
    const onlyIncreased = ["1", "true"].includes(
      String(req.query.only_increased || "").trim().toLowerCase()
    );
    const minPercentIncreaseRaw = String(req.query.min_percent_increase || "").trim();
    const minPercentIncrease = minPercentIncreaseRaw ? Number(minPercentIncreaseRaw) : 0;

    if (!reportDate || !DATE_REGEX.test(reportDate)) {
      return res.status(400).json({
        error: "Query 'report_date' wajib diisi dengan format YYYY-MM-DD.",
      });
    }

    if (!Number.isFinite(minPercentIncrease) || minPercentIncrease < 0) {
      return res.status(400).json({
        error: "Query 'min_percent_increase' tidak boleh negatif.",
      });
    }

    const [currentRows] = await pool.query(
      `SELECT r.id AS report_id,
              r.report_date,
              r.menu_name,
              i.id AS report_item_id,
              i.master_item_id,
              i.description,
              i.qty,
              i.unit_name,
              i.price,
              i.amount,
              m.item_code,
              m.item_name
         FROM shopping_reports r
         JOIN shopping_report_items i ON i.report_id = r.id
         LEFT JOIN item_masters m ON m.id = i.master_item_id
        WHERE r.report_date = ?
        ORDER BY i.display_order ASC, i.id ASC`,
      [reportDate]
    );

    const summary = {
      total_checked: currentRows.length,
      increased_count: 0,
      decreased_count: 0,
      unchanged_count: 0,
      no_history_count: 0,
    };

    const analyzedRows = await Promise.all(
      currentRows.map(async (row) => {
        let previousRow = null;
        let previousHistoryRows = [];

        if (row.master_item_id) {
          const [previousRows] = await pool.query(
            `SELECT r.report_date,
                    i.price,
                    i.qty,
                    i.unit_name,
                    i.amount
               FROM shopping_report_items i
               JOIN shopping_reports r ON r.id = i.report_id
              WHERE i.master_item_id = ?
                AND r.report_date < ?
              ORDER BY r.report_date DESC, i.id DESC
              LIMIT 7`,
            [row.master_item_id, reportDate]
          );
          previousHistoryRows = previousRows;
          previousRow = previousRows[0] || null;
        } else {
          const normalizedDescription = normalizeLookupText(row.description);
          if (normalizedDescription) {
            const [previousRows] = await pool.query(
              `SELECT r.report_date,
                      i.price,
                      i.qty,
                      i.unit_name,
                      i.amount,
                      i.description
                 FROM shopping_report_items i
                 JOIN shopping_reports r ON r.id = i.report_id
                WHERE r.report_date < ?
                ORDER BY r.report_date DESC, i.id DESC`,
              [reportDate]
            );

            previousHistoryRows = previousRows.filter(
              (candidate) =>
                normalizeLookupText(candidate.description) === normalizedDescription
            );
            previousHistoryRows = previousHistoryRows.slice(0, 7);
            previousRow = previousHistoryRows[0] || null;
          }
        }

        const currentPrice = Number(row.price || 0);
        const previousPrice = previousRow ? Number(previousRow.price || 0) : null;
        const nominalChange =
          previousPrice == null ? null : currentPrice - previousPrice;
        const percentChange =
          previousPrice == null || previousPrice === 0
            ? null
            : (nominalChange / previousPrice) * 100;

        let status = "tanpa histori";
        if (previousPrice != null) {
          if (currentPrice > previousPrice) status = "naik";
          else if (currentPrice < previousPrice) status = "turun";
          else status = "tetap";
        }

        if (status === "naik") summary.increased_count += 1;
        else if (status === "turun") summary.decreased_count += 1;
        else if (status === "tetap") summary.unchanged_count += 1;
        else summary.no_history_count += 1;

        const monitoringStartDate =
          previousHistoryRows.length > 0
            ? previousHistoryRows[previousHistoryRows.length - 1].report_date
            : reportDate;

        return {
          master_item_id: row.master_item_id ?? null,
          kode_barang: row.item_code || "-",
          nama_barang: row.item_name || row.description || "-",
          nama_barang_query: row.description || row.item_name || "",
          tanggal_sebelumnya: previousRow?.report_date || null,
          harga_sebelumnya: previousPrice,
          harga_sekarang: currentPrice,
          selisih_nominal: nominalChange,
          selisih_persen: percentChange,
          status,
          qty: Number(row.qty || 0),
          satuan: row.unit_name || "-",
          jumlah: Number(row.amount || 0),
          laporan_menu: row.menu_name || "-",
          report_item_id: row.report_item_id,
          monitoring_range: {
            start_date: monitoringStartDate,
            end_date: reportDate,
          },
        };
      })
    );

    const rows = analyzedRows.filter((row) => {
      if (!onlyIncreased) return true;
      if (row.status !== "naik") return false;
      if ((row.selisih_persen ?? 0) < minPercentIncrease) return false;
      return true;
    });

    res.json({
      ok: true,
      report_date: reportDate,
      filters: {
        only_increased: onlyIncreased,
        min_percent_increase: minPercentIncrease,
      },
      summary,
      rows,
    });
  } catch (err) {
    next(err);
  }
}

export async function createItemMaster(req, res, next) {
  try {
    await ensureItemMastersTable();
    const { payload, error } = normalizePayload(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    const [result] = await pool.query(
      `INSERT INTO item_masters
        (item_code, item_name, category, default_unit, default_price, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.item_code,
        payload.item_name,
        payload.category,
        payload.default_unit,
        payload.default_price,
        payload.is_active,
      ]
    );

    const row = await findItemMasterById(result.insertId);
    res.status(201).json({ ok: true, message: "Item master created.", data: row });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Kode barang sudah digunakan." });
    }
    next(err);
  }
}

export async function updateItemMaster(req, res, next) {
  try {
    await ensureItemMastersTable();
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid item master id." });
    }
    const { payload, error } = normalizePayload(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    const [result] = await pool.query(
      `UPDATE item_masters
          SET item_code = ?,
              item_name = ?,
              category = ?,
              default_unit = ?,
              default_price = ?,
              is_active = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        payload.item_code,
        payload.item_name,
        payload.category,
        payload.default_unit,
        payload.default_price,
        payload.is_active,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Item master not found." });
    }

    const row = await findItemMasterById(id);
    res.json({ ok: true, message: "Item master updated.", data: row });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Kode barang sudah digunakan." });
    }
    next(err);
  }
}

export async function deleteItemMaster(req, res, next) {
  try {
    await ensureItemMastersTable();
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid item master id." });
    }

    const [result] = await pool.query(`DELETE FROM item_masters WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Item master not found." });
    }

    res.json({ ok: true, message: "Item master deleted." });
  } catch (err) {
    next(err);
  }
}
