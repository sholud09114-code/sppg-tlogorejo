export function formatDateLong(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
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

export function formatMoney(value) {
  return `Rp ${formatNumber(value)}`;
}

export function formatWeight(value) {
  return `${formatNumber(value)} kg`;
}

export function formatPortions(value) {
  return formatNumber(value);
}
