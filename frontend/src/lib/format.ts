const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

// e.g. "Thu 24 Sep, 10:00"
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatDateRange(startIso: string, endIso: string): string {
  return `${formatDate(startIso)} – ${formatDate(endIso)}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Rounds down, so "33%" only shows once t has really reached the 0.33 checkpoint
// (rounding to nearest showed "33%" from 32.5% on, before any alert could fire).
// The epsilon absorbs float error, e.g. 0.57 * 100 = 56.99999999999999.
export function formatPct(fraction: number): string {
  return `${Math.floor(fraction * 100 + 1e-9)}%`;
}

// The calendar date at a fraction (0..1) of the project timeline, e.g. "21 Sep".
export function dateAtPct(startIso: string, dueIso: string, fraction: number): string {
  const start = Date.parse(startIso);
  const due = Date.parse(dueIso);
  return shortDateFormat.format(new Date(start + fraction * (due - start)));
}
