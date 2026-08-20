Create and apply a new database migration named `add_leave_type_to_pto_approvals` against the `GAF Planilla DB` datasource, with exactly the SQL below. Do not change any other file.

Context: floating holidays stop being a manual counter and become leave records like PTO — a floating holiday taken is a row in `pto_approvals` with its own dates, recorded from a Monday "Floating Holiday" request or added manually. This column is what separates the two kinds of row.

```sql
-- A pto_approvals row is either ordinary PTO or a floating holiday. Everything
-- recorded before today is PTO: the Excel import and the Monday "PTO / Vacation"
-- requests were the only sources.
ALTER TABLE pto_approvals
  ADD COLUMN IF NOT EXISTS leave_type TEXT NOT NULL DEFAULT 'pto';

UPDATE pto_approvals SET leave_type = 'pto' WHERE leave_type IS NULL OR leave_type = '';

ALTER TABLE pto_approvals DROP CONSTRAINT IF EXISTS pto_approvals_leave_type_check;
ALTER TABLE pto_approvals
  ADD CONSTRAINT pto_approvals_leave_type_check CHECK (leave_type IN ('pto','floating_holiday'));

CREATE INDEX IF NOT EXISTS ix_pto_approvals_emp_type_status
  ON pto_approvals (employee_id, leave_type, status);
```

Acceptance: `SELECT leave_type, count(*) FROM pto_approvals GROUP BY 1` returns a single row, `pto` with 50. No file other than the new migration and `src/migrations/applied.txt` changed.
