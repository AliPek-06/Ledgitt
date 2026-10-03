const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatDateRange(startIso: string, endIso: string): string {
  return `${formatDate(startIso)} – ${formatDate(endIso)}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

// The calendar date at a fraction (0..1) of the project timeline, e.g. "21 Sep".
export function dateAtPct(startIso: string, dueIso: string, fraction: number): string {
  const start = Date.parse(startIso);
  const due = Date.parse(dueIso);
  return shortDateFormat.format(new Date(start + fraction * (due - start)));
}
