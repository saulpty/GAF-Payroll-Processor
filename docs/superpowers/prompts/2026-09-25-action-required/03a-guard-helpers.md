# Action Required AR-3a: guard and commit helpers (the current page keeps working)

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only these five files may change** (replace each whole file, or create it):
- `src/app/pages/action-required/arLogic.ts`
- `src/app/pages/action-required/ArBits.tsx`
- `src/app/pages/action-required/ArRow.tsx`
- `src/app/pages/action-required/ArConfirm.tsx`
- **New** `src/app/pages/action-required/useArCommit.ts`

**Do not touch any other file** — in particular NOT `app.tsx`, NOT `ActionRequired.tsx`, NOT
`useArSave.ts` (AR-3b handles those), and not `classificationEngine.ts`, `punchMinutes.ts`,
`parseTimeInput.ts`, any action, or `src/components/ui/*`. Every change here is backward
compatible: new props are optional or only used when passed, and `useArCommit.ts` is not
imported yet, so the page keeps working exactly as now until AR-3b.

What these add (wired up by AR-3b): refuse commits with an impossible Entry/Exit time or an
impact picked before its event; the Event box turns red, pulses twice and says
`Pick an event first`; the confirm dialog lists skipped rows with the reason; a one-row
`Commit` button; commit / Undo / Revert logic in `useArCommit.ts`.

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
export function BroadcastSelect({ value, options, placeholder, broadcasting, onChange, invalid = false }: {
  value: string;
  options: string[];
  placeholder: string;
  broadcasting: boolean;
  onChange: (v: string) => void;
  /** Required but empty (an impact was picked first): red, pulses twice when it turns on. */
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={`w-full border rounded px-1.5 py-1 text-xs bg-white transition-colors ${
          invalid
            ? 'border-red-600 bg-red-50 animate-flash-required'
            : broadcasting
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

## `src/app/pages/action-required/ArRow.tsx`

```tsx
import { CheckSquare, Send, Square } from 'lucide-react';
import { TimeInput } from '@/app/components/TimeInput';
import { computePunchMinutes } from '@/app/lib/punchMinutes';
import { BroadcastSelect } from './ArBits';
import { missingEvent } from './arLogic';
import type { EditState, EntryRow } from './arTypes';

/** One editable row of the work table. Split out of ActionRequired.tsx, AR-1. */
export function ArRow({
  row, rowIndex, edit, dirty, isSelected, selectedSize, showPeriod,
  eventOpts, impactOptions, docOpts, visibleRows, onToggle, onEdit, canCommitOne, onCommitOne,
}: {
  row: EntryRow; rowIndex: number; edit: EditState; dirty: boolean;
  isSelected: boolean; selectedSize: number; showPeriod: boolean;
  eventOpts: string[]; impactOptions: string[]; docOpts: string[];
  visibleRows: EntryRow[];
  onToggle: (id: number, index: number, shiftKey: boolean) => void;
  onEdit: (id: number, field: keyof EditState, value: string, row: EntryRow, allRows?: EntryRow[]) => void;
  /** Show this row's own Commit button (one-offs; the bulk bar is for 2+ rows). */
  canCommitOne: boolean;
  onCommitOne: (row: EntryRow) => void;
}) {
  const needsEvent = missingEvent(edit);
  const live = dirty ? computePunchMinutes({
    entry_time: edit.entry_time, exit_time: edit.exit_time,
    scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
  }) : null;
  const lateShown = live ? live.late_minutes : row.late_minutes;
  const earlyShown = live ? live.early_leave_minutes : row.early_leave_minutes;
  const broadcasting = isSelected && selectedSize > 1;
  const rowBg = isSelected
    ? 'bg-blue-50'
    : dirty
      ? row.initial_status === 'RED' ? 'bg-red-50' : 'bg-amber-50/70'
      : row.initial_status === 'RED' ? 'bg-[#FFF0F0]' : 'bg-[#FFFBEB]';

  return (
    <tr className={`${rowBg} border-b hover:brightness-[0.97] transition-colors ${isSelected ? 'ring-1 ring-inset ring-blue-300' : ''}`}>
      {/* Checkbox */}
      <td className={`px-2 py-2 w-8 border-r sticky left-0 z-10 ${rowBg}`}>
        <button onClick={e => onToggle(row.id, rowIndex, e.shiftKey)} className="flex items-center justify-center w-full">
          {isSelected
            ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
            : <Square className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500" />}
        </button>
      </td>
      {/* Frozen employee */}
      <td className={`px-3 py-2 font-medium whitespace-nowrap border-r sticky left-8 z-10 ${rowBg}`}>
        <span
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          onClick={e => onToggle(row.id, rowIndex, e.shiftKey)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { if (e.key === ' ') e.preventDefault(); onToggle(row.id, rowIndex, e.shiftKey); } }}
          className="cursor-pointer hover:text-blue-700 transition-colors"
        >{row.employee_name}</span>
        {canCommitOne && (
          <button type="button" onClick={() => onCommitOne(row)} title="Commit this row to GREEN"
            className="ml-2 inline-flex items-center gap-1 rounded bg-blue-700 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-800">
            <Send className="w-3 h-3" />Commit
          </button>
        )}
      </td>
      {showPeriod && <td className="px-3 py-1.5 border-r whitespace-nowrap text-slate-600">{row.period_name}</td>}
      <td className="px-3 py-2 whitespace-nowrap border-r font-mono text-slate-700">{row.work_date.slice(0, 10)}</td>
      {/* Entry/Exit */}
      <td className="px-1 py-1.5 border-r w-24 bg-blue-50/40" style={{ width: 112, minWidth: 112 }}>
        <TimeInput className="w-full border rounded px-1 py-1 text-xs bg-white font-mono"
          value={edit.entry_time} placeholder="9:00 AM"
          onChange={v => onEdit(row.id, 'entry_time', v, row)} />
      </td>
      <td className="px-1 py-1.5 border-r w-24 bg-blue-50/40" style={{ width: 112, minWidth: 112 }}>
        <TimeInput className="w-full border rounded px-1 py-1 text-xs bg-white font-mono"
          value={edit.exit_time} placeholder="5:00 PM"
          onChange={v => onEdit(row.id, 'exit_time', v, row)} />
      </td>
      <td className="px-3 py-2 whitespace-nowrap border-r text-slate-500 text-[11px]">{row.scheduled_start}–{row.scheduled_end}</td>
      <td className="px-3 py-2 text-center border-r">
        {lateShown > 0 ? <span className={`font-semibold ${live && lateShown !== row.late_minutes ? 'text-amber-600' : 'text-red-700'}`}>{lateShown}</span> : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2 text-center border-r">
        {earlyShown > 0 ? <span className={`font-semibold ${live && earlyShown !== row.early_leave_minutes ? 'text-amber-600' : 'text-orange-600'}`}>{earlyShown}</span> : <span className="text-slate-300">—</span>}
      </td>
      {/* Event 1 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.event_type_1} broadcasting={broadcasting} invalid={needsEvent === 1}
          onChange={v => onEdit(row.id, 'event_type_1', v, row, visibleRows)}
          placeholder="— none —" options={eventOpts} />
        {needsEvent === 1 && <div className="mt-0.5 text-[10px] font-medium text-red-700">Pick an event first</div>}
      </td>
      {/* Impact 1 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.pay_impact_1} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'pay_impact_1', v, row, visibleRows)}
          placeholder="— pick —" options={impactOptions} />
      </td>
      {/* Event 2 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.event_type_2} broadcasting={broadcasting} invalid={needsEvent === 2}
          onChange={v => onEdit(row.id, 'event_type_2', v, row, visibleRows)}
          placeholder="— none —" options={eventOpts} />
        {needsEvent === 2 && <div className="mt-0.5 text-[10px] font-medium text-red-700">Pick an event first</div>}
      </td>
      {/* Impact 2 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.pay_impact_2} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'pay_impact_2', v, row, visibleRows)}
          placeholder="— pick —" options={impactOptions} />
      </td>
      {/* Doc */}
      <td className="px-2 py-1.5 border-r min-w-28">
        <BroadcastSelect value={edit.documentation} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'documentation', v, row, visibleRows)}
          placeholder="—" options={docOpts} />
      </td>
      {/* Auto-notes */}
      <td className="px-3 py-2 border-r text-slate-500 max-w-52 text-[11px]">
        <span title={row.auto_notes} className="block truncate">{row.auto_notes || <span className="text-slate-300">—</span>}</span>
      </td>
      {/* Notes */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <input className="w-full border rounded px-1.5 py-1 text-xs bg-white" value={edit.notes}
          placeholder="add note…" onChange={e => onEdit(row.id, 'notes', e.target.value, row)} />
      </td>
    </tr>
  );
}
```

## `src/app/pages/action-required/ArConfirm.tsx`

```tsx
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EditState, EntryRow } from './arTypes';

/** Commit confirmation modal. Split out of ActionRequired.tsx, AR-1. */
export function ArConfirm({ toConfirm, getEdit, reasonFor = () => null, bulkSaving, onCancel, onConfirm }: {
  toConfirm: EntryRow[];
  getEdit: (row: EntryRow) => EditState;
  /** Why a row will be skipped (bad time, impact without event), or null. */
  reasonFor?: (row: EntryRow) => string | null;
  bulkSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const skipped = toConfirm.filter(r => reasonFor(r) !== null).length;
  const ready = toConfirm.length - skipped;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-border p-6 max-w-lg w-full mx-4">
        <h2 className="text-base font-bold mb-2">Confirm Commit</h2>
        <p className="text-sm text-muted-foreground mb-3">
          You are about to commit <span className="font-semibold text-foreground">{ready}</span> row(s) to GREEN.
          {skipped > 0 && <span className="text-red-700"> {skipped} will be skipped (see below).</span>}
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
                const reason = reasonFor(row);
                return (
                  <tr key={row.id} className={`border-b last:border-b-0 ${reason ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-1.5 font-medium">
                      {row.employee_name}
                      {reason && <div className="text-[10px] font-medium text-red-700">Skipped: {reason}</div>}
                    </td>
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
          <Button disabled={bulkSaving || ready === 0} onClick={onConfirm}>
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

## `src/app/pages/action-required/useArCommit.ts`

```ts
import { useEffect, useState } from 'react';
import { isValidTimeInput } from '@/app/lib/parseTimeInput';
import { refusalReason } from './arLogic';
import type { CommittedRow, EditState, EntryRow } from './arTypes';

type SaveResult = { status: string; saved: CommittedRow } | null;

/**
 * Commit, Undo and Revert for Action Required (AR-3; moved out of the page).
 * Rows committed to GREEN leave the table at once; drafts are dropped only after
 * the reload lands; counts refresh through bumpArVersion; results go to the toast.
 */
export function useArCommit({ rows, getEdit, saveRow, revertRow, reload, reloadCommitted, markSaved, bumpArVersion, toast }: {
  rows: unknown;
  getEdit: (row: EntryRow) => EditState;
  saveRow: (row: EntryRow) => Promise<SaveResult>;
  revertRow: (r: CommittedRow) => Promise<void>;
  reload: () => Promise<unknown> | unknown;
  reloadCommitted: () => Promise<unknown> | unknown;
  markSaved: (id: number) => void;
  bumpArVersion: () => void;
  toast: { show: (o: { message: string; tone?: 'success' | 'error'; onUndo?: () => void }) => void };
}) {
  const [bulkSaving, setBulkSaving] = useState(false);
  const [sessionCommitted, setSessionCommitted] = useState<Set<number>>(new Set());
  const [revertingIds, setRevertingIds] = useState<Set<number>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  useEffect(() => { setHiddenIds(new Set()); }, [rows]);

  const reasonFor = (row: EntryRow) => refusalReason(getEdit(row), isValidTimeInput);

  const undoCommit = async (done: CommittedRow[]) => {
    for (const r of done) await revertRow(r);
    setSessionCommitted(prev => { const s = new Set(prev); done.forEach(r => s.delete(r.id)); return s; });
    bumpArVersion();
    await reload();
    await reloadCommitted();
    toast.show({ message: `Moved ${done.length} ${done.length === 1 ? 'row' : 'rows'} back to Action Required` });
  };

  const commitRows = async (toSave: EntryRow[]) => {
    if (!toSave.length) return;
    setBulkSaving(true);
    const refused: string[] = [];
    const savedIds: number[] = [];
    const green: CommittedRow[] = [];
    try {
      for (const row of toSave) {
        const label = `${row.employee_name} ${row.work_date.slice(0, 10)}`;
        const reason = reasonFor(row);
        if (reason) { refused.push(`${label} (${reason})`); continue; }
        const res = await saveRow(row);
        if (res === null) { refused.push(`${label} (Entry and Exit must look like 9:05 AM)`); continue; }
        savedIds.push(row.id);
        setSessionCommitted(prev => new Set(prev).add(row.id));
        if (res.status === 'GREEN') {
          green.push(res.saved);
          setHiddenIds(prev => new Set(prev).add(row.id));
        }
      }
    } finally {
      setBulkSaving(false);
    }
    if (refused.length) toast.show({ tone: 'error', message: `Not committed: ${refused.join(', ')}` });
    if (green.length) {
      toast.show({ message: `Committed ${green.length} ${green.length === 1 ? 'row' : 'rows'} to green`, onUndo: () => { void undoCommit(green); } });
    }
    bumpArVersion();
    await reload();
    // Drop the drafts only once fresh rows are in, so no row flashes its old values.
    savedIds.forEach(id => markSaved(id));
    await reloadCommitted();
  };

  const handleRevert = async (r: CommittedRow) => {
    setRevertingIds(prev => new Set(prev).add(r.id));
    try {
      await revertRow(r);
      setSessionCommitted(prev => { const s = new Set(prev); s.delete(r.id); return s; });
      bumpArVersion();
      await reload();
      await reloadCommitted();
    } finally {
      setRevertingIds(prev => { const s = new Set(prev); s.delete(r.id); return s; });
    }
  };

  return { commitRows, handleRevert, reasonFor, bulkSaving, sessionCommitted, setSessionCommitted, revertingIds, hiddenIds };
}
```

## Report
- Byte size of the five files.
- Confirm no other file changed (especially `app.tsx`, `ActionRequired.tsx`, `useArSave.ts`).
