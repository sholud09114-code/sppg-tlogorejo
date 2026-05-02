export function formatDateLong(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatDateShort(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatDate(value) {
  return formatDateLong(value);
}

export function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

export function formatNumberId(value, options = {}) {
  return Number(value || 0).toLocaleString("id-ID", options);
}

export function formatMoney(value) {
  return `Rp ${formatNumber(value)}`;
}

export function formatRupiah(value) {
  return formatMoney(value);
}

export function formatWeight(value) {
  return `${formatNumber(value)} kg`;
}

export function formatKg(value, options = {}) {
  return `${formatNumberId(value, options)} kg`;
}

export function formatKgPerPortion(value, options = {}) {
  return `${formatNumberId(value, options)} kg/porsi`;
}

export function formatPortions(value) {
  return formatNumber(value);
}

export function formatPercent(value, options = {}) {
  if (value == null || value === "") return "-";
  return `${formatNumberId(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  })}%`;
}
