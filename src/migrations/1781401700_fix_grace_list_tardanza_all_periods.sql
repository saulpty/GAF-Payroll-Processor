-- Fix grace-list Tardanza entries across ALL periods that still have wrong
-- pay_impact, wrong status, or wrong discount. Migration 1781401600 only covered
-- Planilla 2 Junio — this covers Test Period and any other affected period.
--
-- Rules applied (grace-list employees, no TFT, resolved_by IS NULL):
--   (A) auto_notes says "Within grace" OR (form filed + late <= grace_minutes)
--       → Paid (Grace), GREEN, discount = 0
--   (B) Form filed + late > grace_minutes
--       → Unpaid (with Grace), GREEN, discount = late_after_grace
--   (C) No form filed + auto-resolved (pay_impact already set)
--       → Unpaid (without Grace), GREEN, discount = late_minutes
--
-- Skips operator-resolved rows (resolved_by IS NOT NULL) and TFT rows.

WITH grace_emps AS (
  SELECT e.id AS employee_id, s.grace_minutes
  FROM employees e
  JOIN schedules s ON s.id = e.schedule_id
  WHERE e.is_grace_list = true
),
to_fix AS (
  SELECT
    pe.id,
    pe.late_minutes,
    pe.late_after_grace,
    pe.documentation,
    pe.auto_notes,
    ge.grace_minutes,
    CASE
      -- "Within grace" in auto_notes = was computed as within grace at classification time
      WHEN pe.auto_notes ILIKE '%within grace%' THEN 'A'
      WHEN (pe.documentation = 'Form Submitted') AND pe.late_minutes <= ge.grace_minutes THEN 'A'
      WHEN (pe.documentation = 'Form Submitted') AND pe.late_minutes > ge.grace_minutes THEN 'B'
      ELSE 'C'
    END AS rule_case
  FROM payroll_entries pe
  JOIN grace_emps ge ON ge.employee_id = pe.employee_id
  WHERE pe.event_type_1 = 'Tardanza'
    AND pe.resolved_by IS NULL
    AND pe.late_minutes > 0
    AND pe.auto_notes NOT ILIKE '%tft%'
    AND pe.auto_notes NOT ILIKE '%time for time%'
    -- Only fix rows that are wrong: RED status, or wrong pay_impact given the rule
    AND (
      pe.initial_status = 'RED'
      OR pe.status_current = 'RED'
      OR (pe.auto_notes ILIKE '%within grace%' AND pe.pay_impact_1 != 'Paid (Grace)')
      OR (pe.documentation = 'Form Submitted' AND pe.late_minutes > ge.grace_minutes AND pe.pay_impact_1 NOT IN ('Unpaid (with Grace)', 'Paid via Time-for-Time'))
    )
)
UPDATE payroll_entries pe
SET
  pay_impact_1 = CASE
    WHEN tf.rule_case = 'A' THEN 'Paid (Grace)'
    WHEN tf.rule_case = 'B' THEN 'Unpaid (with Grace)'
    ELSE 'Unpaid (without Grace)'
  END,
  initial_status = 'GREEN',
  status_current = 'GREEN',
  payroll_ready  = 'YES',
  discount_total_minutes = CASE
    WHEN tf.rule_case = 'A' THEN 0
    WHEN tf.rule_case = 'B' THEN tf.late_after_grace
    ELSE tf.late_minutes
  END,
  auto_notes = CASE
    WHEN tf.rule_case = 'A' THEN
      'Late ' || tf.late_minutes || ' min, within grace (' || tf.grace_minutes || ' min), form filed. Auto-resolved: Paid (Grace).'
    WHEN tf.rule_case = 'B' THEN
      'Late ' || tf.late_minutes || ' min (' || tf.late_after_grace || ' after grace). Form filed. Auto-resolved: Unpaid (with Grace).'
    ELSE
      'Late ' || tf.late_minutes || ' min. No form. Auto-resolved: Unpaid (without Grace).'
  END,
  updated_at = NOW()
FROM to_fix tf
WHERE pe.id = tf.id;
