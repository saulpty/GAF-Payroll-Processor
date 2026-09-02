-- 1781992000_merge_employee_47_into_49.sql
--
-- Merge duplicate employee record 47 (inactive) into 49 (active).
-- Authorised by Saul, 2026-09-01.
--
-- Background:
--   employees.id 47 — javierqvistgaard@hotmail.com, active=false, DUPLICATE
--     - 10 payroll_entries rows, all in Q2-Jul-2026 (already-paid period)
--     - 1 monday_contracts row (board row for Euclides Gonzalez)
--     - 1 pto_employees row (pto_start_date_override=NULL, paid_pto_days=0)
--   employees.id 49 — javier.g@passiontocarehc.com, active=true, CANONICAL
--     - 30 payroll_entries rows
--     - 1 pto_employees row (pto_start_date_override=NULL, paid_pto_days=0)
--     - 1 name_aliases row
--
-- Pre-migration collision check confirmed zero date-level duplicates between
-- 47 and 49 in payroll_entries, so all 10 Q2-Jul-2026 rows move safely.
-- The payroll totals for Q2-Jul-2026 are UNCHANGED — rows are re-attributed,
-- not deleted. They now sit under employee 49.
--
-- Rollback: NOT REVERSIBLE. Once employee 47 is deleted the original
-- attribution cannot be reconstructed from data alone. To undo, the rows
-- on employee 49 that came from Q2-Jul-2026 could be soft-deleted, but the
-- link back to 47 is permanently gone.

BEGIN;

-- Payroll: move only days 49 does not already have (safety guard, though
-- collision check confirmed there are none).
UPDATE payroll_entries pe
SET employee_id = 49
WHERE pe.employee_id = 47
  AND NOT EXISTS (
    SELECT 1 FROM payroll_entries x
    WHERE x.employee_id = 49
      AND x.period_name = pe.period_name
      AND x.work_date   = pe.work_date
  );

-- Name aliases and Monday mirrors.
UPDATE name_aliases            SET employee_id = 49 WHERE employee_id = 47;
UPDATE monday_contracts        SET employee_id = 49 WHERE employee_id = 47;
UPDATE monday_requests         SET employee_id = 49 WHERE employee_id = 47;
UPDATE monday_attendance_forms SET employee_id = 49 WHERE employee_id = 47;

-- PTO: 49's row wins; carry over anything only 47 has (both are null/0 here).
UPDATE pto_employees a
SET pto_start_date_override = COALESCE(a.pto_start_date_override, b.pto_start_date_override),
    paid_pto_days           = COALESCE(NULLIF(a.paid_pto_days, 0), b.paid_pto_days)
FROM pto_employees b
WHERE a.employee_id = 49 AND b.employee_id = 47;

DELETE FROM pto_employees WHERE employee_id = 47;
DELETE FROM pto_approvals WHERE employee_id = 47;   -- expected 0 rows

-- Only succeeds if nothing references 47 any more. Foreign key is the safety net.
DELETE FROM employees WHERE id = 47;

COMMIT;
