# Action Required AR-7: Undo puts the row back exactly as it was

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only these three files may change:**
- `src/app/pages/action-required/useArSave.ts` (whole file below): adds `restoreRow`.
- `src/app/pages/action-required/useArCommit.ts` (whole file below): the toast's Undo uses it.
- `src/app/pages/ActionRequired.tsx`: exactly the two line replacements at the end.

No other file may be touched. The Committed list's revert button is unchanged (it still moves a
row back with its committed choices); only the toast's **Undo** changes.

## Why
Code review #6: Undo after a commit only moved the row back to Action Required with the committed
choices, and punch times edited before the commit stayed edited. Undo now writes back the row as
it was loaded before the commit: times and minutes, events, impacts, doc, notes, discount,
readiness and status, using the same two actions in the same order as a save.

## `src/app/pages/action-required/useArSave.ts` (whole file)

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

  // Undo from the toast (AR-7): put the row back exactly as it was loaded before the
  // commit — punch times and minutes, events, impacts, doc, notes, discount, readiness
  // and status. Values are written as loaded (a NULL stays NULL).
  const restoreRow = async (o: EntryRow): Promise<void> => {
    await updateTimes({
      id: o.id,
      entry_time: o.entry_time, exit_time: o.exit_time,
      late_minutes: o.late_minutes, late_after_grace: o.late_after_grace, early_leave_minutes: o.early_leave_minutes,
    });
    await updateEntry({
      id: o.id,
      event_type_1: o.event_type_1, pay_impact_1: o.pay_impact_1,
      event_type_2: o.event_type_2, pay_impact_2: o.pay_impact_2,
      documentation: o.documentation, notes: o.notes,
      discount_total_minutes: o.discount_total_minutes,
      payroll_ready: o.payroll_ready, status_current: o.status_current,
    });
  };

  return { saveRow, revertRow, restoreRow };
}
```

## `src/app/pages/action-required/useArCommit.ts` (whole file)

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
export function useArCommit({ rows, getEdit, saveRow, revertRow, restoreRow, reload, reloadCommitted, markSaved, bumpArVersion, toast }: {
  rows: unknown;
  getEdit: (row: EntryRow) => EditState;
  saveRow: (row: EntryRow) => Promise<SaveResult>;
  revertRow: (r: CommittedRow) => Promise<void>;
  /** Undo (AR-7): writes the row back exactly as it was before the commit. */
  restoreRow: (original: EntryRow) => Promise<void>;
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

  // Undo restores the rows as they were loaded before the commit (times included).
  const undoCommit = async (done: EntryRow[]) => {
    const failed: string[] = [];
    let moved = 0;
    for (const r of done) {
      try { await restoreRow(r); moved++; } catch { failed.push(`${r.employee_name} ${r.work_date.slice(0, 10)}`); }
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
    const green: EntryRow[] = [];
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
          green.push(row);
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

## `src/app/pages/ActionRequired.tsx`: two exact replacements, nothing else

1. Replace
   `  const { saveRow, revertRow } = useArSave(getEdit);`
   with
   `  const { saveRow, revertRow, restoreRow } = useArSave(getEdit);`
2. Replace
   `    useArCommit({ rows, getEdit, saveRow, revertRow, reload, reloadCommitted, markSaved, bumpArVersion, toast });`
   with
   `    useArCommit({ rows, getEdit, saveRow, revertRow, restoreRow, reload, reloadCommitted, markSaved, bumpArVersion, toast });`

## Report
- Byte size of the three files; confirm no other file changed.
