# Action Required AR-3: guards, and the bulk bar is for bulk

Read `src/DESIGN.md` → Bulk actions, Required and dependent fields, Time inputs.
**Only these six files may change** (replace each whole file with the code below, exactly):
- `src/app/pages/ActionRequired.tsx`
- `src/app/pages/action-required/arLogic.ts`
- `src/app/pages/action-required/ArBits.tsx`
- `src/app/pages/action-required/ArRow.tsx`
- `src/app/pages/action-required/ArConfirm.tsx`
- **New** `src/app/pages/action-required/useArCommit.ts`

No other file may be touched: not `useArSave.ts`, `ArCommitBar.tsx`, `ArCommitted.tsx`,
`ArHead.tsx`, `arTypes.ts`, `classificationEngine.ts`, `punchMinutes.ts`, `parseTimeInput.ts`,
`useRowEdits.ts`, any action, `FilterBar.tsx`, `TopNav.tsx`, `GlobalFilterContext.tsx`,
`PayrollMaster.tsx`, or `src/components/ui/*`. The pay rules do not change: rows that pass the
new checks are saved by the same `useArSave.saveRow` as before.

## What this fixes (Saul's notes)
- **"55:00 PM" could be committed.** A row is now refused when Entry or Exit is not a real time
  (`isValidTimeInput`), and the confirm dialog shows `Skipped: Entry or Exit is not a real time`.
- **Impact picked before Event gave no feedback** (the row stayed not-ready silently). The Event
  box now turns red, pulses twice (`animate-flash-required`) and shows `Pick an event first`,
  and the row is skipped with that reason.
- **The bulk bar showed for one-offs.** It now needs 2+ selected rows (`showBulkBar`). One row
  commits from its own small `Commit` button next to the name (visible when the row has unsaved
  edits or is the one selected row), through the same confirm dialog.
- **Bulk edits "don't change but do change".** Editing a row used to select it silently, so after
  touching two rows the next dropdown change was broadcast to both. Editing no longer selects;
  selection is the checkbox only, and broadcast applies only to a deliberate 2+ selection.
