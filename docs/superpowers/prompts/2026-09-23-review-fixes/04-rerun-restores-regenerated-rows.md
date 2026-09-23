# 04 — A re-run brings back a day it regenerates, instead of leaving it hidden

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only this one file may change. No other file may be touched.**

- `src/actions/upsertPayrollEntries.ts`

Do not create files. Do not touch any page, lib, other action or migration. Do not reformat the
query beyond the two lines added.

## Why

`payroll_entries` has a plain unique constraint on `(period_name, employee_id, work_date)` that
also covers soft-deleted rows. When a re-run soft-deletes a day the engine no longer produces
(`softDeleteStaleEntries`), and a later re-run produces that day again (for example after missing
Teramind data is backfilled, as happened with Saturday Sep 19), `ON CONFLICT ... DO UPDATE` writes
the fresh numbers into the old row but never clears `deleted_at`. The day then exists with correct
numbers yet is invisible in Payroll Master, Action Required and the HRK Summary, and the run log
still says it was saved. A row the engine writes must be a live row.

## The change

In the `DO UPDATE SET` list, after `status_current = EXCLUDED.status_current,` and before
`updated_at = NOW();`, add exactly these two lines:

```sql
        deleted_at = NULL,
        deleted_by = NULL,
```

Nothing else changes: the insert column list, the values, the conflict target and every other
`SET` line stay exactly as they are. Do not wrap any `{{params.…}}` in quotes.

## Acceptance

- The `DO UPDATE SET` list of `upsertPayrollEntries` contains `deleted_at = NULL` and
  `deleted_by = NULL`, and is otherwise unchanged.
- `src/actions/upsertPayrollEntries.ts` is the only file changed.
