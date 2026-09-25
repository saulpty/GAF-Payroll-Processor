BEGIN;

-- 0. Guard: both rows are who we think they are.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM employees WHERE id = 20 AND display_name = 'Jeanine Puyol')
  OR NOT EXISTS (SELECT 1 FROM employees WHERE id = 62 AND display_name = 'Jeanine Puyol') THEN
    RAISE EXCEPTION 'Jeanine rows 20/62 not as expected; aborting';
  END IF;
END $$;

-- 1. Re-point what the duplicate picked up.
UPDATE monday_attendance_forms SET employee_id = 20 WHERE employee_id = 62;

INSERT INTO access_group_members (group_id, employee_id)
SELECT group_id, 20 FROM access_group_members WHERE employee_id = 62
ON CONFLICT DO NOTHING;
DELETE FROM access_group_members WHERE employee_id = 62;

-- 2. Guard: nothing else in any table still points at 62.
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'employee_id'
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE employee_id = 62', r.table_name) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Table % still has % row(s) for employee 62; aborting', r.table_name, n;
    END IF;
  END LOOP;
END $$;

-- 3. Remove the duplicate, then give the real row the new email (lower-case).
DELETE FROM employees WHERE id = 62;

UPDATE employees
   SET teramind_email = 'jeanine.p@passiontocarehc.com',
       company_domain = 'passiontocarehc.com'
 WHERE id = 20;

COMMIT;