- Commit / Undo / Revert move into `useArCommit.ts` so the page stays small (unchanged logic from
  AR-2, plus the refusal check before each save).

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
export function ArConfirm({ toConfirm, getEdit, reasonFor, bulkSaving, onCancel, onConfirm }: {
  toConfirm: EntryRow[];
  getEdit: (row: EntryRow) => EditState;
  /** Why a row will be skipped (bad time, impact without event), or null. */
  reasonFor: (row: EntryRow) => string | null;
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

## `src/app/pages/ActionRequired.tsx` (whole file)

```tsx
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import loadActionRequiredAction from '@/actions/loadActionRequired';
import loadCommittedEntriesAction from '@/actions/loadCommittedEntries';
import loadEventTypeRulesAction from '@/actions/loadEventTypeRules';
import loadPayImpactsAction from '@/actions/loadPayImpacts';
import loadDocumentationOptionsAction from '@/actions/loadDocumentationOptions';
import loadEventTypesAction from '@/actions/loadEventTypes';
import { useRowEdits } from '@/app/lib/useRowEdits';
import { ToastProvider, useToast } from '@/app/components/ds/Toast';
import { BROADCAST_FIELDS, toEditState, type CommittedRow, type EditState, type EntryRow, type SortDir, type SortKey } from './action-required/arTypes';
import { filterRows, nextSort, rangeIds, showBulkBar } from './action-required/arLogic';
import { ArHead } from './action-required/ArHead';
import { ArCommitBar } from './action-required/ArCommitBar';
import { ArRow } from './action-required/ArRow';
import { ArCommitted } from './action-required/ArCommitted';
import { ArConfirm } from './action-required/ArConfirm';
import { useArSave } from './action-required/useArSave';
import { useArCommit } from './action-required/useArCommit';

// The page owns its toasts (page-by-page rollout: app.tsx is untouched).
export default function ActionRequired() {
  return <ToastProvider><ActionRequiredPage /></ToastProvider>;
}

function ActionRequiredPage() {
  const { period: selectedPeriod, employee: globalEmployee, statusTab: activeTab, bumpArVersion } = useGlobalFilters();
  const toast = useToast();
  const [payImpacts] = useLoadAction(loadPayImpactsAction, [] as { name: string }[]);
  const [docOptions] = useLoadAction(loadDocumentationOptionsAction, [] as { name: string }[]);
  const [eventTypes] = useLoadAction(loadEventTypesAction, [] as { id: number; name: string }[]);
  const [eventRulesRaw] = useLoadAction(loadEventTypeRulesAction, [] as { event_type: string; default_pay_impact: string; default_doc_option: string }[]);

  const [params, setParams] = useState({ periodName: selectedPeriod });
  const [rows, loading, , reload] = useLoadAction(loadActionRequiredAction, [] as EntryRow[], params);
  const { getEdit, update, isDirty, discardAll, markSaved, dirtyCount } = useRowEdits<EntryRow, EditState>(toEditState, rows as EntryRow[]);
  const [committedRows, , , reloadCommitted] = useLoadAction(loadCommittedEntriesAction, [] as CommittedRow[], params);
  const { saveRow, revertRow } = useArSave(getEdit);
  const { commitRows, handleRevert, reasonFor, bulkSaving, sessionCommitted, setSessionCommitted, revertingIds, hiddenIds } =
    useArCommit({ rows, getEdit, saveRow, revertRow, reload, reloadCommitted, markSaved, bumpArVersion, toast });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [committedOpen, setCommittedOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  // Rows waiting in the confirm dialog: the bulk selection, or one row's own Commit button.
  const [confirmIds, setConfirmIds] = useState<number[] | null>(null);

  const impactOptions = (payImpacts as { name: string }[]).map(p => p.name);
  const docOpts = (docOptions as { name: string }[]).map(d => d.name);
  const eventOpts = (eventTypes as { name: string }[]).map(e => e.name);

  const rulesMap = useMemo(() => {
    const m = new Map<string, { pay_impact: string; doc_option: string }>();
    for (const r of eventRulesRaw) {
      m.set(r.event_type, { pay_impact: r.default_pay_impact || '', doc_option: r.default_doc_option || '' });
    }
    return m;
  }, [eventRulesRaw]);

  // Sync params when global period changes
  useEffect(() => {
    setParams({ periodName: selectedPeriod });
    discardAll();
    setSelected(new Set());
    setSessionCommitted(new Set());
    setSortKey(null);
    setSortDir(null);
  }, [selectedPeriod]);

  // Editing a row no longer selects it (AR-3): selection is the checkbox only, so an
  // edit never silently broadcasts to rows touched earlier. Broadcast still applies
  // when the edited row is part of a deliberate 2+ selection.
  const setEditField = useCallback((id: number, field: keyof EditState, value: string, row: EntryRow, allRows?: EntryRow[]) => {
    const isBroadcast = BROADCAST_FIELDS.includes(field) && selected.has(id) && selected.size > 1;
    const targetIds = isBroadcast ? Array.from(selected) : [id];
    const rowMap = new Map((allRows ?? []).map(r => [r.id, r]));

    for (const tid of targetIds) {
      const trow = rowMap.get(tid) ?? row;
      update(tid, trow, current => {
        const updated = { ...current, [field]: value };
        if (field === 'event_type_1' && value && rulesMap.has(value)) {
          const rule = rulesMap.get(value)!;
          if (!current.pay_impact_1 && rule.pay_impact) updated.pay_impact_1 = rule.pay_impact;
          if (!current.documentation && rule.doc_option) updated.documentation = rule.doc_option;
        }
        if (field === 'event_type_2' && value && rulesMap.has(value)) {
          const rule = rulesMap.get(value)!;
          if (!current.pay_impact_2 && rule.pay_impact) updated.pay_impact_2 = rule.pay_impact;
        }
        return updated;
      });
    }
  }, [update, rulesMap, selected]);

  const allRows = useMemo(() => (rows as EntryRow[]).filter(r => !hiddenIds.has(r.id)), [rows, hiddenIds]);
  // Only the very first load replaces the page with a spinner; later reloads are silent.
  const firstLoad = loading && (rows as EntryRow[]).length === 0;
  const filtered = useMemo(
    () => filterRows(allRows, activeTab, globalEmployee, sortKey, sortDir),
    [allRows, activeTab, globalEmployee, sortKey, sortDir],
  );

  const handleConfirm = async () => {
    const ids = new Set(confirmIds ?? []);
    setConfirmIds(null);
    const toSave = filtered.filter(r => ids.has(r.id));
    setSelected(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
    await commitRows(toSave);
  };

  const handleSort = (key: SortKey) => {
    const [k, d] = nextSort(sortKey, sortDir, key);
    setSortKey(k);
    setSortDir(d);
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const someSelected = filtered.some(r => selected.has(r.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(r => s.delete(r.id)); return s; });
      setLastSelectedIndex(null);
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(r => s.add(r.id)); return s; });
      setLastSelectedIndex(filtered.length - 1);
    }
  };

  const toggleRow = (id: number, index: number, shiftKey: boolean) => {
    if (shiftKey && lastSelectedIndex !== null) {
      const ids = rangeIds(filtered, index, lastSelectedIndex);
      // If the anchor was selected, select the range; otherwise deselect
      const anchorSelected = selected.has(filtered[lastSelectedIndex]?.id);
      setSelected(prev => {
        const s = new Set(prev);
        ids.forEach(rid => anchorSelected ? s.add(rid) : s.delete(rid));
        return s;
      });
    } else {
      setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
      setLastSelectedIndex(index);
    }
  };

  const committed = committedRows as CommittedRow[];
  const selectedCount = filtered.filter(r => selected.has(r.id)).length;
  const bulk = showBulkBar(selectedCount);

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">

      {/* ── Empty states ────────────────────────────────────────── */}
      {firstLoad && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm mt-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading entries…</div>
      )}
      {!loading && allRows.length === 0 && (
        <Card className="border-green-300 bg-green-50 flex-1">
          <CardContent className="pt-12 text-center">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="text-green-800 font-semibold text-base">{selectedPeriod ? `All clear for ${selectedPeriod}!` : 'All clear — all periods!'}</p>
            <p className="text-green-700 text-sm mt-1">No unresolved entries.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Main content ─────────────────────────────────────────── */}
      {!firstLoad && allRows.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-hidden">

          <ArCommitBar someSelected={bulk} selectedCount={selectedCount} selectedSize={selected.size}
            bulkSaving={bulkSaving} dirtyCount={dirtyCount}
            onDeselectAll={() => setSelected(new Set())}
            onCommit={() => setConfirmIds(filtered.filter(r => selected.has(r.id)).map(r => r.id))}
            onDiscardAll={discardAll} />

          {/* ── Work table ─────────────────────────────────────── */}
          <div className="flex-1 min-h-0 rounded-lg border shadow-sm overflow-auto">
            <table className="w-full text-xs border-collapse tabular-nums" style={{ minWidth: 1120 }}>
              <ArHead allFilteredSelected={allFilteredSelected} someSelected={someSelected} showPeriod={!selectedPeriod}
                sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onToggleAll={toggleSelectAll} />
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={15} className="px-4 py-8 text-center text-muted-foreground text-sm">No results match your filter.</td></tr>
                )}
                {filtered.map((row, rowIndex) => {
                  const isSelected = selected.has(row.id);
                  const dirty = isDirty(row);
                  return (
                    <ArRow key={row.id} row={row} rowIndex={rowIndex}
                      edit={getEdit(row)} dirty={dirty}
                      isSelected={isSelected} selectedSize={selected.size}
                      showPeriod={!selectedPeriod}
                      eventOpts={eventOpts} impactOptions={impactOptions} docOpts={docOpts}
                      visibleRows={filtered} onToggle={toggleRow} onEdit={setEditField}
                      canCommitOne={!bulk && !bulkSaving && (dirty || isSelected)}
                      onCommitOne={r => setConfirmIds([r.id])} />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Committed section ──────────────────────────────────── */}
      {!firstLoad && (
        <ArCommitted committed={committed} sessionCommitted={sessionCommitted} revertingIds={revertingIds}
          showPeriod={!selectedPeriod} committedOpen={committedOpen} setCommittedOpen={setCommittedOpen}
          onRevert={handleRevert} />
      )}

      {/* ── Commit confirmation modal ─────────────────────────── */}
      {confirmIds && (
        <ArConfirm toConfirm={filtered.filter(r => confirmIds.includes(r.id))} getEdit={getEdit} reasonFor={reasonFor}
          bulkSaving={bulkSaving} onCancel={() => setConfirmIds(null)} onConfirm={handleConfirm} />
      )}
    </div>
  );
}
```

## Report
- Byte size of the six files (each under 15 KB).
- Confirm no other file changed and `/action-required` renders with no console errors.
