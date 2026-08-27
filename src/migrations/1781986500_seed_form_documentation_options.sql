-- 1781986500_seed_form_documentation_options.sql
-- Seeds three new documentation_options values that name the Monday board
-- a row's supporting document came from. The engine previously wrote
-- "Form Submitted" regardless of which board matched; operators couldn't
-- tell which form to open. These values let the engine be specific.
-- "Form Submitted" is intentionally preserved — existing rows carry it and
-- operators must still be able to select it from the dropdown.

INSERT INTO documentation_options (name) VALUES
  ('Permission Form'),
  ('Attendance Form'),
  ('Time Adjustment Form')
ON CONFLICT (name) DO NOTHING;
