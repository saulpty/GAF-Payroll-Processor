// Action Required: pure helpers (no React). Split out of ActionRequired.tsx, AR-1.
// Behaviour is byte-for-byte what the page did inline; tests/arLogic.test.ts pins it.

type Row = { id: number; employee_name: string; work_date: string; initial_status: string };

/** RED or YELLOW tab, then the name/date search, then the column sort. */
export function filterRows<T extends Row>(
  rows: T[], tab: 'RED' | 'YELLOW', search: string,
  sortKey: keyof T | null, sortDir: 'asc' | 'desc' | null,
): T[] {
  let out = rows.filter(r => r.initial_status === tab);
  const q = search.trim().toLowerCase();
  if (q) out = out.filter(r => r.employee_name.toLowerCase().includes(q) || r.work_date.toLowerCase().includes(q));
  if (sortKey && sortDir) {
    out = [...out].sort((a, b) => {
      const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }
  return out;
}

/** Header click cycles asc → desc → off. Returns the next [key, dir]. */
export function nextSort<K>(current: K | null, dir: 'asc' | 'desc' | null, clicked: K): [K | null, 'asc' | 'desc' | null] {
  if (current !== clicked) return [clicked, 'asc'];
  if (dir === 'asc') return [clicked, 'desc'];
  if (dir === 'desc') return [null, null];
  return [clicked, 'asc'];
}

/** The event box a row needs before it can commit: an impact was picked with no event. */
export function missingEvent(edit: { event_type_1: string; pay_impact_1: string; event_type_2: string; pay_impact_2: string }): 1 | 2 | null {
  if (edit.pay_impact_1 && !edit.event_type_1) return 1;
  if (edit.pay_impact_2 && !edit.event_type_2) return 2;
  return null;
}

/**
 * Why a row cannot be committed, or null when it can. isRealTime is
 * parseTimeInput's isValidTimeInput (passed in so this file stays import-free).
 */
export function refusalReason(
  edit: { entry_time: string; exit_time: string; event_type_1: string; pay_impact_1: string; event_type_2: string; pay_impact_2: string },
  isRealTime: (t: string) => boolean,
): string | null {
  if (!isRealTime(edit.entry_time) || !isRealTime(edit.exit_time)) return 'Entry or Exit is not a real time';
  if (missingEvent(edit)) return 'Pick an event first';
  return null;
}

/** The bulk bar is for bulk: two or more selected rows. One row commits from its own button. */
export function showBulkBar(selectedCount: number): boolean {
  return selectedCount >= 2;
}

/** Ids between two visible indexes, inclusive, in visible order (shift-click range). */
export function rangeIds(visible: { id: number }[], a: number, b: number): number[] {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return visible.slice(lo, hi + 1).map(r => r.id);
}
