# Action Required AR-2: no flash on commit, no stale rows, "Committed · Undo" toast, counts that refresh

Read `src/DESIGN.md` → Saving. **Only these five files may change:**
1. `src/app/pages/ActionRequired.tsx`: replace the whole file with section A.
2. `src/app/pages/action-required/useArSave.ts`: replace the whole file with section B.
3. `src/app/context/GlobalFilterContext.tsx`: add an `arVersion` counter (section C).
4. `src/app/FilterBar.tsx`: refetch the red/yellow counts when `arVersion` changes (section D).
5. `src/app/TopNav.tsx`: refetch the Action Required badge when `arVersion` changes (section E).

No other file may be touched: not `classificationEngine.ts`, `punchMinutes.ts`, `useRowEdits.ts`,
any action, `PayrollMaster.tsx`, `app.tsx`, the other `action-required/*` files, or
`src/components/ui/*`. The pay rules do not change: the same two actions are called with the
same values in the same order. Copy sections A and B exactly.

## What this fixes (Saul's notes, causes found in the code)
- **Screen flashes on commit / scroll resets**: `reload()` flipped `loading` and the whole
  table was swapped for "Loading entries…". Now only the very first load shows the spinner.
- **"Doesn't change but does change"**: drafts were dropped before the reload landed, so rows
  briefly showed their old values. Now rows committed to GREEN leave the table at once, and
  drafts are dropped only after fresh rows arrive.
- **Browser `alert()` for refused rows** becomes an error toast; a success toast
  `Committed N rows to green · Undo` appears (Undo = the existing revert, for those rows).
- **Red/yellow counts and the nav badge went stale after commits** (they only refetched when
  the period changed). Now every commit, revert and undo bumps `arVersion`, and both refetch.

