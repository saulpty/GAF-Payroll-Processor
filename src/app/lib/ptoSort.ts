// Pure sort/filter helpers for the PTO table. No imports: node tests load this directly.
export type SortDir = 'asc' | 'desc' | null;

export function nextSortDir(current: SortDir): SortDir {
  if (current === null) return 'asc';
  if (current === 'asc') return 'desc';
  return null;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

/** Numbers numerically, strings case-insensitively; empties always last. */
export function compareValues(a: unknown, b: unknown): number {
  const ea = isEmpty(a), eb = isEmpty(b);
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na - nb;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

/** Stable sort. key/dir null -> fallbackKey ascending. Empties last in both directions. Never mutates. */
export function sortRows<T>(rows: T[], key: keyof T | null, dir: SortDir, fallbackKey: keyof T): T[] {
  const k: keyof T = key !== null && dir !== null ? key : fallbackKey;
  const d: 'asc' | 'desc' = key !== null && dir !== null ? dir : 'asc';
  const sign = d === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const a = x.r[k] as unknown, b = y.r[k] as unknown;
      const ea = isEmpty(a), eb = isEmpty(b);
      if (ea !== eb) return ea ? 1 : -1;           // empties last regardless of direction
      const c = compareValues(a, b) * sign;
      return c !== 0 ? c : x.i - y.i;
    })
    .map(x => x.r);
}

export function matchesSearch(row: { display_name: string; role: string | null }, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return row.display_name.toLowerCase().includes(s) || (row.role ?? '').toLowerCase().includes(s);
}
