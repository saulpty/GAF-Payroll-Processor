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

/** Minutes for people: 45 → "45 min", 60 → "1h", 75 → "1h 15m". 0 or less → "". */
export function fmtMinutes(n: number | null | undefined): string {
  const m = Math.round(Number(n) || 0);
  if (m <= 0) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/**
 * The Discount column (AR-4): what a commit would deduct, from computeDiscount.
 * Nothing deducted with an event chosen → "Paid"; nothing and no event → blank.
 */
export function discountLabel(discount: number, hasEvent: boolean): { text: string; tone: 'deduct' | 'paid' | 'none' } {
  if (discount > 0) return { text: fmtMinutes(discount), tone: 'deduct' };
  return hasEvent ? { text: 'Paid', tone: 'paid' } : { text: '', tone: 'none' };
}

/** Event filter value meaning "rows with no Event 1 yet" (AR-5). */
export const NEEDS_EVENT = '__needs_event__';

/** AR-5 event filter: '' = all rows; NEEDS_EVENT = no Event 1; otherwise Event 1 or Event 2 equals it. */
export function filterByEvent<T>(rows: T[], filter: string, eventsOf: (r: T) => [string, string]): T[] {
  if (!filter) return rows;
  if (filter === NEEDS_EVENT) return rows.filter(r => !eventsOf(r)[0]);
  return rows.filter(r => eventsOf(r).includes(filter));
}

/**
 * Pay impact colour (AR-9), mirroring computeDiscount: only the Unpaid impacts deduct.
 * 'unpaid' = Unpaid / Unpaid (without Grace); 'partial' = Unpaid (with Grace), which
 * deducts only past the grace; 'paid' = every other impact; 'none' = blank.
 */
export function impactTone(impact: string | null | undefined): 'paid' | 'partial' | 'unpaid' | 'none' {
  const v = (impact ?? '').trim();
  if (!v) return 'none';
  if (v === 'Unpaid' || v === 'Unpaid (without Grace)') return 'unpaid';
  if (v === 'Unpaid (with Grace)') return 'partial';
  return 'paid';
}

/** Dot colour class per impact tone (Excel status inks). */
export const IMPACT_DOT: Record<string, string> = {
  paid: 'bg-status-green-ink', partial: 'bg-status-yellow-ink', unpaid: 'bg-status-red-ink', none: '',
};

/** Ids between two visible indexes, inclusive, in visible order (shift-click range). */
export function rangeIds(visible: { id: number }[], a: number, b: number): number[] {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return visible.slice(lo, hi + 1).map(r => r.id);
}
