-- Fix initial_status and status_current for non-grace employees whose Tardanza
-- was auto-resolved (pay_impact_1 = 'Unpaid (without Grace)', resolved_by IS NULL)
-- but still stored as RED from an older engine run before the auto-resolve rule
-- was active. These rows are fully resolved — no operator action needed.
-- Applies across ALL periods.

UPDATE payroll_entries pe
SET
  initial_status  = 'GREEN',
  status_current  = 'GREEN',
  payroll_ready   = 'YES',
  updated_at      = NOW()
FROM employees e
WHERE pe.employee_id = e.id
  AND e.is_grace_list = false
  AND pe.event_type_1 = 'Tardanza'
  AND pe.pay_impact_1 = 'Unpaid (without Grace)'
  AND pe.resolved_by IS NULL
  AND (pe.initial_status = 'RED' OR pe.status_current = 'RED');
