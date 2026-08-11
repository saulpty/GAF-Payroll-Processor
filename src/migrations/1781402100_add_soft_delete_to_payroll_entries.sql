-- Add soft-delete columns to payroll_entries
ALTER TABLE payroll_entries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_entries_deleted_at ON payroll_entries (deleted_at);
