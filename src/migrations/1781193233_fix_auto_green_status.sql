-- Fix rows where YELLOW/RED initial_status were incorrectly set to status_current=GREEN
-- due to pay_impact_1 being pre-filled by the engine at write time.
-- Reset status_current = initial_status and payroll_ready = 'NO' for all such rows.

UPDATE payroll_entries
SET
  status_current = initial_status,
  payroll_ready  = 'NO',
  updated_at     = NOW()
WHERE
  initial_status IN ('YELLOW', 'RED')
  AND status_current = 'GREEN'
  AND payroll_ready  = 'YES';
