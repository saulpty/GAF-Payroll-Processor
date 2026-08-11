-- Add missing name aliases for Eddy Cedeño and Juan Fonseca
INSERT INTO name_aliases (alias_text, employee_id)
VALUES
  ('Eddy Cedeño', 28),
  ('Juan Fonseca', 17)
ON CONFLICT (alias_text) DO UPDATE SET employee_id = EXCLUDED.employee_id;
