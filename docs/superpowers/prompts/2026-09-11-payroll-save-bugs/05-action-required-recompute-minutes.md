# 05 — Action Required: recompute late/early minutes on commit; retire updateEntryExit

## Files that may change

- `src/app/pages/ActionRequired.tsx`
- `src/actions/updateEntryExit.ts` — **delete this file** (after this change
  nothing imports it; Payroll Master already moved to `updatePunchTimes`).

No other file may be touched. Do not create, rename or reformat anything
else. Do NOT edit `updatePunchTimes.ts`, `updatePayrollEntry.ts`,
`punchMinutes.ts`, `classificationEngine.ts` or `PayrollMaster.tsx`.

## Why

Same defect as Payroll Master had: committing a row from Action Required
saves the two time strings but leaves `late_minutes`, `late_after_grace` and
`early_leave_minutes` stale, and derives discount and status from those stale
minutes. `src/app/lib/punchMinutes.ts` and `src/actions/updatePunchTimes.ts`
already exist; this prompt wires them in here exactly as Payroll Master does.

Timezone invariant, restated: entry/exit/schedule/grace are `H:MM AM` strings
on the row; `computePunchMinutes` compares integer minutes-since-midnight. No
`Date`, no `work_date`, no timezone conversion. Columns written: `entry_time`,
`exit_time`, `late_minutes`, `late_after_grace`, `early_leave_minutes`,
`updated_at` (via `updatePunchTimes`, on every committed row);
`discount_total_minutes`, `payroll_ready`, `status_current` (via
`updatePayrollEntry`, as today). `initial_status` is never written. The status
rule is unchanged.

## The edits in `ActionRequired.tsx`

**1. Imports.** Replace
`import updateEntryExitAction from '@/actions/updateEntryExit';` with
`import updatePunchTimesAction from '@/actions/updatePunchTimes';`
and add next to the `classificationEngine` import:
`import { computePunchMinutes } from '@/app/lib/punchMinutes';`

**2. Hook.** `const [updateTimes] = useMutateAction(updateEntryExitAction);`
becomes `const [updateTimes] = useMutateAction(updatePunchTimesAction);`

**3. `saveRow`.** It currently starts with `const edit = getEdit(row);` then
calls `computeDerivedFields({...})`. Change it to:

```ts
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
```

The old `timesChanged` local and the `if (timesChanged) await updateTimes(...)`
line are gone. The `updateEntry` call is unchanged from today.

**4. `handleBulkCommit`.** In the loop
`for (const row of toSave) { await saveRow(row); newCommitted.add(row.id); }`
only add rows that were actually saved, and tell the operator about refused
ones:

```ts
    const refused: string[] = [];
    for (const row of toSave) {
      const status = await saveRow(row);
      if (status === null) { refused.push(`${row.employee_name} ${row.work_date.slice(0, 10)}`); continue; }
      newCommitted.add(row.id);
    }
```
and after `setBulkSaving(false);` add:
```ts
    if (refused.length) window.alert(`Not committed — Entry and Exit must look like 9:05 AM:\n${refused.join('\n')}`);
```
Everything else in `handleBulkCommit` stays as it is.

**5. Live preview.** Inside `filtered.map((row, rowIndex) => {`, right after
`const dirty = isDirty(row);` add:

```ts
                  const live = dirty ? computePunchMinutes({
                    entry_time: edit.entry_time, exit_time: edit.exit_time,
                    scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
                  }) : null;
                  const lateShown = live ? live.late_minutes : row.late_minutes;
                  const earlyShown = live ? live.early_leave_minutes : row.early_leave_minutes;
```

The Late cell currently renders `row.late_minutes` in `text-red-700` when
> 0: render `lateShown`, and when `live && lateShown !== row.late_minutes`
use `text-amber-600` instead of `text-red-700`. The Early cell likewise with
`earlyShown`, amber when `live && earlyShown !== row.early_leave_minutes`,
else the existing `text-orange-600`. No other JSX changes.

**6. Delete `src/actions/updateEntryExit.ts`.** Confirm with a search that no
file in `src/` still imports it.

Then confirm every identifier used in `ActionRequired.tsx` is imported.
