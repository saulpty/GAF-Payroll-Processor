# Shorter display names: Gisselle Ramos, Maria Urriola

**Copy the SQL exactly.** Create exactly one new migration file,
`src/migrations/<next>_short_display_names.sql`, with the SQL below, and run it. **No other
file may be touched.**

## Why
Saul (2026-09-25): the long names take up column space. Gisselle's full name becomes
**Gisselle Ramos**; Maria's becomes **Maria Urriola**. The old full name is kept as a
`name_aliases` row first, because:
- Monday.com boards and forms that fall back to name matching resolve through aliases;
- the Disciplinary page finds each person's records by display name **plus aliases**, and
  existing disciplinary actions are stored under the old full name.
Payroll, Teramind and PTO use `employee_id` and are unaffected.

## Migration SQL

```sql
DO $$
DECLARE
  pairs CONSTANT text[][] := ARRAY[
    ARRAY['%gisselle%', 'Gisselle Ramos'],
    ARRAY['%urriola%',  'Maria Urriola']
  ];
  n int;
  emp_id bigint;
  old_name text;
  i int;
BEGIN
  FOR i IN 1 .. array_length(pairs, 1) LOOP
    SELECT count(*) INTO n FROM employees WHERE display_name ILIKE pairs[i][1];
    IF n <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one employee matching %, found %', pairs[i][1], n;
    END IF;
    SELECT id, display_name INTO emp_id, old_name FROM employees WHERE display_name ILIKE pairs[i][1];

    IF old_name <> pairs[i][2] THEN
      -- Keep the old full name resolvable (Monday name matching, Disciplinary records).
      INSERT INTO name_aliases (alias_text, employee_id)
      VALUES (old_name, emp_id)
      ON CONFLICT (alias_text) DO NOTHING;

      UPDATE employees SET display_name = pairs[i][2] WHERE id = emp_id;
    END IF;
  END LOOP;
END $$;
```

## After running, report these as tables

```sql
SELECT e.id, e.display_name, e.teramind_email,
       (SELECT string_agg(a.alias_text, ' | ' ORDER BY a.alias_text) FROM name_aliases a WHERE a.employee_id = e.id) AS aliases
FROM employees e
WHERE e.display_name IN ('Gisselle Ramos', 'Maria Urriola')
ORDER BY e.display_name;
```
Expected: two rows; each alias list contains the old full name.

```sql
SELECT count(*) AS still_long FROM employees
WHERE display_name ILIKE '%gisselle%' AND display_name <> 'Gisselle Ramos'
   OR display_name ILIKE '%urriola%' AND display_name <> 'Maria Urriola';
```
Expected: 0.
