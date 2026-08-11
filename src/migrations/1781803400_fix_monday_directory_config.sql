-- Correct the Monday.com directory config so it matches the board and
-- columns the application actually uses, and add the two column keys that
-- were never created. Nothing reads these keys yet, so this changes no
-- behavior; it makes the config truthful.

UPDATE classification_config SET value = '8592460836'
  WHERE key = 'monday_board_directory';

UPDATE classification_config SET value = 'text_mm63b2xk'
  WHERE key = 'monday_col_directory_role';

UPDATE classification_config SET value = 'text_mkzj84w1'
  WHERE key = 'monday_col_directory_manager';

INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('monday_col_directory_active', 'color_mkyjv6et', 'Directory: Active status column ID',
   'Monday column ID on the directory board whose text is "Active" when the employee is active.', 'text', 'monday_columns'),
  ('monday_col_directory_email',  'text_mkzjgsxv',  'Directory: Employee email column ID',
   'Monday column ID on the directory board that holds each employee''s company email.', 'text', 'monday_columns')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
