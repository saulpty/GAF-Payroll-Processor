-- 1781986600_soft_delete_offday_rows_q2_aug_2026.sql
--
-- One-off data repair for Q2-Aug-2026 only.
--
-- The engine wrote phantom rows on Saturdays and Sundays for Mon–Fri employees
-- whose permission date ranges spanned a weekend.  It matched the permission's
-- date range with permissionCoversDate, found a "form", and produced a YELLOW
-- row with no punches.  The engine was corrected today (2026-08-27) so it now
-- gates on punches, not forms, for off-days — but upsertPayrollEntries never
-- deletes, so the 10 rows it already wrote survive untouched.
--
-- These 10 rows span four employees (Elizabeth Mootoo, Juan Fonseca, Tanya
-- Bedoya, Ulla Hees) on 2026-08-22 and 2026-08-23.  Every row carries a zero
-- discount and no punch data.  Eight were already resolved by the operator
-- (wasted work).  All carry documentation 'Form Submitted'.
--
-- The DO block counts the target rows first and aborts if the count differs,
-- making it safe to re-run and impossible to run against a database it does
-- not match.
--
-- Rollback: restore the rows from Period Log (set deleted_at = NULL,
--           deleted_by = NULL) for deleted_by =
--           'migration-1781986600-offday-form-rows-q2-aug'.

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
  FROM payroll_entries pe
  JOIN employees e ON e.id = pe.employee_id
  LEFT JOIN schedules s ON s.id = e.schedule_id
  WHERE e.id = pe.employee_id
    AND pe.period_name = 'Q2-Aug-2026'
    AND pe.deleted_at IS NULL
    AND NULLIF(TRIM(pe.entry_time), '') IS NULL
    AND NULLIF(TRIM(pe.exit_time), '')  IS NULL
    AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
          [EXTRACT(ISODOW FROM LEFT(pe.work_date, 10)::date)::int]
        <> ALL (string_to_array(
              COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri'), ','));

  IF n <> 10 THEN
    RAISE EXCEPTION 'Expected exactly 10 phantom off-day rows in Q2-Aug-2026, found %. Aborting without changes.', n;
  END IF;

  UPDATE payroll_entries pe
  SET deleted_at = NOW(),
      deleted_by = 'migration-1781986600-offday-form-rows-q2-aug'
  FROM employees e
  LEFT JOIN schedules s ON s.id = e.schedule_id
  WHERE e.id = pe.employee_id
    AND pe.period_name = 'Q2-Aug-2026'
    AND pe.deleted_at IS NULL
    AND NULLIF(TRIM(pe.entry_time), '') IS NULL
    AND NULLIF(TRIM(pe.exit_time), '')  IS NULL
    AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
          [EXTRACT(ISODOW FROM LEFT(pe.work_date, 10)::date)::int]
        <> ALL (string_to_array(
              COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri'), ','));

  RAISE NOTICE 'Soft-deleted % phantom off-day rows in Q2-Aug-2026.', n;
END $$;
