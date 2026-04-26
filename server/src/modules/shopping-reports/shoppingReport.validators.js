import { z } from "zod";

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

const shoppingReportBodySchema = z
  .object({
    report_date: z.unknown().optional(),
    tanggal_laporan: z.unknown().optional(),
    menu_name: z.unknown().optional(),
    nama_menu: z.unknown().optional(),
    notes: z.unknown().optional(),
    catatan: z.unknown().optional(),
    small_portion_count: z.unknown().optional(),
    jumlah_porsi_kecil: z.unknown().optional(),
    large_portion_count: z.unknown().optional(),
    jumlah_porsi_besar: z.unknown().optional(),
    items: z.unknown().optional(),
  })
  .passthrough();

const normalizedShoppingReportPayloadSchema = z.object({
  report_date: z.string().regex(DATE_REGEX),
  menu_name: z.string().min(1),
  small_portion_count: z.number().min(0),
  large_portion_count: z.number().min(0),
  daily_budget: z.number(),
  total_spending: z.number().min(0),
  difference_amount: z.number(),
  item_count: z.number().int().min(1),
  notes: z.string(),
  items: z
    .array(
      z.object({
        master_item_id: z.number().int().positive().nullable(),
        description: z.string().min(1),
        qty: z.number().min(0),
        unit_name: z.string(),
        price: z.number().min(0),
        amount: z.number().min(0),
        notes: z.string(),
        display_order: z.number().int().positive(),
      })
    )
    .min(1),
});

export function parseShoppingReportId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function normalizeNumber(value, fieldLabel, { allowNegative = false } = {}) {
  const number = value === "" || value == null ? 0 : Number(value);
  if (!Number.isFinite(number)) {
    return { error: `${fieldLabel} harus berupa angka.` };
  }
  if (!allowNegative && number < 0) {
    return { error: `${fieldLabel} tidak boleh negatif.` };
  }
  return { value: number };
}

export function normalizeShoppingReportPayload(body) {
  const bodyResult = shoppingReportBodySchema.safeParse(
    body && typeof body === "object" ? body : {}
  );
  if (!bodyResult.success) {
    return { error: "Payload laporan belanja tidak valid." };
  }

  const input = bodyResult.data;
  const reportDate = String(input.report_date || input.tanggal_laporan || "").trim();
  const menuName = String(input.menu_name || input.nama_menu || "").trim();
  const notes = String(input.notes || input.catatan || "").trim();
  const smallPortionResult = normalizeNumber(
    input.small_portion_count ?? input.jumlah_porsi_kecil,
    "Jumlah porsi kecil"
  );
  const largePortionResult = normalizeNumber(
    input.large_portion_count ?? input.jumlah_porsi_besar,
    "Jumlah porsi besar"
  );

  if (!reportDate || !DATE_REGEX.test(reportDate)) {
    return { error: "Field 'report_date' wajib diisi dengan format YYYY-MM-DD." };
  }

  if (!menuName) {
    return { error: "Field 'menu_name' wajib diisi." };
  }

  if (smallPortionResult.error || largePortionResult.error) {
    return { error: smallPortionResult.error || largePortionResult.error };
  }

  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (!rawItems.length) {
    return { error: "Minimal ada 1 item belanja." };
  }

  const items = [];
  for (let index = 0; index < rawItems.length; index += 1) {
    const row = rawItems[index] || {};
    const masterItemId =
      row.master_item_id == null || row.master_item_id === ""
        ? null
        : Number(row.master_item_id);
    const description = String(row.description || row.uraian || "").trim();
    const unitName = String(row.unit_name || row.satuan || "").trim();
    const itemNotes = String(row.notes || row.keterangan || "").trim();

    if (!description) {
      return { error: `Uraian item pada baris ${index + 1} wajib diisi.` };
    }

    const qtyResult = normalizeNumber(row.qty, `Qty item baris ${index + 1}`);
    const priceResult = normalizeNumber(row.price, `Harga item baris ${index + 1}`);
    const amountSource =
      row.amount === "" || row.amount == null
        ? (Number(row.qty || 0) || 0) * (Number(row.price || 0) || 0)
        : row.amount;
    const amountResult = normalizeNumber(amountSource, `Jumlah item baris ${index + 1}`);

    if (qtyResult.error || priceResult.error || amountResult.error) {
      return {
        error: qtyResult.error || priceResult.error || amountResult.error,
      };
    }

    items.push({
      master_item_id:
        Number.isInteger(masterItemId) && masterItemId > 0 ? masterItemId : null,
      description,
      qty: qtyResult.value,
      unit_name: unitName,
      price: priceResult.value,
      amount: amountResult.value,
      notes: itemNotes,
      display_order: index + 1,
    });
  }

  const totalSpending = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const dailyBudget =
    Number(smallPortionResult.value) * 8000 + Number(largePortionResult.value) * 10000;
  const differenceAmount = Number(dailyBudget) - Number(totalSpending);

  const payload = {
    report_date: reportDate,
    menu_name: menuName,
    small_portion_count: smallPortionResult.value,
    large_portion_count: largePortionResult.value,
    daily_budget: dailyBudget,
    total_spending: totalSpending,
    difference_amount: differenceAmount,
    item_count: items.length,
    notes,
    items,
  };

  const payloadResult = normalizedShoppingReportPayloadSchema.safeParse(payload);
  if (!payloadResult.success) {
    return { error: "Payload laporan belanja tidak valid." };
  }

  return { payload: payloadResult.data };
}
