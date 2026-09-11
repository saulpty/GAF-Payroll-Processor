# 04 — Payroll Master: recompute late/early minutes when a row is saved

## Files that may change

- `src/actions/updatePunchTimes.ts` (new)
- `src/app/pages/PayrollMaster.tsx`

No other file may be touched. Do not create, delete, rename or reformat
anything else. Do NOT edit `updateEntryExit.ts` (Action Required still uses
it; it is retired in a later prompt), `updatePayrollEntry.ts`,
`classificationEngine.ts` or `punchMinutes.ts`.

## Why

Editing Entry or Exit on Payroll Master saves only the two time strings.
`late_minutes`, `late_after_grace` and `early_leave_minutes` keep their old
values, and `computeDerivedFields` then derives the discount and status from
those stale minutes. `src/app/lib/punchMinutes.ts` (already in the project)
holds the engine's formula as a pure function; this prompt wires it in.

Timezone invariant, restated: entry/exit/schedule/grace are `H:MM AM` strings
already on the row; `computePunchMinutes` turns them into integer
minutes-since-midnight and compares integers. No `Date`, no `work_date`, no
timezone conversion. Columns written by this change, and only these:
`entry_time`, `exit_time`, `late_minutes`, `late_after_grace`,
`early_leave_minutes`, `updated_at` (new action, on every single-row save);
`discount_total_minutes`, `payroll_ready`, `status_current` (existing
`updatePayrollEntry`, as today). `initial_status` is never written. The
status rule is unchanged: a RED/YELLOW row turns GREEN only when an event and
its pay impact are picked.

## Part 1 — create `src/actions/updatePunchTimes.ts` exactly

```ts
import { action } from '@uibakery/data';

function updatePunchTimes() {
  return action('updatePunchTimes', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE payroll_entries SET
        entry_time = {{params.entry_time}},
        exit_time = {{params.exit_time}},
        late_minutes = {{params.late_minutes}}::int,
        late_after_grace = {{params.late_after_grace}}::int,
        early_leave_minutes = {{params.early_leave_minutes}}::int,
        updated_at = NOW()
      WHERE id = {{params.id}}::bigint;
    `,
  });
}

export default updatePunchTimes;
```

## Part 2 — `src/app/pages/PayrollMaster.tsx`, five small edits

**2a. Imports.** Replace
`import updateEntryExitAction from '@/actions/updateEntryExit';` with
`import updatePunchTimesAction from '@/actions/updatePunchTimes';`
and add, next to the `classificationEngine` import:
`import { computePunchMinutes } from '@/app/lib/punchMinutes';`

**2b. Hook.** `const [updateTimes] = useMutateAction(updateEntryExitAction);`
becomes `const [updateTimes] = useMutateAction(updatePunchTimesAction);`

**2c. `handleSave`.** Immediately after the line `if (!fieldsDirty) return;`
insert:

```ts
    // Minutes are recomputed from the row's punches on every save, so a row
    // whose stored minutes are stale is corrected by any save.
    const mins = computePunchMinutes({
      entry_time: edit.entry_time, exit_time: edit.exit_time,
      scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
    });
    if (!mins) {
      setToastMsg(`⚠ ${row.employee_name} — ${row.work_date.slice(0, 10)}: Entry and Exit must look like 9:05 AM. Not saved.`);
      setTimeout(() => setToastMsg(''), 4000);
      return;
    }
```

In the existing `computeDerivedFields({ ... })` call in `handleSave`, replace
the three lines
`late_minutes: row.late_minutes,` / `late_after_grace: row.late_after_grace,` /
`early_leave_minutes: row.early_leave_minutes,` with
`late_minutes: mins.late_minutes,` / `late_after_grace: mins.late_after_grace,` /
`early_leave_minutes: mins.early_leave_minutes,`.

Replace the block
```ts
    if (timesChanged) {
      await updateTimes({ id: row.id, entry_time: edit.entry_time || null, exit_time: edit.exit_time || null });
    }
```
with
```ts
    await updateTimes({
      id: row.id,
      entry_time: edit.entry_time || null, exit_time: edit.exit_time || null,
      late_minutes: mins.late_minutes, late_after_grace: mins.late_after_grace, early_leave_minutes: mins.early_leave_minutes,
    });
```
`timesChanged` is still used by `fieldsDirty`; leave that as is. Leave
`handleBulkSave` and `handleUndo` untouched — they do not change times.

**2d. Toast colour.** The toast `div` has the class string starting
`fixed top-4 right-4 z-50 bg-green-700 ...`. Make the background conditional:
`bg-green-700` becomes `${toastMsg.startsWith('⚠') ? 'bg-amber-600' : 'bg-green-700'}`.
Nothing else in the toast changes.

**2e. Live preview in the row.** Inside `filtered.map(row => { ... })`, right
after the line `const saved = savedIds.has(row.id);` add:

```ts
                  const live = dirty ? computePunchMinutes({
                    entry_time: edit.entry_time, exit_time: edit.exit_time,
                    scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
                  }) : null;
                  const lateShown = live ? live.late_minutes : row.late_minutes;
                  const earlyShown = live ? live.early_leave_minutes : row.early_leave_minutes;
```

Then:

- The Late cell currently renders `row.late_minutes` in red when > 0.
  Render `lateShown` instead; when `live && lateShown !== row.late_minutes`
  use `text-amber-600` in place of `text-red-700` so a changed preview reads
  amber, exactly like the Discount preview already does.
- The Early cell likewise: render `earlyShown`; amber when
  `live && earlyShown !== row.early_leave_minutes`, else the existing
  `text-orange-600`.
- In the `computeDiscount({ ... })` call of the Discount preview, replace
  `late_minutes: row.late_minutes,` / `late_after_grace: row.late_after_grace,` /
  `early_leave_minutes: row.early_leave_minutes,` with
  `late_minutes: live ? live.late_minutes : row.late_minutes,` /
  `late_after_grace: live ? live.late_after_grace : row.late_after_grace,` /
  `early_leave_minutes: live ? live.early_leave_minutes : row.early_leave_minutes,`.

No JSX structure, class, column or width changes beyond the ones named.

Then confirm every identifier used in each file is imported.