## A. `src/app/pages/ActionRequired.tsx` (whole file)

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
import { filterRows, nextSort, rangeIds } from './action-required/arLogic';
import { ArHead } from './action-required/ArHead';
import { ArCommitBar } from './action-required/ArCommitBar';
import { ArRow } from './action-required/ArRow';
import { ArCommitted } from './action-required/ArCommitted';
import { ArConfirm } from './action-required/ArConfirm';
import { useArSave } from './action-required/useArSave';

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

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [committedOpen, setCommittedOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  // Track IDs committed this session for highlighting
  const [sessionCommitted, setSessionCommitted] = useState<Set<number>>(new Set());
  const [revertingIds, setRevertingIds] = useState<Set<number>>(new Set());
  const [showCommitConfirm, setShowCommitConfirm] = useState(false);
  // Rows committed to GREEN leave the table at once; the quiet reload then confirms it.
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  useEffect(() => { setHiddenIds(new Set()); }, [rows]);

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
    // auto-select the touched row
    setSelected(prev => new Set(prev).add(id));
  }, [update, rulesMap, selected]);

  const allRows = useMemo(() => (rows as EntryRow[]).filter(r => !hiddenIds.has(r.id)), [rows, hiddenIds]);
  // Only the very first load replaces the page with a spinner; later reloads are silent.
  const firstLoad = loading && (rows as EntryRow[]).length === 0;
  const filtered = useMemo(
    () => filterRows(allRows, activeTab, globalEmployee, sortKey, sortDir),
    [allRows, activeTab, globalEmployee, sortKey, sortDir],
  );

  // Bulk commit selected rows
  const handleBulkCommit = async () => {
    setShowCommitConfirm(false);
    const toSave = filtered.filter(r => selected.has(r.id));
    if (!toSave.length) return;
    setBulkSaving(true);
    const newCommitted = new Set(sessionCommitted);
    const refused: string[] = [];
    const savedIds: number[] = [];
    const green: CommittedRow[] = [];
    for (const row of toSave) {
      const res = await saveRow(row);
      if (res === null) { refused.push(`${row.employee_name} ${row.work_date.slice(0, 10)}`); continue; }
      newCommitted.add(row.id);
      savedIds.push(row.id);
      if (res.status === 'GREEN') {
        green.push(res.saved);
        setHiddenIds(prev => new Set(prev).add(row.id));
      }
    }
    setSessionCommitted(newCommitted);
    setSelected(new Set());
    setBulkSaving(false);
    if (refused.length) {
      toast.show({ tone: 'error', message: `Not committed. Entry and Exit must look like 9:05 AM: ${refused.join(', ')}` });
    }
    if (green.length) {
      toast.show({ message: `Committed ${green.length} ${green.length === 1 ? 'row' : 'rows'} to green`, onUndo: () => { void undoCommit(green); } });
    }
    bumpArVersion();
    await reload();
    // Drop the drafts only once fresh rows are in, so no row flashes its old values.
    savedIds.forEach(id => markSaved(id));
    await reloadCommitted();
  };

  // Undo from the toast: the same revert as the Committed list's button, for those rows.
  const undoCommit = async (done: CommittedRow[]) => {
    for (const r of done) await revertRow(r);
    setSessionCommitted(prev => { const s = new Set(prev); done.forEach(r => s.delete(r.id)); return s; });
    bumpArVersion();
    await reload();
    await reloadCommitted();
    toast.show({ message: `Moved ${done.length} ${done.length === 1 ? 'row' : 'rows'} back to Action Required` });
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

          <ArCommitBar someSelected={someSelected} selectedCount={selectedCount} selectedSize={selected.size}
            bulkSaving={bulkSaving} dirtyCount={dirtyCount}
            onDeselectAll={() => setSelected(new Set())} onCommit={() => setShowCommitConfirm(true)} onDiscardAll={discardAll} />

          {/* ── Work table ─────────────────────────────────────── */}
          <div className="flex-1 min-h-0 rounded-lg border shadow-sm overflow-auto">
            <table className="w-full text-xs border-collapse tabular-nums" style={{ minWidth: 1120 }}>
              <ArHead allFilteredSelected={allFilteredSelected} someSelected={someSelected} showPeriod={!selectedPeriod}
                sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onToggleAll={toggleSelectAll} />
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={15} className="px-4 py-8 text-center text-muted-foreground text-sm">No results match your filter.</td></tr>
                )}
                {filtered.map((row, rowIndex) => (
                  <ArRow key={row.id} row={row} rowIndex={rowIndex}
                    edit={getEdit(row)} dirty={isDirty(row)}
                    isSelected={selected.has(row.id)} selectedSize={selected.size}
                    showPeriod={!selectedPeriod}
                    eventOpts={eventOpts} impactOptions={impactOptions} docOpts={docOpts}
                    visibleRows={filtered} onToggle={toggleRow} onEdit={setEditField} />
                ))}
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
      {showCommitConfirm && (
        <ArConfirm toConfirm={filtered.filter(r => selected.has(r.id))} getEdit={getEdit} bulkSaving={bulkSaving}
          onCancel={() => setShowCommitConfirm(false)} onConfirm={handleBulkCommit} />
      )}
    </div>
  );
}
```

## B. `src/app/pages/action-required/useArSave.ts` (whole file)

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

## C. `src/app/context/GlobalFilterContext.tsx`

Same pattern as the existing `ptoVersion`, nothing else changes:
1. In `interface GlobalFilters`, after `bumpPtoVersion: () => void;` add:
   ```ts
     arVersion: number;
     bumpArVersion: () => void;
   ```
2. In `GlobalFilterProvider`, after the `bumpPtoVersion` line add:
   ```ts
     const [arVersion, setArVersion] = useState(0);
     const bumpArVersion = () => setArVersion(v => v + 1);
   ```
3. In the `value` object, after `ptoVersion, bumpPtoVersion,` add `arVersion, bumpArVersion,`
4. In that `useMemo`'s dependency array, after `ptoVersion,` add `arVersion,`

## D. `src/app/FilterBar.tsx`

1. Add `arVersion,` to the destructured `useGlobalFilters()` list (next to `periodsVersion,`).
2. Change `const [countsRaw] = useLoadAction(` to `const [countsRaw, , , reloadCounts] = useLoadAction(`
   (arguments unchanged).
3. Directly after the line `const counts = (countsRaw as CountsRow[])[0] ?? { red_count: 0, yellow_count: 0 };` add:
   ```ts
     // Refetch the red/yellow counts after any Action Required commit, revert or undo.
     const arVersionRef = useRef(arVersion);
     useEffect(() => {
       if (arVersionRef.current !== arVersion) {
         arVersionRef.current = arVersion;
         reloadCounts();
       }
     }, [arVersion, reloadCounts]);
   ```
   (`useRef` and `useEffect` are already imported; add them to the `react` import only if missing.)

## E. `src/app/TopNav.tsx`

1. Change `const { ptoVersion } = useGlobalFilters();` to `const { ptoVersion, arVersion } = useGlobalFilters();`
2. Change `const [unresolvedData]  = useLoadAction(loadUnresolvedCountAction, [] as { count: number }[]);`
   to `const [unresolvedData, , , reloadUnresolved] = useLoadAction(loadUnresolvedCountAction, [] as { count: number }[]);`
3. Directly after the existing `ptoVersion` `useEffect` block add:
   ```ts
     // Reload the Action Required badge after any commit, revert or undo there.
     const arVersionRef = useRef(arVersion);
     useEffect(() => {
       if (arVersionRef.current !== arVersion) {
         arVersionRef.current = arVersion;
         reloadUnresolved();
       }
     }, [arVersion, reloadUnresolved]);
   ```

## Report
- Byte size of all five files (each under 15 KB).
- The three snippet edits (C, D, E) as they now read.
- Confirm no other file changed and `/action-required` renders with no console errors.
