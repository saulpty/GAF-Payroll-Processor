# Action Required AR-3b: restore app.tsx, and switch the page to the new save/commit flow

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only these four files may change:**

## 1. `src/app/app.tsx`: undo the AR-2 prompt's edit (it was not allowed)

Remove exactly these three lines and change nothing else in the file:
- `import { ToastProvider } from '@/app/components/ds/Toast';`
- `<ToastProvider>` (the line directly inside `<GlobalFilterProvider>`)
- `</ToastProvider>` (the line directly before `</GlobalFilterProvider>`)

The Action Required page mounts its own `ToastProvider` (page-by-page rollout); app.tsx must be
exactly as it was before the AR-2 prompt.

## 2. `src/app/pages/action-required/useArSave.ts` (whole file)

`saveRow` now also returns the row as saved, which Undo needs. The two actions, their values
and their order are unchanged.

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

  // Save a single row. Returns the derived status plus the row as saved (what a
  // revert/Undo needs); null when the row was refused.
  const saveRow = async (row: EntryRow): Promise<{ status: string; saved: CommittedRow } | null> => {
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
    return {
      status: derived.status_current,
      saved: {
        id: row.id, period_name: row.period_name, employee_name: row.employee_name, work_date: row.work_date,
        event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
        event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
        documentation: edit.documentation, notes: edit.notes, auto_notes: row.auto_notes,
        initial_status: row.initial_status, status_current: derived.status_current,
        discount_total_minutes: derived.discount_total_minutes, updated_at: '',
      },
    };
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

## 3. `src/app/pages/action-required/useArCommit.ts` (whole file, replaces AR-3a's version)

Code-review fixes: each row saves in its own `try` (one failure is reported and never stops or
silences the rest); Undo and Revert report failures; loaders are read through a ref so a late
Undo uses the current period; the `hiddenIds` reset keeps the same Set when already empty.

```ts
import { useEffect, useRef, useState } from 'react';
import { isValidTimeInput } from '@/app/lib/parseTimeInput';
import { refusalReason } from './arLogic';
import type { CommittedRow, EditState, EntryRow } from './arTypes';

type SaveResult = { status: string; saved: CommittedRow } | null;
type Fn = () => unknown;
const plural = (n: number) => `${n} ${n === 1 ? 'row' : 'rows'}`;

/**
 * Commit, Undo and Revert for Action Required (AR-3; moved out of the page).
 * Rows committed to GREEN leave the table at once; drafts are dropped only after
 * the reload lands; counts refresh through bumpArVersion; results go to the toast.
 * Each row is saved on its own: one failure is reported and never stops the rest.
 */
export function useArCommit({ rows, getEdit, saveRow, revertRow, reload, reloadCommitted, markSaved, bumpArVersion, toast }: {
  rows: unknown;
  getEdit: (row: EntryRow) => EditState;
  saveRow: (row: EntryRow) => Promise<SaveResult>;
  revertRow: (r: CommittedRow) => Promise<void>;
  reload: Fn;
  reloadCommitted: Fn;
  markSaved: (id: number) => void;
  bumpArVersion: () => void;
  toast: { show: (o: { message: string; tone?: 'success' | 'error'; onUndo?: () => void }) => void };
}) {
  const [bulkSaving, setBulkSaving] = useState(false);
  const [sessionCommitted, setSessionCommitted] = useState<Set<number>>(new Set());
  const [revertingIds, setRevertingIds] = useState<Set<number>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  // Fresh rows arrived: nothing needs hiding any more. Keeps the same Set when already empty.
  useEffect(() => { setHiddenIds(prev => (prev.size ? new Set() : prev)); }, [rows]);

  // Undo can fire seconds later, after a period change: always call the current loaders.
  const live = useRef({ reload, reloadCommitted, bumpArVersion });
  live.current = { reload, reloadCommitted, bumpArVersion };
  const refresh = async () => {
    live.current.bumpArVersion();
    await live.current.reload();
    await live.current.reloadCommitted();
  };

  const reasonFor = (row: EntryRow) => refusalReason(getEdit(row), isValidTimeInput);

  const undoCommit = async (done: CommittedRow[]) => {
    const failed: string[] = [];
    let moved = 0;
    for (const r of done) {
      try { await revertRow(r); moved++; } catch { failed.push(`${r.employee_name} ${r.work_date.slice(0, 10)}`); }
    }
    setSessionCommitted(prev => { const s = new Set(prev); done.forEach(r => s.delete(r.id)); return s; });
    await refresh();
    if (moved) toast.show({ message: `Moved ${plural(moved)} back to Action Required` });
    if (failed.length) toast.show({ tone: 'error', message: `Could not undo: ${failed.join(', ')}` });
  };

  const commitRows = async (toSave: EntryRow[]) => {
    if (!toSave.length) return;
    setBulkSaving(true);
    const refused: string[] = [];
    const failed: string[] = [];
    const savedIds: number[] = [];
    const green: CommittedRow[] = [];
    for (const row of toSave) {
      const label = `${row.employee_name} ${row.work_date.slice(0, 10)}`;
      const reason = reasonFor(row);
      if (reason) { refused.push(`${label} (${reason})`); continue; }
      try {
        const res = await saveRow(row);
        if (res === null) { refused.push(`${label} (Entry and Exit must look like 9:05 AM)`); continue; }
        savedIds.push(row.id);
        setSessionCommitted(prev => new Set(prev).add(row.id));
        if (res.status === 'GREEN') {
          green.push(res.saved);
          setHiddenIds(prev => new Set(prev).add(row.id));
        }
      } catch {
        failed.push(label);
      }
    }
    setBulkSaving(false);
    if (refused.length) toast.show({ tone: 'error', message: `Not committed: ${refused.join(', ')}` });
    if (failed.length) toast.show({ tone: 'error', message: `Save failed, please try again: ${failed.join(', ')}` });
    if (green.length) {
      toast.show({ message: `Committed ${plural(green.length)} to green`, onUndo: () => { void undoCommit(green); } });
    }
    const notGreen = savedIds.length - green.length;
    if (notGreen > 0) toast.show({ message: `Saved ${plural(notGreen)}; still not green` });
    try {
      await refresh();
    } finally {
      // Drop the drafts only once fresh rows are in, so no row flashes its old values.
      savedIds.forEach(id => markSaved(id));
    }
  };

  const handleRevert = async (r: CommittedRow) => {
    setRevertingIds(prev => new Set(prev).add(r.id));
    try {
      await revertRow(r);
      setSessionCommitted(prev => { const s = new Set(prev); s.delete(r.id); return s; });
      await refresh();
    } catch {
      toast.show({ tone: 'error', message: `Could not revert ${r.employee_name} ${r.work_date.slice(0, 10)}` });
    } finally {
      setRevertingIds(prev => { const s = new Set(prev); s.delete(r.id); return s; });
    }
  };

  return { commitRows, handleRevert, reasonFor, bulkSaving, sessionCommitted, setSessionCommitted, revertingIds, hiddenIds };
}
```

## 4. `src/app/pages/ActionRequired.tsx` (whole file)

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
  // edit never silently broadcasts to rows touched earlier. Broadcast applies only to a
  // deliberate 2+ selection, only to rows currently visible, and each target's draft is
  // built from that row's own data (never from the edited row's times or notes).
  const setEditField = useCallback((id: number, field: keyof EditState, value: string, row: EntryRow, visibleRows?: EntryRow[]) => {
    const isBroadcast = BROADCAST_FIELDS.includes(field) && selected.has(id) && selected.size > 1;
    const visibleIds = new Set((visibleRows ?? []).map(r => r.id));
    const targetIds = isBroadcast ? Array.from(selected).filter(t => t === id || visibleIds.has(t)) : [id];
    const rowMap = new Map((rows as EntryRow[]).map(r => [r.id, r]));

    for (const tid of targetIds) {
      const trow = tid === id ? row : rowMap.get(tid);
      if (!trow) continue;
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
  }, [update, rulesMap, selected, rows]);

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
    setLastSelectedIndex(null);
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
      {!firstLoad && allRows.length === 0 && (
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
          {/* While data refreshes the table stays put but dims and ignores clicks, so the
              previous period's rows can never be edited or committed by mistake. */}
          <div className={`flex-1 min-h-0 rounded-lg border shadow-sm overflow-auto transition-opacity ${loading ? 'opacity-60 pointer-events-none' : ''}`}
            aria-busy={loading || undefined}>
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

**No other file may be touched**: not `GlobalFilterContext.tsx`, `FilterBar.tsx`, `TopNav.tsx`
(their `arVersion` edits stay as they are), not the other `action-required/*` files, not
`parseTimeInput.ts`, `TimeInput.tsx`, `PayrollMaster.tsx` (AR-3c), `classificationEngine.ts`,
`punchMinutes.ts`, any action, or `src/components/ui/*`.

## What this delivers
- Only the first load shows a spinner; commits no longer flash the table or reset the scroll.
  While data refreshes, the table dims and ignores clicks (no editing stale rows).
- Rows committed to GREEN leave at once; drafts are dropped only after fresh rows arrive.
- Toasts: `Committed N rows to green · Undo`; `Saved N rows; still not green`; refused and
  failed rows in an error toast (no browser `alert`).
- Counts and the nav badge refresh after commit, revert and undo.
- Refused rows: impossible Entry/Exit, or an impact without its event (red Event box, pulse,
  `Pick an event first`).
- The bulk bar needs 2+ selected rows; one row commits from its own `Commit` button.
- Editing a row no longer selects it. Bulk edits reach only **visible** selected rows, and each
  row's draft is built from that row's own data (fixes a bug where a hidden selected row got
  another employee's punch times).

## Report
- The three removed app.tsx lines, and confirmation app.tsx has no other change.
- Byte size of `useArSave.ts`, `useArCommit.ts` and `ActionRequired.tsx`.
- Confirm no other file changed and `/action-required` renders with no console errors.
