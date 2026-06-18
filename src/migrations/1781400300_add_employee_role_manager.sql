-- Add role + manager to employees, sourced from the Monday "Panama Employee
-- directory" board. Columns are nullable; they're populated by the directory
-- sync (Admin -> Directory Sync). UI Bakery wires the two Monday column IDs via
-- the config keys below.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS role    TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager TEXT;

-- Monday directory column mapping (UI Bakery fills in the column IDs).
INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('monday_board_directory',        '8592460836', 'Monday Board: Employee Directory', 'Monday.com board ID for the Panama Employee directory (role/manager source).', 'number', 'monday_boards'),
  ('monday_col_directory_role',     '',           'Directory: Role column ID',        'Monday column ID on the directory board that holds each employee''s role/title.', 'text', 'monday_columns'),
  ('monday_col_directory_manager',  '',           'Directory: Manager column ID',     'Monday column ID on the directory board that holds each employee''s manager.',    'text', 'monday_columns')
ON CONFLICT (key) DO NOTHING;
