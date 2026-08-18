Create and apply a new database migration named `revive_pto_tables` against `GAF Planilla DB` with exactly the SQL below. These three tables were created by migration 1781402200 and have never been used; this brings them into use. Do not change any other file.

```sql
-- pto_approvals: the PTO ledger. Monday submissions are pending until recorded.
ALTER TABLE pto_approvals
  ADD COLUMN IF NOT EXISTS monday_item_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS recorded_by   TEXT NULL,
  ADD COLUMN IF NOT EXISTS recorded_at   TIMESTAMPTZ NULL;
ALTER TABLE pto_approvals ALTER COLUMN total_days TYPE NUMERIC(5,2);
UPDATE pto_approvals SET status = 'recorded' WHERE status = 'approved';
ALTER TABLE pto_approvals ALTER COLUMN status SET DEFAULT 'recorded';
ALTER TABLE pto_approvals DROP CONSTRAINT IF EXISTS pto_approvals_status_check;
ALTER TABLE pto_approvals ADD CONSTRAINT pto_approvals_status_check CHECK (status IN ('pending','recorded','withdrawn'));
ALTER TABLE pto_approvals DROP CONSTRAINT IF EXISTS pto_approvals_source_check;
ALTER TABLE pto_approvals ADD CONSTRAINT pto_approvals_source_check CHECK (source IN ('monday','excel_import','manual'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_pto_approvals_monday_item ON pto_approvals (monday_item_id) WHERE monday_item_id IS NOT NULL;
ALTER TABLE pto_approvals DROP CONSTRAINT IF EXISTS fk_pto_approvals_monday_item;
ALTER TABLE pto_approvals ADD CONSTRAINT fk_pto_approvals_monday_item
  FOREIGN KEY (monday_item_id) REFERENCES monday_requests(monday_item_id) ON DELETE SET NULL;

-- pto_employees: manual per-employee facts.
ALTER TABLE pto_employees RENAME COLUMN paid_pto_cap TO paid_pto_days;
ALTER TABLE pto_employees ALTER COLUMN paid_pto_days SET DEFAULT 0;
ALTER TABLE pto_employees ADD COLUMN IF NOT EXISTS pto_start_date_override DATE NULL;
```

Acceptance: `SELECT column_name FROM information_schema.columns WHERE table_name='pto_approvals' ORDER BY ordinal_position` includes monday_item_id, source, recorded_by, recorded_at; `pto_employees` has paid_pto_days and pto_start_date_override and no paid_pto_cap. No other file changed.
