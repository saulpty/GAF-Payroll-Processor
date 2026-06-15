-- Reclassify existing payroll entries per updated tardiness rules:
--
-- Rule 1: Non-grace-list employees with Tardanza + unresolved pay impact
--         → auto-resolve to Unpaid (without Grace), GREEN, payroll_ready=YES
--
-- Rule 2: TFT employees with Tardanza + late > 30 min
--         → escalate to RED, clear pay_impact_1 for operator review

-- Rule 1: non-grace, Tardanza, blank/generic unpaid impacts → Unpaid (without Grace) + GREEN
UPDATE payroll_entries pe
SET
  event_type_1       = 'Tardanza',
  pay_impact_1       = 'Unpaid (without Grace)',
  initial_status     = 'GREEN',
  status_current     = 'GREEN',
  payroll_ready      = 'YES',
  discount_total_minutes = pe.late_minutes,
  auto_notes         = pe.auto_notes || ' [Reclassified: Unpaid (without Grace) auto-applied]'
FROM employees e
WHERE pe.employee_id = e.id
  AND e.is_grace_list = FALSE
  AND pe.event_type_1 = 'Tardanza'
  AND pe.payroll_ready = 'NO'
  AND pe.pay_impact_1 IN ('', 'Unpaid', 'Unpaid (with Grace)', 'Unpaid (without Grace)');

-- Rule 2: TFT + late > 30 min → RED, clear impact for operator
UPDATE payroll_entries pe
SET
  pay_impact_1   = '',
  initial_status = 'RED',
  status_current = 'RED',
  payroll_ready  = 'NO',
  auto_notes     = pe.auto_notes || ' [Reclassified: TFT + late >30 min → RED for review]'
FROM employees e
WHERE pe.employee_id = e.id
  AND pe.event_type_1 = 'Tardanza'
  AND pe.payroll_ready = 'NO'
  AND pe.late_minutes > 30
  AND pe.pay_impact_1 = 'Paid via Time-for-Time';

-- Also update period summary counts to reflect new statuses
UPDATE periods p
SET
  green_count  = sub.green_count,
  yellow_count = sub.yellow_count,
  red_count    = sub.red_count
FROM (
  SELECT
    period_name,
    COUNT(*) FILTER (WHERE initial_status = 'GREEN')  AS green_count,
    COUNT(*) FILTER (WHERE initial_status = 'YELLOW') AS yellow_count,
    COUNT(*) FILTER (WHERE initial_status = 'RED')    AS red_count
  FROM payroll_entries
  GROUP BY period_name
) sub
WHERE p.period_name = sub.period_name;
