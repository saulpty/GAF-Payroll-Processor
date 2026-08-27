# Re-processing must remove the rows the engine no longer produces

Two files, and no others:

- **new** `src/actions/softDeleteStaleEntries.ts`
- `src/app/pages/ProcessPayroll.tsx` — **a protected payroll file. Saul asked
  for this change directly.** Keep the edit as small as it can be.

## Why

`upsertPayrollEntries` is `INSERT … ON CONFLICT DO UPDATE`. It never deletes.
So when the engine stops producing a row — because a schedule changed, or
because the off-day rule was corrected — the old row survives untouched, with
its discount minutes intact.

This has already cost real work. An operator spent a morning resolving rows
that a migration had deleted the day before, because the queue kept showing
them. The re-run warning had to be reworded to admit that stale rows are left
in place. This change makes the app do what the operator always assumed it did.

## 1. The new action — `src/actions/softDeleteStaleEntries.ts`

Follow the exact shape of `src/actions/upsertPayrollEntries.ts`: default-export
a function returning `action('softDeleteStaleEntries', 'SQL', { datasourceName:
'GAF Planilla DB', query: … })`.

```sql
      UPDATE payroll_entries pe
      SET deleted_at = NOW(),
          deleted_by = {{params.deleted_by}}
      WHERE pe.period_name = {{params.period_name}}
        AND pe.deleted_at IS NULL
        AND LEFT(pe.work_date, 10) BETWEEN {{params.start_date}} AND {{params.end_date}}
        AND pe.employee_id = ANY(string_to_array({{params.employee_ids}}, ',')::bigint[])
        AND (pe.employee_id || ':' || LEFT(pe.work_date, 10))
            <> ALL (string_to_array({{params.kept_keys}}, ','))
      RETURNING pe.id;
```

Five things about this SQL that must not be "tidied":

- **`LEFT(pe.work_date, 10)`.** `work_date` is stored as `2026-08-22 (Sat)`,
  not a bare date. Every existing query slices it the same way.
- **Every `{{params.x}}` sits bare**, never inside quotes. A quoted one is
  substituted whole and breaks the statement.
- **Soft delete only.** Never `DELETE FROM`. Period Log restores these rows.
- **`RETURNING pe.id`** so the caller can count what it removed.
- The predicate is a set difference against `kept_keys`, so it removes only
  rows the engine did not just produce.

## 2. Wire it up in `ProcessPayroll.tsx`

Import it alongside the other actions and add
`const [softDeleteStale] = useMutateAction(softDeleteStaleEntriesAction);`
next to the existing `useMutateAction` calls around line 105-109.

Then, **after** the upsert loop that ends around line 469 and **before** the
`if (!singleEmpMode)` period-summary block, insert:

```tsx
    // Rows the engine no longer produces must go, or they survive with their
    // discount minutes intact. Scoped to the employees this run actually
    // considered and to this period's own date range, so single-employee mode
    // cannot touch anyone else. Soft delete — Period Log can restore.
    const processedIds = singleEmpMode && singleEmpIds.length > 0
      ? singleEmpIds
      : (employees as Employee[]).map(e => e.id).filter(id => !excludedIds.includes(id));

    if (entries.length > 0 && processedIds.length > 0) {
      const keptKeys = entries.map(e => `${e.employee_id}:${e.work_date.slice(0, 10)}`).join(',');
      const stale = await softDeleteStale({
        period_name: periodName,
        start_date: startDate,
        end_date: endDate,
        employee_ids: processedIds.join(','),
        kept_keys: keptKeys,
        deleted_by: `reprocess-${periodName}`,
      });
      const removed = Array.isArray(stale) ? stale.length : 0;
      log(removed > 0
        ? `Removed ${removed} row(s) the engine no longer produces. Restore them from Period Log if needed.`
        : 'No stale rows to remove.');
    }
```

Rules for this block:

- **The `entries.length > 0` guard is not optional.** An empty `kept_keys`
  would match every row in the period and delete all of them.
- `processedIds` comes from the employees the run **considered**, not from the
  entries produced. An employee who legitimately generated zero entries this
  run must still have their stale rows cleaned up.
- Parameters are passed **flat**, exactly as written above. Do not wrap them in
  `{ params: { … } }`.
- `e.work_date.slice(0, 10)` — the keys must match the SQL's
  `LEFT(work_date, 10)` or every key misses and the delete takes the period.
- Do not use `toISOString()` anywhere. `deleted_by` carries no timestamp on
  purpose; the database stamps `deleted_at` with `NOW()`.

## 3. The re-run confirmation now has to tell the truth again

Around line 313-316 the message currently ends:

> `Rows the engine no longer generates are left in place, not removed.`

That was accurate before this change and is wrong after it. Replace that
sentence in the full-period message with wording that says rows the engine no
longer produces will be removed, and that they can be restored from Period Log.
Keep the rest of the sentence, and keep the single-employee variant's meaning
intact — it should also mention that only that person's rows are affected.

Do not change `window.confirm` to anything else in this round.

## Do not touch

- **No other file.** Not `upsertPayrollEntries.ts`, not the engine, not any
  page, not any test, not any migration.
- Do not add `deleted_at` handling to `upsertPayrollEntries` — a row an
  operator deleted by hand must stay deleted through a re-run.
- Do not change the upsert loop, the batching, the progress calculation, the
  green/yellow/red counters, the period summary, or the snapshot save.
- Do not change any filter, query or column anywhere else.

## Acceptance criteria

- The Process page loads with no console errors and the run button still works.
- A re-run for a single employee removes only that employee's stale rows and
  logs how many.
- A run that produces zero entries removes nothing at all.
- Removed rows appear in Period Log → Deleted Entries with
  `deleted_by` reading `reprocess-<period name>`, and can be restored.
- The re-run confirmation states that stale rows are removed and recoverable.

Then confirm every identifier used in each file is imported.
