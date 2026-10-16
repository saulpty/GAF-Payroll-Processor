# Employees get a Country (migration only)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Some employees are about to be added who work outside Panama. They must never enter Panama payroll.
This prompt only adds the data: one column on `employees` and two config keys. No screen changes.
Every existing employee becomes `Panama`, so nothing behaves differently after this prompt.

**Only this file may change:** one new migration,
`src/migrations/1782018000_employee_country.sql`, plus its line in `src/migrations/applied.txt`
once it has run. **No other file may be touched.** No action file, no page.

Rules:
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- The migration must be safe to run twice.

## 1. New file `src/migrations/1782018000_employee_country.sql`

The whole file:

```sql
-- Employee country (Saul, 2026-10-16). Everyone existing is Panama. Safe to run twice.
-- Payroll and PTO only load employees whose country equals config key payroll_country.
-- The Monday Directory sync fills it from the column named in monday_col_directory_country;
-- a blank Monday value means Panama.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Panama';

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES ('payroll_country', 'Panama', 'Payroll Country',
  'Only employees whose Country equals this are included in payroll and the PTO tracker. Everyone else still shows in Attendance, Activity, Disciplinary and Contracts.',
  'text', 'internal')
ON CONFLICT (key) DO NOTHING;

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES ('monday_col_directory_country', '', 'Directory: Country Column',
  'Column id of the Country column on the Panama Employee Directory board. Empty means everyone is Panama.',
  'text', 'monday_columns')
ON CONFLICT (key) DO NOTHING;

-- ROLLBACK
-- ALTER TABLE employees DROP COLUMN country;
-- DELETE FROM classification_config WHERE key IN ('payroll_country', 'monday_col_directory_country');
```

Run it. Then reply with the result of:
`SELECT country, count(*) FROM employees GROUP BY country;` (expect one row: `Panama`).
