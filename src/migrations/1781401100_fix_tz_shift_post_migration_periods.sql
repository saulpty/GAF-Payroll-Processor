-- Fix 1-hour timezone shift in payroll entries for periods run after the
-- history_panama_to_eastern migration (2026-06-17) but before the parser fix.
-- Affected periods: "Test Period May 25th - Jun 10th" and "Planilla 2 Junio 2026 11-19".
-- These were processed with a cellDates:true SheetJS bug that read Teramind times
-- 1 hour behind Eastern. We add +1hr to entry_time and exit_time, then recompute
-- late/early minutes and auto-resolved statuses.
-- Operator-resolved entries (resolved_by IS NOT NULL) are NOT touched.

-- Helper: parse "H:MM AM/PM" to minutes since midnight
-- Helper: format minutes since midnight back to "H:MM AM"
-- We do this entirely in SQL using interval arithmetic.

WITH affected AS (
  SELECT
    pe.id,
    pe.entry_time,
    pe.exit_time,
    pe.scheduled_start,
    pe.scheduled_end,
    pe.grace_until,
    pe.auto_notes,
    pe.initial_status,
    pe.status_current,
    pe.resolved_by,
    s.grace_minutes,
    e.is_grace_list,
    -- Parse entry_time to time, add 1 hour
    (
      to_timestamp(
        REGEXP_REPLACE(UPPER(TRIM(pe.entry_time)), '^([0-9]{1,2})([AP]M)$', '\1:00 \2'),
        'HH12:MI AM'
      )::time + interval '1 hour'
    ) AS new_entry_t,
    -- Parse exit_time to time, add 1 hour
    (
      to_timestamp(
        REGEXP_REPLACE(UPPER(TRIM(pe.exit_time)), '^([0-9]{1,2})([AP]M)$', '\1:00 \2'),
        'HH12:MI AM'
      )::time + interval '1 hour'
    ) AS new_exit_t,
    -- Parse scheduled_start to time
    to_timestamp(
      REGEXP_REPLACE(UPPER(TRIM(pe.scheduled_start)), '^([0-9]{1,2})([AP]M)$', '\1:00 \2'),
      'HH12:MI AM'
    )::time AS sched_start_t,
    -- Parse scheduled_end to time
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
    AND pe.resolved_by IS NULL  -- don't touch operator-resolved entries
),
computed AS (
  SELECT
    a.id,
    -- Format new entry_time as "H:MM AM"
    TRIM(TO_CHAR(a.new_entry_t, 'FMHH12:MI AM')) AS new_entry_time,
    -- Format new exit_time as "H:MM AM"
    TRIM(TO_CHAR(a.new_exit_t, 'FMHH12:MI AM')) AS new_exit_time,
    -- late_minutes = max(0, new_entry - sched_start) in minutes
    GREATEST(0, EXTRACT(EPOCH FROM (a.new_entry_t - a.sched_start_t))::int / 60) AS new_late_minutes,
    -- early_leave_minutes = max(0, sched_end - new_exit) in minutes
    GREATEST(0, EXTRACT(EPOCH FROM (a.sched_end_t - a.new_exit_t))::int / 60) AS new_early_leave_minutes,
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
  entry_time          = wg.new_entry_time,
  exit_time           = wg.new_exit_time,
  late_minutes        = wg.new_late_minutes,
  late_after_grace    = wg.new_late_after_grace,
  early_leave_minutes = wg.new_early_leave_minutes,
  discount_total_minutes = GREATEST(wg.new_late_minutes, 0) + GREATEST(wg.new_early_leave_minutes, 0),
  -- Recompute initial_status: GREEN if was auto-resolved, preserve RED/YELLOW if complex
  initial_status = CASE
    WHEN wg.new_late_minutes = 0 AND wg.new_early_leave_minutes = 0 THEN 'GREEN'
    WHEN wg.new_late_minutes > 0 OR wg.new_early_leave_minutes > 0 THEN
      CASE WHEN wg.initial_status = 'RED' THEN 'RED' ELSE 'GREEN' END
    ELSE wg.initial_status
  END,
  status_current = CASE
    WHEN wg.new_late_minutes = 0 AND wg.new_early_leave_minutes = 0 THEN 'GREEN'
    WHEN wg.new_late_minutes > 0 OR wg.new_early_leave_minutes > 0 THEN
      CASE WHEN wg.status_current = 'RED' THEN 'RED' ELSE 'GREEN' END
    ELSE wg.status_current
  END,
  auto_notes = CASE
    WHEN wg.new_late_minutes = 0 AND wg.new_early_leave_minutes = 0 THEN 'On time, full shift.'
    WHEN wg.new_late_minutes = 0 AND wg.new_early_leave_minutes > 0 THEN
      'Early leave ' || wg.new_early_leave_minutes || ' min. Assign pay impact.'
    ELSE wg.auto_notes  -- keep existing note for late entries, times are corrected
  END,
  updated_at = NOW()
FROM with_grace wg
WHERE pe.id = wg.id;
