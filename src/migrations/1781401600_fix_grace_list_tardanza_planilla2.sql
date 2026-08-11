-- Fix grace-list Tardanza entries in "Planilla 2 Junio 2026 11-19" that were
-- incorrectly stored with pay_impact_1 = 'Unpaid (without Grace)' and status RED.
-- These rows were generated before the grace logic was corrected in the engine.
--
-- Correct rules (grace-list employees, no TFT):
--   (A) Form filed + late <= grace_minutes  → Paid (Grace),        GREEN, discount = 0
--   (B) Form filed + late >  grace_minutes  → Unpaid (with Grace), GREEN, discount = late_after_grace
--   (C) No form filed                       → Unpaid (without Grace), GREEN, discount = late_minutes
--
-- Only touches resolved_by IS NULL entries (not operator-overridden).

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
    ge.grace_minutes,
    -- Determine correct case
    CASE
      WHEN (pe.documentation = 'Form Submitted') AND pe.late_minutes <= ge.grace_minutes THEN 'A'
      WHEN (pe.documentation = 'Form Submitted') AND pe.late_minutes >  ge.grace_minutes THEN 'B'
      ELSE 'C'
    END AS rule_case
  FROM payroll_entries pe
  JOIN grace_emps ge ON ge.employee_id = pe.employee_id
  WHERE pe.period_name = 'Planilla 2 Junio 2026 11-19'
    AND pe.event_type_1 = 'Tardanza'
    AND pe.resolved_by IS NULL
    AND pe.late_minutes > 0
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
