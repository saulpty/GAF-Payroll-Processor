-- REVERT the erroneous +1hr shift applied by migration 1781401100 to
-- "Test Period May 25th - Jun 10th" and "Planilla 2 Junio 2026 11-19".
-- Those periods were already stored in US Eastern time by the Teramind parser;
-- adding +1hr was wrong. This migration subtracts 1hr from entry_time and
-- exit_time and recomputes all derived fields (late_minutes, late_after_grace,
-- early_leave_minutes, discount_total_minutes, initial_status, status_current,
-- auto_notes).
-- Operator-resolved entries (resolved_by IS NOT NULL) are left untouched.
-- Entries with special notes (outage, macbook swap, weekend) are also skipped.

WITH affected AS (
  SELECT
    pe.id,
    pe.entry_time,
    pe.exit_time,
    pe.scheduled_start,
    pe.scheduled_end,
    pe.resolved_by,
    pe.auto_notes,
    pe.initial_status,
    pe.status_current,
    s.grace_minutes,
    e.is_grace_list,
    -- Parse entry_time and SUBTRACT 1 hour
    (
      to_timestamp(
        REGEXP_REPLACE(UPPER(TRIM(pe.entry_time)), '^([0-9]{1,2})([AP]M)$', '\1:00 \2'),
        'HH12:MI AM'
      )::time - interval '1 hour'
    ) AS new_entry_t,
    -- Parse exit_time and SUBTRACT 1 hour
    (
      to_timestamp(
        REGEXP_REPLACE(UPPER(TRIM(pe.exit_time)), '^([0-9]{1,2})([AP]M)$', '\1:00 \2'),
        'HH12:MI AM'
      )::time - interval '1 hour'
    ) AS new_exit_t,
    -- Parse scheduled_start
    to_timestamp(
      REGEXP_REPLACE(UPPER(TRIM(pe.scheduled_start)), '^([0-9]{1,2})([AP]M)$', '\1:00 \2'),
      'HH12:MI AM'
    )::time AS sched_start_t,
    -- Parse scheduled_end
    to_timestamp(
      REGEXP_REPLACE(UPPER(TRIM(pe.scheduled_end)), '^([0-9]{1,2})([AP]M)$', '\1:00 \2'),
      'HH12:MI AM'
    )::time AS sched_end_t
  FROM payroll_entries pe
  JOIN employees e ON e.id = pe.employee_id
  JOIN schedules s ON s.id = e.schedule_id
  WHERE pe.period_name IN ('Test Period May 25th - Jun 10th', 'Planilla 2 Junio 2026 11-19')
    AND pe.entry_time IS NOT NULL
    AND TRIM(pe.entry_time) != ''
    AND pe.auto_notes NOT LIKE '%Macbook swap%'
    AND pe.auto_notes NOT LIKE '%Teramind outage%'
    AND pe.auto_notes NOT LIKE '%Weekend activity%'
    AND pe.resolved_by IS NULL
),
computed AS (
  SELECT
    a.id,
    TRIM(TO_CHAR(a.new_entry_t, 'FMHH12:MI AM')) AS new_entry_time,
    TRIM(TO_CHAR(a.new_exit_t,  'FMHH12:MI AM')) AS new_exit_time,
    GREATEST(0, EXTRACT(EPOCH FROM (a.new_entry_t - a.sched_start_t))::int / 60) AS new_late_minutes,
    GREATEST(0, EXTRACT(EPOCH FROM (a.sched_end_t - a.new_exit_t))::int / 60)    AS new_early_leave_minutes,
    a.grace_minutes,
    a.is_grace_list,
    a.initial_status,
    a.status_current,
    a.auto_notes
  FROM affected a
),
with_grace AS (
  SELECT
    c.*,
    GREATEST(0, c.new_late_minutes - c.grace_minutes) AS new_late_after_grace
  FROM computed c
)
UPDATE payroll_entries pe
SET
  entry_time             = wg.new_entry_time,
  exit_time              = wg.new_exit_time,
  late_minutes           = wg.new_late_minutes,
  late_after_grace       = wg.new_late_after_grace,
  early_leave_minutes    = wg.new_early_leave_minutes,
  discount_total_minutes = GREATEST(wg.new_late_minutes, 0) + GREATEST(wg.new_early_leave_minutes, 0),
  initial_status = CASE
    WHEN wg.new_late_minutes = 0 AND wg.new_early_leave_minutes = 0 THEN 'GREEN'
    WHEN wg.new_late_minutes > 0 OR  wg.new_early_leave_minutes > 0 THEN 'RED'
    ELSE wg.initial_status
  END,
  status_current = CASE
    WHEN wg.new_late_minutes = 0 AND wg.new_early_leave_minutes = 0 THEN 'GREEN'
    WHEN wg.new_late_minutes > 0 OR  wg.new_early_leave_minutes > 0 THEN 'RED'
    ELSE wg.status_current
  END,
  auto_notes = CASE
    WHEN wg.new_late_minutes = 0 AND wg.new_early_leave_minutes = 0
      THEN 'On time, full shift.'
    WHEN wg.new_late_minutes = 0 AND wg.new_early_leave_minutes > 0
      THEN 'Early leave ' || wg.new_early_leave_minutes || ' min. Assign pay impact.'
    WHEN wg.new_late_minutes > 0 AND wg.is_grace_list AND wg.new_late_after_grace = 0
      THEN 'Late ' || wg.new_late_minutes || ' min. Within grace. Form filed.'
    WHEN wg.new_late_minutes > 0
      THEN 'Late ' || wg.new_late_minutes || ' min. No form. Auto-resolved: Unpaid (without Grace).'
    ELSE wg.auto_notes
  END,
  updated_at = NOW()
FROM with_grace wg
WHERE pe.id = wg.id;
