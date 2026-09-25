# Action Required AR-1a: add the split-out helper files (nothing uses them yet)

Part 1 of 2 of splitting the 39 KB `ActionRequired.tsx` (limit 15 KB) with **no visible
change**. This part only **creates seven new files** in `src/app/pages/action-required/`:
`arTypes.ts`, `arLogic.ts`, `ArBits.tsx`, `ArHead.tsx`, `ArCommitBar.tsx`, `ArConfirm.tsx`,
`useArSave.ts`. Nothing imports them yet, so the app does not change.

**No existing file may be touched**, `ActionRequired.tsx` included (AR-1b swaps it). Copy every
file **exactly**; they were written by moving the page's existing code, and
`tests/arLogic.test.ts` pins `arLogic.ts`. Do not tidy, rename or reformat anything.

## `src/app/pages/action-required/arTypes.ts`

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

## `src/app/pages/action-required/arLogic.ts`

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

/** Ids between two visible indexes, inclusive, in visible order (shift-click range). */
export function rangeIds(visible: { id: number }[], a: number, b: number): number[] {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return visible.slice(lo, hi + 1).map(r => r.id);
}
```

## `src/app/pages/action-required/ArBits.tsx`

```tsx
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { SortDir, SortKey } from './arTypes';

export function SortIcon({ col, sortKey, sortDir }: { col: string; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-blue-600" />
    : <ChevronDown className="w-3 h-3 inline ml-0.5 text-blue-600" />;
}

export function Th({ col, label, className = '', sortKey, sortDir, onSort }: {
  col: SortKey; label: string; className?: string;
  sortKey: SortKey; sortDir: SortDir; onSort: (col: SortKey) => void;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r last:border-r-0 cursor-pointer select-none hover:bg-slate-200 transition-colors ${className}`}
      onClick={() => col && onSort(col)}
    >
      {label}{col && <SortIcon col={col as string} sortKey={sortKey} sortDir={sortDir} />}
    </th>
  );
}

// Visual select that glows when it will broadcast to multiple rows
export function BroadcastSelect({ value, options, placeholder, broadcasting, onChange }: {
  value: string;
  options: string[];
  placeholder: string;
  broadcasting: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        className={`w-full border rounded px-1.5 py-1 text-xs bg-white transition-colors ${
          broadcasting
            ? 'border-blue-400 ring-1 ring-blue-300 bg-blue-50'
            : ''
        }`}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {broadcasting && (
        <span
          title={`Will apply to all selected rows`}
          className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full border border-white text-white flex items-center justify-center text-[8px] font-bold leading-none"
        >
          ↗
        </span>
      )}
    </div>
  );
}
```

## `src/app/pages/action-required/ArHead.tsx`

```tsx
import { CheckSquare, Edit2, Square } from 'lucide-react';
import { Th } from './ArBits';
import type { SortDir, SortKey } from './arTypes';

const editTh = 'px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r bg-blue-50 text-blue-700 w-24';
const plainTh = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r';

/** The work table's header row. Split out of ActionRequired.tsx, AR-1. */
export function ArHead({ allFilteredSelected, someSelected, showPeriod, sortKey, sortDir, onSort, onToggleAll }: {
  allFilteredSelected: boolean;
  someSelected: boolean;
  showPeriod: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
  onToggleAll: () => void;
}) {
  const sortProps = { sortKey, sortDir, onSort };
  return (
    <thead className="sticky top-0 z-20">
      <tr className="bg-slate-100 border-b-2 border-slate-300">
        {/* Checkbox select-all */}
        <th className="px-2 py-2.5 w-8 border-r sticky left-0 bg-slate-100 z-30">
          <button onClick={onToggleAll} className="flex items-center justify-center w-full">
            {allFilteredSelected
              ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              : someSelected
                ? <span className="w-3.5 h-3.5 rounded-sm border-2 border-blue-400 bg-blue-100 block" />
                : <Square className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </th>
        <Th col="employee_name" label="Employee" className="sticky left-8 bg-slate-100 z-30 min-w-36" {...sortProps} />
        {showPeriod && <Th col="period_name" label="Period" {...sortProps} />}
        <Th col="work_date" label="Date" {...sortProps} />
        <th className={editTh} style={{ width: 112, minWidth: 112 }}><Edit2 className="w-3 h-3 inline mr-1" />Entry</th>
        <th className={editTh} style={{ width: 112, minWidth: 112 }}><Edit2 className="w-3 h-3 inline mr-1" />Exit</th>
        <th className={`${plainTh} text-slate-500`}>Sched</th>
        <Th col="late_minutes" label="Late min" {...sortProps} />
        <Th col="early_leave_minutes" label="Early min" {...sortProps} />
        <th className={plainTh}>Event 1</th>
        <th className={plainTh}>Impact 1</th>
        <th className={plainTh}>Event 2</th>
        <th className={plainTh}>Impact 2</th>
        <th className={plainTh}>Doc</th>
        <th className={plainTh}>Auto-Notes</th>
        <th className={plainTh}>Notes</th>
      </tr>
    </thead>
  );
}
```

## `src/app/pages/action-required/ArCommitBar.tsx`

```tsx
import { GitCommit, Loader2, RotateCcw, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The blue selection/commit bar and the "N unsaved · Discard all" button. Split out of ActionRequired.tsx, AR-1. */
export function ArCommitBar({ someSelected, selectedCount, selectedSize, bulkSaving, dirtyCount, onDeselectAll, onCommit, onDiscardAll }: {
  someSelected: boolean;
  selectedCount: number;
  selectedSize: number;
  bulkSaving: boolean;
  dirtyCount: number;
  onDeselectAll: () => void;
  onCommit: () => void;
  onDiscardAll: () => void;
}) {
  return (
    <>
      {/* ── Sticky commit bar ──────────────────────────────── */}
      <div className={`shrink-0 transition-all duration-200 ${someSelected ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'}`}>
        <div className="flex items-center gap-3 bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow-md">
          <GitCommit className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold">{selectedCount} row{selectedCount !== 1 ? 's' : ''} selected</span>
          <span className="text-blue-300 text-xs">— shift-click to range-select</span>
          {selectedSize > 1 && (
            <span className="text-blue-200 text-xs font-medium">
              Editing any Event, Impact or Doc field will apply to all {selectedSize} selected rows.
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onDeselectAll}
              className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white transition-colors px-2 py-1 rounded hover:bg-blue-600">
              <X className="w-3.5 h-3.5" />Deselect all
            </button>
            <Button size="sm"
              className="bg-white text-blue-700 hover:bg-blue-50 font-semibold h-8"
              disabled={bulkSaving}
              onClick={onCommit}>
              {bulkSaving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Committing…</>
                : <><Send className="w-3.5 h-3.5 mr-1.5" />Commit {selectedCount} to GREEN</>}
            </Button>
          </div>
        </div>
      </div>

      {dirtyCount > 0 && (
        <div className="shrink-0 flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={onDiscardAll}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />{dirtyCount} unsaved · Discard all
          </Button>
        </div>
      )}
    </>
  );
}
```

## `src/app/pages/action-required/ArConfirm.tsx`

```tsx
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EditState, EntryRow } from './arTypes';

/** Commit confirmation modal. Split out of ActionRequired.tsx, AR-1. */
export function ArConfirm({ toConfirm, getEdit, bulkSaving, onCancel, onConfirm }: {
  toConfirm: EntryRow[];
  getEdit: (row: EntryRow) => EditState;
  bulkSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-border p-6 max-w-lg w-full mx-4">
        <h2 className="text-base font-bold mb-2">Confirm Commit</h2>
        <p className="text-sm text-muted-foreground mb-3">
          You are about to commit <span className="font-semibold text-foreground">{toConfirm.length}</span> row(s) to GREEN.
        </p>
        <div className="max-h-40 overflow-y-auto border border-border rounded-lg mb-3">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Employee</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Date</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Event 1</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Pay Impact 1</th>
              </tr>
            </thead>
            <tbody>
              {toConfirm.map(row => {
                const edit = getEdit(row);
                const event1 = edit.event_type_1 || row.event_type_1;
                const impact1 = edit.pay_impact_1 || row.pay_impact_1;
                return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-3 py-1.5 font-medium">{row.employee_name}</td>
                    <td className="px-3 py-1.5 font-mono text-slate-600">{row.work_date.slice(0, 10)}</td>
                    <td className="px-3 py-1.5 text-slate-700">{event1 || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-1.5 text-blue-700 font-medium">{impact1 || <span className="text-slate-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          ⚠ This writes to the payroll record. Each row can be reverted individually from the Committed list below.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={bulkSaving} onClick={onConfirm}>
            {bulkSaving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Committing…</>
              : 'Confirm & Commit'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

## `src/app/pages/action-required/useArSave.ts`

```ts
import { useMutateAction } from '@uibakery/data';
import updatePayrollEntryAction from '@/actions/updatePayrollEntry';
import updatePunchTimesAction from '@/actions/updatePunchTimes';
import { computeDerivedFields } from '@/app/lib/classificationEngine';
import { computePunchMinutes } from '@/app/lib/punchMinutes';
import type { CommittedRow, EditState, EntryRow } from './arTypes';

/** Row save and revert, split out of ActionRequired.tsx (AR-1). Same two actions, same order. */
export function useArSave(getEdit: (row: EntryRow) => EditState) {
  const [updateEntry] = useMutateAction(updatePayrollEntryAction);
  const [updateTimes] = useMutateAction(updatePunchTimesAction);

  // Save a single row, returns derived status; null when the row was refused
  const saveRow = async (row: EntryRow): Promise<string | null> => {
    const edit = getEdit(row);
    // Minutes are recomputed from the row's punches on every commit, so a row
    // whose stored minutes are stale is corrected by any commit.
    const mins = computePunchMinutes({
      entry_time: edit.entry_time, exit_time: edit.exit_time,
      scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
    });
    if (!mins) return null;
    const derived = computeDerivedFields({
      event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
      event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
      late_minutes: mins.late_minutes, late_after_grace: mins.late_after_grace,
      early_leave_minutes: mins.early_leave_minutes, initial_status: row.initial_status,
    });
    await updateTimes({
      id: row.id,
      entry_time: edit.entry_time || null, exit_time: edit.exit_time || null,
      late_minutes: mins.late_minutes, late_after_grace: mins.late_after_grace, early_leave_minutes: mins.early_leave_minutes,
    });
    await updateEntry({
      id: row.id,
      event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
      event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
      documentation: edit.documentation, notes: edit.notes,
      discount_total_minutes: derived.discount_total_minutes,
      payroll_ready: derived.payroll_ready, status_current: derived.status_current,
    });
    return derived.status_current;
  };

  // Put a committed row back to its initial status (payroll_ready NO)
  const revertRow = async (r: CommittedRow): Promise<void> => {
    await updateEntry({
      id: r.id,
      event_type_1: r.event_type_1,
      pay_impact_1: r.pay_impact_1,
      event_type_2: r.event_type_2,
      pay_impact_2: r.pay_impact_2,
      documentation: r.documentation,
      notes: r.notes,
      discount_total_minutes: r.discount_total_minutes,
      payroll_ready: 'NO',
      status_current: r.initial_status,
    });
  };

  return { saveRow, revertRow };
}
```

## Report
- Byte size of the seven files.
- Confirm no existing file changed.
