-- One-off data repair for Q2-Aug-2026 only.
--
-- After the schedules-aware v_attendance_daily view (migration 1781900100) was
-- deployed, employees on non-standard schedules (e.g. Wed-Sun) were found to
-- have phantom "Ausencia Injustificada" rows on their legitimate off-days.
-- These rows have no clock-in, were auto-classified by the engine, and were
-- never reviewed by an operator.  They inflate Discount Hours in the HRK export.
--
-- This migration soft-deletes exactly those 18 rows.  The DO block counts them
-- first and aborts if the count differs, making it safe to re-run and
-- self-documenting about its own assumptions.
--
-- Rollback: restore the rows from Period Log (set deleted_at = NULL, deleted_by = NULL).
-- Upstream: loadHrkSummary already filters deleted_at IS NULL (migration landed same day).

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
  FROM payroll_entries pe
  JOIN employees e ON e.id = pe.employee_id
  LEFT JOIN schedules s ON s.id = e.schedule_id
  WHERE pe.period_name = 'Q2-Aug-2026'
    AND pe.deleted_at IS NULL
    AND NULLIF(TRIM(pe.entry_time), '') IS NULL
    AND NULLIF(TRIM(pe.exit_time), '')  IS NULL
    AND pe.event_type_1 = 'Ausencia Injustificada'
    AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
          [EXTRACT(ISODOW FROM LEFT(pe.work_date, 10)::date)::int]
        <> ALL (string_to_array(
              COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri'), ','));

  IF n <> 18 THEN
    RAISE EXCEPTION 'Expected exactly 18 phantom off-day rows in Q2-Aug-2026, found %. Aborting without changes.', n;
  END IF;

  UPDATE payroll_entries pe
  SET deleted_at = NOW(),
      deleted_by = 'migration-1781900200-weekend-offday-cleanup'
  FROM employees e
  LEFT JOIN schedules s ON s.id = e.schedule_id
  WHERE e.id = pe.employee_id
    AND pe.period_name = 'Q2-Aug-2026'
    AND pe.deleted_at IS NULL
    AND NULLIF(TRIM(pe.entry_time), '') IS NULL
    AND NULLIF(TRIM(pe.exit_time), '')  IS NULL
    AND pe.event_type_1 = 'Ausencia Injustificada'
    AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
          [EXTRACT(ISODOW FROM LEFT(pe.work_date, 10)::date)::int]
        <> ALL (string_to_array(
              COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri'), ','));

  RAISE NOTICE 'Soft-deleted % phantom off-day rows in Q2-Aug-2026.', n;
END $$;
