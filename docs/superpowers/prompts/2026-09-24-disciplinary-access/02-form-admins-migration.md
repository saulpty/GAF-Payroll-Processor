# 02 (F1) — Migration: `disciplinary_admins` table + three edit-history columns

> **⚠ This prompt goes into the 'GAF Disciplinary Actions Form' app (PC3PsXDDa9), NOT the GAF Panama HR Hub. Check the project name in the builder before pasting.**

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only this one file may be created. No other file may be touched.**

- `src/migrations/1758700800_create_disciplinary_admins.sql` — NEW, content below,
  character for character. (`src/migrations/applied.txt` will be updated by UI Bakery
  when it is applied; that is expected.)

Do not edit any action, page, component, hook, util or existing migration.

## Why

- `disciplinary_admins` lists the people who may file for **every** employee and, in the
  HR Hub, edit and delete warnings. Everyone else only files for their own reports.
- `edited_at`, `edited_by`, `pdf_en_original_base64` let the Hub record who edited a
  warning and keep the first PDF. This app never writes them.

## The migration

```sql
CREATE TABLE IF NOT EXISTS disciplinary_admins (
  email TEXT PRIMARY KEY CHECK (email = lower(btrim(email))),
  name  TEXT NOT NULL
);

INSERT INTO disciplinary_admins (email, name) VALUES
  ('saul.f@vitasyahc.com', 'Saul Fallembaum'),
  ('tim.m@vitasyahc.com',  'Timothy Moore')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE disciplinary_actions
  ADD COLUMN IF NOT EXISTS edited_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_by              TEXT,
  ADD COLUMN IF NOT EXISTS pdf_en_original_base64 TEXT;
```

That is the entire content. No DROP, DELETE, TRUNCATE or UPDATE. No default, index or
trigger on the new columns. Safe to run twice.

## ⛔ Show the SQL and wait

**Do not press Execute yourself and do not auto-apply.** Write the file, show the SQL in
the confirmation step, and wait. A human reads it and presses Execute.

## Acceptance

1. One new file under `src/migrations/`; `applied.txt` records it as applied.
2. `SELECT email, name FROM disciplinary_admins ORDER BY email;` returns exactly two rows:
   `saul.f@vitasyahc.com / Saul Fallembaum`, `tim.m@vitasyahc.com / Timothy Moore`.
3. `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'disciplinary_admins'::regclass AND contype = 'c';`
   returns the `lower(btrim(email))` check. (Read-only — do not test it by inserting a row.)
4. `SELECT edited_at, edited_by, pdf_en_original_base64 FROM disciplinary_actions LIMIT 1;`
   returns three NULLs.
5. `SELECT count(*) FROM disciplinary_actions;` is the same before and after.

## Report back

List every file you created, changed or deleted, the row count from check 5, and the output
of check 2.
