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
