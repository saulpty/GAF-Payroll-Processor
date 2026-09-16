# Add soft-delete columns to `disciplinary_actions`; hide deleted actions from prior warnings

> **⚠ This prompt goes into the "GAF Disciplinary Actions Form" app, NOT the
> GAF Panama HR Hub.** Check the project name in the builder before pasting.
> This app owns the `disciplinary_actions` table.

**Change exactly two things:**

1. **Create one new migration** under `src/migrations/`, named
   `<timestamp>_add_deleted_columns_disciplinary_actions.sql`.
2. **Edit `src/actions/getPriorActions.ts`** so it skips deleted actions.

**No other file may be created, modified or deleted.** Do not touch
`src/actions/saveSubmission.ts`, the form, the wizard, the PDF generation, or
any existing migration.

## Why

The GAF Panama HR Hub is gaining a **Delete** for super users, for actions filed
by mistake or twice. It is a soft delete: the row stays, it is marked deleted
with who and why, and it can be restored. A deleted action must no longer count
as a prior warning when a manager files the next one.

## 1. The migration

```sql
ALTER TABLE disciplinary_actions
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by    TEXT,
  ADD COLUMN IF NOT EXISTS deletion_note TEXT;
```

That is the entire content. No default, NOT NULL, CHECK, index, or trigger.
`deleted_at` NULL means the action is not deleted.

## 2. `getPriorActions.ts`

Add `deleted_at IS NULL` to its `WHERE` clause with `AND`, so deleted actions
are left out. Do not change the selected columns, the ordering, the parameters,
or anything else in the file. Closed actions must keep showing, exactly as today.

## Acceptance

1. One new migration file exists and `src/migrations/applied.txt` records it.
2. `SELECT deleted_at, deleted_by, deletion_note FROM disciplinary_actions LIMIT 1;`
   returns three NULLs.
3. `SELECT count(*) FROM disciplinary_actions WHERE deleted_at IS NOT NULL;` is **0**,
   and the total row count is unchanged.
4. The only change in `getPriorActions.ts` is the added `deleted_at IS NULL` condition.

Report the total row count and the final `getPriorActions.ts` query.
