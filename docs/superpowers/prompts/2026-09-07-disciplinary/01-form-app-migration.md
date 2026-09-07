# Add three closure columns to `disciplinary_actions`

> **⚠ This prompt goes into the "GAF Disciplinary Actions Form" app, NOT the
> GAF HR Hub.** It is the only prompt in this folder that does. Check the
> project name in the builder before pasting. Pasting it into the Hub would
> write a migration against the wrong database.

**Create exactly one new file: a migration under `src/migrations/`, named
`<timestamp>_add_closure_columns_disciplinary_actions.sql`.**

**No other file may be created, modified or deleted.** Do not touch
`src/actions/`, any page, any component, `src/app/utils/disciplinaryFormData.ts`,
or any existing migration. Do not change the form, the wizard, the PDF
generation, or `getPriorActions`.

## Why

A second application — the GAF HR Hub — is gaining a read-only viewer for these
disciplinary actions. It needs to record that a case has been **closed**: the
employee improved, the follow-up happened, the matter is finished.

Today closure is recorded only in email, so a case that resolved well and one
that was forgotten look identical in the database.

The three columns belong on this table because this app owns it. Storing them
anywhere else would split one fact across two databases and leave this app
unable to ever show that a case was closed.

## The migration

```sql
ALTER TABLE disciplinary_actions
  ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by    TEXT,
  ADD COLUMN IF NOT EXISTS closure_note TEXT;
```

That is the entire content. Do not add a default, a NOT NULL, a CHECK
constraint, an index, or a trigger.

- `closed_at` **NULL means the case is open.** There is deliberately no boolean
  flag, so it is impossible to have "closed" without a date.
- `closed_by` is a free-text person's name, not a foreign key — the Hub has no
  user accounts yet.
- `closure_note` is why it was closed, e.g. *"Employee improved; follow-up sent
  by email 07-10-2026."*

`ADD COLUMN IF NOT EXISTS` makes it safe to run twice.

## Do not change any behaviour of this app

The columns are additive and this app must not start reading or writing them.
In particular:

- **`src/actions/getPriorActions.ts` must not change.** It selects an explicit
  column list, so the new columns simply do not appear — which is correct. A
  closed warning is still prior history and must keep showing in the panel.
- `src/actions/saveSubmission.ts` must not change. A newly filed action is open
  by definition, and `closed_at` defaults to NULL on its own.
- No UI anywhere in this app should display or set closure. That is the Hub's
  job.

## Acceptance — observable outcomes

1. Exactly one new file exists under `src/migrations/`, and
   `src/migrations/applied.txt` records it as applied.
2. `SELECT closed_at, closed_by, closure_note FROM disciplinary_actions LIMIT 1;`
   runs without error and returns three NULLs.
3. `SELECT count(*) FROM disciplinary_actions WHERE closed_at IS NOT NULL;`
   returns **0** — the migration must not close anything.
4. `SELECT count(*) FROM disciplinary_actions;` returns the same number as
   before the migration. No row was added, removed or altered.
5. The form still submits end to end, and the prior-actions panel still lists
   an employee's previous actions exactly as before.

Report the row count from step 4 and the list of columns on the table when you
are done.
