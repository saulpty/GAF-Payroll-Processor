-- Update Monday directory board ID and role column ID based on confirmed board 8661565945.
-- The role/position column ID on that board is 'text'.

UPDATE classification_config SET value = '8661565945' WHERE key = 'monday_board_directory';
UPDATE classification_config SET value = 'text'       WHERE key = 'monday_col_directory_role';
