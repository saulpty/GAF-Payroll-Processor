# Merge the duplicate Jeanine Puyol (id 62) into the real one (id 20)

**Create exactly one new migration file, `src/migrations/<next>_merge_jeanine_puyol_duplicate.sql`,
and run it. No other file may be touched — no page, component, action, lib or AGENTS.md change.**

## Why

On 2026-09-25 an admin changed Jeanine Puyol's email on Admin → Employees → Roster.
The save is `INSERT … ON CONFLICT (teramind_email)`, so it inserted a second employee
instead of updating the first. The read-only probe (prompt 01) found:

| id | email | attached |
|---|---|---|
| **20** (real) | `jeanine.p@avondalecaregrouppa.com` | 143 payroll_entries, 2044 teramind_sessions, 2 teramind_agents (one already on the new email), 84 monday_attendance_forms, PTO rows, the `jeanine puyol` name alias |
| **62** (duplicate) | `Jeanine.P@passiontocarehc.com` | 1 access_group_members, 2 monday_attendance_forms, nothing else |

## The migration — one transaction, exactly this logic

```sql
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
```

If `access_group_members` uses different column names than `group_id` / `employee_id`,
read its real columns from `information_schema.columns` and adapt **only** step 1's
INSERT, keeping the same meaning. Say which names you used.

## After running, report these three results as tables

```sql
SELECT id, display_name, teramind_email, company_domain, active
FROM employees WHERE display_name ILIKE '%puyol%' ORDER BY id;
```
Expected: exactly one row, id 20, email `jeanine.p@passiontocarehc.com`.

```sql
SELECT 'monday_attendance_forms' AS t, count(*) FROM monday_attendance_forms WHERE employee_id = 20
UNION ALL SELECT 'access_group_members', count(*) FROM access_group_members WHERE employee_id = 20
UNION ALL SELECT 'payroll_entries', count(*) FROM payroll_entries WHERE employee_id = 20
UNION ALL SELECT 'teramind_sessions', count(*) FROM teramind_sessions WHERE employee_id = 20;
```
Expected: forms 86 (or more if new forms synced), access 1, payroll 143, sessions 2044 (or more).

```sql
SELECT agent_id, employee_id, email FROM teramind_agents WHERE employee_id = 20 ORDER BY agent_id;
```
Expected: agents 512 and 926, both on 20.

Do not change the Roster page or `upsertEmployee` in this prompt — that fix is a separate prompt.
