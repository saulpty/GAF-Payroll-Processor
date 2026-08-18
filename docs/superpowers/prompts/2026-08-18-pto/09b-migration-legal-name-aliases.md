Create and apply a new database migration named `add_legal_name_aliases` against `GAF Planilla DB` with exactly the SQL below. Do not change any other file.

Context: the Employee Onboarding board stores full legal names while `employees.display_name` holds the short form, and that board has no email column, so eight active employees fail to match. The owner has confirmed each pairing. This is the same pattern as the existing migration `1781803300_add_missing_name_aliases`.

```sql
-- Full legal names as they appear on the Employee Onboarding board
-- (board 8661565945), mapped to the short display_name used in employees.
-- Confirmed by the owner 2026-08-18. Without these, eight ACTIVE employees
-- are unmatched on that board, which would silently exclude them from
-- contract-end and milestone tracking.
--
-- Employee ids are resolved by name at apply time, accent-insensitively, so
-- no id is hardcoded. If any name fails to resolve the migration raises
-- rather than inserting a NULL employee_id.

CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
DECLARE
  pairs CONSTANT text[][] := ARRAY[
    ARRAY['Luis Felipe Abad Lemos',            'Luis Abad'],
    ARRAY['Navvad Afua Owusu Biamah',          'Navvad Owusu'],
    ARRAY['Tanya Thatiana Bedoya Ledezma',     'Tanya Bedoya'],
    ARRAY['Arelis Yaneth Acosta Jiron',        'Arelis Acosta'],
    ARRAY['Monique Alexandra Luque Valdonedo', 'Monique Luque'],
    ARRAY['Eduardo Antonio Herrera Reyes',     'Eduardo Herrera'],
    ARRAY['Jose Eduardo De Hermoso Mendoza',   'Jose De Hermoso'],
    ARRAY['Eddy Miguel Cedeno Chavarria',      'Eddy Cedeno']
  ];
  alias_text_v text;
  target_name  text;
  emp_id       bigint;
  i            int;
BEGIN
  FOR i IN 1 .. array_length(pairs, 1) LOOP
    alias_text_v := pairs[i][1];
    target_name  := pairs[i][2];

    SELECT id INTO emp_id
    FROM employees
    WHERE lower(unaccent(display_name)) = lower(unaccent(target_name))
    LIMIT 1;

    IF emp_id IS NULL THEN
      RAISE EXCEPTION 'No employee matches display_name %', target_name;
    END IF;

    INSERT INTO name_aliases (alias_text, employee_id)
    VALUES (alias_text_v, emp_id)
    ON CONFLICT (alias_text) DO UPDATE SET employee_id = EXCLUDED.employee_id;

    emp_id := NULL;
  END LOOP;
END $$;
```

Note the two accent-free spellings in the array: the board rows read "Eddy Miguel Cedeño Chavarría" with accents, but `name_aliases` lookups go through `normalizeName`, which strips accents, so storing the unaccented form is correct and matches either spelling.

Acceptance: the migration applies without raising; `SELECT count(*) FROM name_aliases` increases by 8; `SELECT a.alias_text, e.display_name FROM name_aliases a JOIN employees e ON e.id = a.employee_id WHERE a.alias_text LIKE '%Cedeno%'` returns the pairing to Eddy Cedeño. No file other than the new migration and `src/migrations/applied.txt` changed.
