# Delete the four Timothy Moore test rows

> **⚠ This prompt goes into the "GAF Disciplinary Actions Form" app, NOT the
> GAF HR Hub.** Check the project name in the builder before pasting. This app
> owns `disciplinary_actions`.

**Create exactly one new file: a migration under `src/migrations/`, named
`<timestamp>_delete_timothy_moore_test_rows.sql`.**

**No other file may be created, modified or deleted.** Do not touch
`src/actions/`, any page, any component, `src/app/utils/disciplinaryFormData.ts`,
or any existing migration. Do not change the form, the wizard or the PDF
generation.

## Why

The owner created four disciplinary actions against **Timothy Moore** while
testing the form, and has asked for them to be removed. They are not real
records. Two things confirm it beyond his word: he filed them under his own
name, and the narrative text in them is about a different person — one row's
*what happened* reads *"She only did 43 calls on may 23…"* on a record about the
Jr Operations Manager.

Their content was captured first and is recorded in the Hub's repo at
`docs/findings/2026-09-07-timothy-moore-test-rows-deleted.md`, so they can be
re-entered if one turns out to matter.

## The migration

```sql
-- Four disciplinary actions created while testing the form, filed by the owner
-- against Timothy Moore. Content captured before deletion; see the HR Hub repo,
-- docs/findings/2026-09-07-timothy-moore-test-rows-deleted.md
DELETE FROM disciplinary_actions
WHERE id IN (12, 13, 14, 17)
  AND employee_name = 'Timothy Moore';
```

That is the entire content.

**Both conditions are required.** The ids are what identify the rows, and the
`employee_name` check makes the statement refuse to do anything unexpected if
ids have shifted — a delete that matches nothing is far better than one that
matches the wrong four rows. Do not "simplify" it to `WHERE employee_name =
'Timothy Moore'` alone, and do not drop the name check.

The four rows, for reference:

| id | ref | document_date | warning_level |
|---|---|---|---|
| 12 | GAF-DA-2026-5763 | 2026-07-01 | Verbal Warning |
| 13 | GAF-DA-2026-7033 | 2026-07-01 | First Written Warning |
| 14 | GAF-DA-2026-9269 | 2026-07-01 | Second Written Warning |
| 17 | GAF-DA-2026-5106 | 2026-07-09 | Verbal Warning |

## Do not touch anything else

- **No other employee's rows may be affected.** Nine other people have records.
- Do not add a `TRUNCATE`, a `DROP`, or a delete on any other table.
- Do not alter the three closure columns added earlier today.
- No UI in this app changes.

## Acceptance — report each of these numbers

1. Exactly one new file under `src/migrations/`, recorded in `applied.txt`.
2. `SELECT count(*) FROM disciplinary_actions;` returns **12** (was 16).
3. `SELECT count(*) FROM disciplinary_actions WHERE employee_name = 'Timothy Moore';`
   returns **0**.
4. `SELECT count(DISTINCT employee_name) FROM disciplinary_actions;` returns
   **9** (was 10).
5. `SELECT count(*) FROM disciplinary_actions WHERE employee_name = 'Juan Molina';`
   still returns **3** — proving no other employee was caught.
6. The form still loads and submits.

Report all five numbers.
