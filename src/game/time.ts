/** Local-date helpers (daily boxes reset at local midnight). */

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days between two local day keys (b − a). */
export function daysBetween(a: string, b: string): number {
  const pa = a.split('-').map(Number) as [number, number, number];
  const pb = b.split('-').map(Number) as [number, number, number];
  const ua = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const ub = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((ub - ua) / 86400000);
}

/** ISO week id like 2026-W45 (Monday-based), from a local day key. */
export function isoWeek(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function weekNumber(day: string): number {
  return Number(isoWeek(day).split('-W')[1]);
}
