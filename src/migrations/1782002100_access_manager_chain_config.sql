-- Access roles: Manager 2/3/4 name + email columns on the Panama Employee Directory.
-- Measured 2026-09-16 (API playground). Inserts config rows only.
-- Rollback: DELETE FROM classification_config WHERE key IN ('monday_col_directory_manager2',
--   'monday_col_directory_manager2_email','monday_col_directory_manager3','monday_col_directory_manager3_email',
--   'monday_col_directory_manager4','monday_col_directory_manager4_email');
INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('monday_col_directory_manager2', 'text_mm785e8r', 'Directory: Manager 2 column',
   'Panama Employee Directory: second manager (name). Rank 2 in Admin > Access groups.', 'text', 'monday_columns'),
  ('monday_col_directory_manager2_email', 'text_mm15y2vw', 'Directory: Manager 2 Email column',
   'Panama Employee Directory: second manager email. Rank 2 in Admin > Access groups.', 'text', 'monday_columns'),
  ('monday_col_directory_manager3', 'text_mm786kge', 'Directory: Manager 3 column',
   'Panama Employee Directory: third manager (name). Rank 3 in Admin > Access groups.', 'text', 'monday_columns'),
  ('monday_col_directory_manager3_email', 'text_mm78fxpg', 'Directory: Manager 3 Email column',
   'Panama Employee Directory: third manager email. Rank 3 in Admin > Access groups.', 'text', 'monday_columns'),
  ('monday_col_directory_manager4', 'text_mm78whj1', 'Directory: Manager 4 column',
   'Panama Employee Directory: fourth manager (name). The board has two "Manager 4" columns; this is the one with data.', 'text', 'monday_columns'),
  ('monday_col_directory_manager4_email', 'text_mm78hgkr', 'Directory: Manager 4 Email column',
   'Panama Employee Directory: fourth manager email. The board has two "Manager 4 Email" columns; this is the one with data.', 'text', 'monday_columns')
ON CONFLICT (key) DO NOTHING;
