# Read-only: the two Jeanine Puyol rows

**This is a question, not a change. Do not edit, create or delete any file,
action or migration.** Run the queries below against `GAF Planilla DB` and
report each result as a table. Change nothing. Do not "fix" anything you find.

Background: on 2026-09-25 an admin opened Jeanine Puyol on Admin → Employees →
Roster, changed her Teramind Email to her new address and clicked Save. The
save is an `INSERT … ON CONFLICT (teramind_email)`, so a new email inserted a
**second employee row** instead of updating the first. We need to know exactly
what is attached to each row before merging them.

## Query 1 — both rows

```sql
SELECT id, display_name, teramind_email, company_domain, schedule_id, active,
       excluded_from_payroll, start_date::text, end_date::text, role, manager, notes
FROM employees
WHERE display_name ILIKE '%puyol%' OR teramind_email ILIKE '%puyol%'
   OR teramind_email ILIKE 'jeanine%'
ORDER BY id;
```

## Query 2 — every table that points at either row

Counts rows in **every** base table in `public` that has an `employee_id`
column, for each Jeanine id. Read-only (`query_to_xml` runs a `SELECT count(*)`).

```sql
SELECT c.table_name, e.id AS employee_id,
       (xpath('/row/n/text()', query_to_xml(format(
          'SELECT count(*) AS n FROM public.%I WHERE employee_id = %s',
          c.table_name, e.id), false, true, '')))[1]::text::int AS n
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
 AND t.table_type = 'BASE TABLE'
CROSS JOIN employees e
WHERE c.table_schema = 'public' AND c.column_name = 'employee_id'
  AND (e.display_name ILIKE '%puyol%' OR e.teramind_email ILIKE '%puyol%'
       OR e.teramind_email ILIKE 'jeanine%')
ORDER BY c.table_name, e.id;
```

Report every row, including zeros.

## Query 3 — her Teramind accounts

```sql
SELECT agent_id, employee_id, email, name, deleted, linked_by
FROM teramind_agents
WHERE email ILIKE '%puyol%' OR email ILIKE 'jeanine%' OR name ILIKE '%puyol%'
   OR employee_id IN (SELECT id FROM employees WHERE display_name ILIKE '%puyol%')
ORDER BY agent_id;
```

## Query 4 — any payroll rows already on the newer (higher id) row

```sql
SELECT pe.employee_id, pe.period_name, count(*) AS rows
FROM payroll_entries pe
WHERE pe.employee_id IN (SELECT id FROM employees WHERE display_name ILIKE '%puyol%')
GROUP BY pe.employee_id, pe.period_name
ORDER BY pe.employee_id, pe.period_name;
```

If a column name in Query 4 does not exist, run `SELECT column_name FROM
information_schema.columns WHERE table_name = 'payroll_entries'` and adapt the
query to the real column names, then report which name you used.

## Query 5 — access and aliases by email or name

```sql
SELECT 'name_aliases' AS src, alias_text AS value, employee_id::text AS ref
FROM name_aliases WHERE alias_text ILIKE '%puyol%'
UNION ALL
SELECT 'app_users', email, NULL FROM app_users WHERE email ILIKE '%puyol%' OR email ILIKE 'jeanine%';
```

If `app_users` has no `email` column, drop that half and say so.

Report all five results. Change nothing.
