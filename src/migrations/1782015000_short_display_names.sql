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
