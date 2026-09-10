-- 2026-09-10. Period run twice: "Q1-Aug-2026" (partial, orphaned — no periods
-- row) and "Q1-Aug-20260" (complete, typo'd name). Keep the complete run
-- under the right name. See docs/findings/2026-09-10-q1-aug-duplicate-period.md.
-- Hard deletes are required: UNIQUE (period_name, employee_id, work_date) on
-- payroll_entries includes soft-deleted rows, so the rename below would collide.
-- Rollback: not reversible without a backup; run_snapshots for the kept run
-- are untouched.
BEGIN;

-- Guard: refuse to run if the shape of the data is not what the probe saw.
DO $$
DECLARE orphan int; kept int; per int;
BEGIN
  SELECT COUNT(*) INTO orphan FROM payroll_entries WHERE period_name = 'Q1-Aug-2026';
  SELECT COUNT(*) INTO kept   FROM payroll_entries WHERE period_name = 'Q1-Aug-20260';
  SELECT COUNT(*) INTO per    FROM periods WHERE period_name = 'Q1-Aug-2026';
  IF orphan <> 205 OR kept <> 437 OR per <> 0 THEN
    RAISE EXCEPTION 'Unexpected counts: orphan %, kept %, periods(Q1-Aug-2026) % — stop and re-probe', orphan, kept, per;
  END IF;
END $$;

DELETE FROM payroll_entries WHERE period_name = 'Q1-Aug-2026';   -- 205 rows
DELETE FROM run_snapshots   WHERE period_name = 'Q1-Aug-2026';   -- 3 rows

UPDATE periods         SET period_name = 'Q1-Aug-2026' WHERE period_name = 'Q1-Aug-20260';
UPDATE payroll_entries SET period_name = 'Q1-Aug-2026' WHERE period_name = 'Q1-Aug-20260';
UPDATE run_snapshots   SET period_name = 'Q1-Aug-2026' WHERE period_name = 'Q1-Aug-20260';
UPDATE hrk_exports     SET period_name = 'Q1-Aug-2026' WHERE period_name = 'Q1-Aug-20260';

COMMIT;
