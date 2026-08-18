-- Full legal names as they appear on the Employee Onboarding board
-- (board 8661565945), mapped to the short display_name used in employees.
-- Confirmed by the owner 2026-08-18. Without these, eight ACTIVE employees
-- are unmatched on that board, which would silently exclude them from
-- contract-end and milestone tracking.
--
-- Employee ids are resolved by name at apply time (case-insensitively) so
-- no id is hardcoded. If any name fails to resolve the migration raises
-- rather than inserting a NULL employee_id.

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
    ARRAY['Eddy Miguel Cedeno Chavarria',      'Eddy Cedeño']
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
    WHERE lower(display_name) = lower(target_name)
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
