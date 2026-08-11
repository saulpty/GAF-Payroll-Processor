-- Schema audit for GAF Planilla DB.
--
-- Returns SCHEMA AND COUNTS ONLY. No employee names, emails, times, or pay
-- data. Nothing here identifies a person.
--
-- Run each query in the UI Bakery Database tab and paste the result back.
-- Results are recorded in docs/findings/2026-08-11-schema-reconciliation.md

-- ---------------------------------------------------------------------------
-- Q1. The true applied-migration ledger.
-- The export's applied.txt claims ~20 migrations were never applied. This is
-- the authoritative answer.
-- ---------------------------------------------------------------------------
SELECT * FROM uib_migrations ORDER BY 1;


-- ---------------------------------------------------------------------------
-- Q2. Every table and view actually present.
-- ---------------------------------------------------------------------------
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;


-- ---------------------------------------------------------------------------
-- Q3. Structure of the three pto_* tables, which no migration creates and no
-- application code references.
-- ---------------------------------------------------------------------------
SELECT table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name LIKE 'pto\_%'
ORDER BY table_name, ordinal_position;


-- ---------------------------------------------------------------------------
-- Q4. Are the pto_* tables in use, or empty scaffolding?
-- ---------------------------------------------------------------------------
SELECT 'pto_approvals' AS table_name, count(*) AS row_count FROM pto_approvals
UNION ALL SELECT 'pto_employees', count(*) FROM pto_employees
UNION ALL SELECT 'pto_floating_holidays', count(*) FROM pto_floating_holidays;


-- ---------------------------------------------------------------------------
-- Q5. Did 1781402000_add_work_days_to_schedules actually apply?
-- Look for a work_days column.
-- ---------------------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'schedules'
ORDER BY ordinal_position;


-- ---------------------------------------------------------------------------
-- Q6. Did 1781402100_add_soft_delete_to_payroll_entries actually apply?
-- Look for deleted_at or similar.
-- ---------------------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payroll_entries'
ORDER BY ordinal_position;


-- ---------------------------------------------------------------------------
-- Q7. Does hrk_exports exist? Its migration (1781401000) is absent from the
-- export's ledger, yet the table appears in the database browser.
-- ---------------------------------------------------------------------------
SELECT count(*) AS hrk_exports_row_count FROM hrk_exports;
