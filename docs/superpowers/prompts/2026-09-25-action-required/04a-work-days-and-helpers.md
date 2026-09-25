# Action Required AR-4a: load work days; minutes and discount helpers (no visible change)

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only these three files may change:**
1. `src/actions/loadActionRequired.ts` (whole file below): also returns the employee's schedule
   `work_days` (a `LEFT JOIN schedules`). Filters, order and every other column are unchanged.
2. `src/app/pages/action-required/arTypes.ts` (whole file below): `EntryRow.work_days`.
3. `src/app/pages/action-required/arLogic.ts` (whole file below): adds `fmtMinutes` and
   `discountLabel`; everything already there is unchanged.

No other file may be touched. Nothing uses the new pieces until AR-4b.

## `src/actions/loadActionRequired.ts` (whole file)

```ts
import { action } from '@uibakery/data';

function loadActionRequired() {
  return action('loadActionRequired', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT pe.id, pe.period_name, e.display_name AS employee_name, pe.work_date,
             pe.entry_time, pe.exit_time, pe.scheduled_start, pe.grace_until, pe.scheduled_end,
             pe.late_minutes, pe.late_after_grace, pe.early_leave_minutes, pe.discount_total_minutes,
             pe.payroll_ready, pe.event_type_1, pe.pay_impact_1, pe.event_type_2, pe.pay_impact_2,
             pe.documentation, pe.notes, pe.auto_notes, pe.initial_status, pe.status_current,
             s.work_days
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      LEFT JOIN schedules s ON s.id = e.schedule_id
      WHERE (COALESCE({{params.periodName}}, '') = '' OR pe.period_name = {{params.periodName}})
        AND pe.initial_status IN ('RED','YELLOW')
        AND pe.payroll_ready = 'NO'
        AND pe.deleted_at IS NULL
      ORDER BY
        pe.period_name DESC,
        CASE pe.initial_status WHEN 'RED' THEN 1 WHEN 'YELLOW' THEN 2 ELSE 3 END,
        e.display_name, pe.work_date;
    `,
  });
}

export default loadActionRequired;
```

## `src/app/pages/action-required/arTypes.ts` (whole file)

```ts
// Action Required: shared types and constants (split out of ActionRequired.tsx, AR-1).

export type EntryRow = {
  id: number; period_name: string; employee_name: string; work_date: string;
  entry_time: string | null; exit_time: string | null;
  scheduled_start: string; grace_until: string; scheduled_end: string;
  late_minutes: number; late_after_grace: number; early_leave_minutes: number;
  discount_total_minutes: number; payroll_ready: string;
  event_type_1: string; pay_impact_1: string;
  event_type_2: string; pay_impact_2: string;
  documentation: string; notes: string; auto_notes: string;
  initial_status: string; status_current: string;
  /** The employee's schedule work days, e.g. "Mon,Tue,Wed,Thu,Fri" (AR-4, for the Shift column). */
  work_days?: string | null;
};

export type CommittedRow = {
  id: number; period_name: string; employee_name: string; work_date: string;
  event_type_1: string; pay_impact_1: string;
  event_type_2: string; pay_impact_2: string;
  documentation: string; notes: string; auto_notes: string;
  initial_status: string; status_current: string;
  discount_total_minutes: number; updated_at: string;
};

export type EditState = {
  entry_time: string; exit_time: string;
  event_type_1: string; pay_impact_1: string;
  event_type_2: string; pay_impact_2: string;
  documentation: string; notes: string;
};

export type SortDir = 'asc' | 'desc' | null;
export type SortKey = keyof EntryRow | null;

// Fields that broadcast to all selected rows when changed
export const BROADCAST_FIELDS: (keyof EditState)[] = [
  'event_type_1', 'pay_impact_1', 'event_type_2', 'pay_impact_2', 'documentation',
];

export const STATUS_CHIP: Record<string, string> = {
  RED:    'bg-[#FFC7CE] text-red-800 border-red-300',
  YELLOW: 'bg-[#FFEB9C] text-yellow-800 border-yellow-300',
  GREEN:  'bg-[#C6EFCE] text-green-800 border-green-300',
};

/** A row's loaded values in edit shape. Module level so useRowEdits sees a stable function. */
export function toEditState(row: EntryRow): EditState {
  return {
    entry_time: row.entry_time || '',
    exit_time: row.exit_time || '',
    event_type_1: row.event_type_1 || '',
    pay_impact_1: row.pay_impact_1 || '',
    event_type_2: row.event_type_2 || '',
    pay_impact_2: row.pay_impact_2 || '',
    documentation: row.documentation || '',
    notes: row.notes || '',
  };
}
```

## `src/app/pages/action-required/arLogic.ts` (whole file)

```ts
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

/** Ids between two visible indexes, inclusive, in visible order (shift-click range). */
export function rangeIds(visible: { id: number }[], a: number, b: number): number[] {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return visible.slice(lo, hi + 1).map(r => r.id);
}
```

## Report
- Byte size of the three files; confirm no other file changed.
