# 12 — Data fix: fold `Q1-Aug-20260` back into `Q1-Aug-2026`

**Do not run until Saul has said go** — this deletes payroll rows. Evidence and
reasoning: `docs/findings/2026-09-10-q1-aug-duplicate-period.md`.

Facts from the probe: `Q1-Aug-2026` = orphaned partial run (205 payroll rows,
21 employees, Jul 26 → Aug 7, no `periods` row, 3 snapshots), every one of
its rows also present under `Q1-Aug-20260`; `Q1-Aug-20260` = the complete run
(437 rows, 43 employees, Jul 26 → Aug 9, `periods` row processed 2026-08-10
19:27, 9 snapshots).

## Files you may change

- `src/migrations/1782000100_fold_q1_aug_20260.sql` — **new**

**No other file.** Apply it to the GAF Planilla DB in one transaction.

```sql
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
```

After applying, report these (read-only):

```sql
SELECT period_name, COUNT(*), COUNT(DISTINCT employee_id), MIN(LEFT(work_date,10)), MAX(LEFT(work_date,10))
FROM payroll_entries WHERE period_name LIKE 'Q1-Aug-2026%' GROUP BY 1;
SELECT period_name, processed_at FROM periods WHERE period_name LIKE 'Q1-Aug-2026%';
```

Expected: exactly one row `Q1-Aug-2026 / 437 / 43 / 2026-07-26 / 2026-08-09`;
one `periods` row named `Q1-Aug-2026`.

## Verify (browser)

1. Period dropdown lists `Q1-Aug-2026` and no `20260`.
2. `/pto` → Gabriel Chu → the Jul 29 floating holiday lists **one** cycle.
3. Payroll Master for `Q1-Aug-2026` shows 43 employees.
