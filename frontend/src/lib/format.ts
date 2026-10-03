const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatDateRange(startIso: string, endIso: string): string {
  return `${formatDate(startIso)} – ${formatDate(endIso)}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
