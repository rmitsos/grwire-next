// Neon/Postgres may return a DATE column as either a Date object or an ISO
// date string. Do not append a time suffix to an already-materialised Date.
export function storyDateToIso(value) {
  if (!value) return null;
  const date = value instanceof Date
    ? value
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
