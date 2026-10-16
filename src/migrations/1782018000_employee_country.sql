-- Employee country + International Directory board settings (Saul, 2026-10-16). Safe to run twice.
-- Everyone existing is Panama. Payroll, PTO and Contracts only load employees whose country
-- equals config key payroll_country. People from the International Directory board get the
-- board's Country column value, or 'International' when it is blank.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Panama';

INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('payroll_country', 'Panama', 'Payroll Country',
   'Only employees whose Country equals this are included in payroll, PTO and Contracts. Everyone else only shows in Attendance.',
   'text', 'internal'),
  ('monday_board_directory_intl', '18435831051', 'International Directory: Board',
   'Board id of the International Employee Directory. Empty switches the international sync off.',
   'text', 'monday_boards'),
  ('monday_group_intl_current', 'group_mm86g7pv', 'International Directory: Current Group',
   'Group id of Current Employees on the International Directory board. Only rows in this group are active.',
   'text', 'monday_boards'),
  ('monday_col_intl_email', 'email_mm86mmyw', 'International Directory: Email Column',
   'Column id of the Email column (must be the email the person uses in Teramind).',
   'text', 'monday_columns'),
  ('monday_col_intl_role', 'text_mm86cqqf', 'International Directory: Role Column', 'Column id of the Role column. Optional.',
   'text', 'monday_columns'),
  ('monday_col_intl_country', 'text_mm86tbe3', 'International Directory: Country Column', 'Column id of the Country column. Optional; blank means International.',
   'text', 'monday_columns'),
  ('monday_col_intl_manager', 'text_mm86s9w7', 'International Directory: Manager Column', 'Column id of the Manager (name) column.',
   'text', 'monday_columns'),
  ('monday_col_intl_manager_email', 'email_mm86e7g1', 'International Directory: Manager Email Column',
   'Column id of the Manager Email column. The first manager who sees the person.',
   'text', 'monday_columns'),
  ('monday_col_intl_manager2', 'text_mm86gbbe', 'International Directory: Manager 2 Column', 'Column id of the Manager 2 (name) column.',
   'text', 'monday_columns'),
  ('monday_col_intl_manager2_email', 'email_mm86tg3b', 'International Directory: Manager 2 Email Column',
   'Column id of the Manager 2 Email column. The second manager who sees the person.',
   'text', 'monday_columns')
ON CONFLICT (key) DO NOTHING;

-- ROLLBACK
-- ALTER TABLE employees DROP COLUMN country;
-- DELETE FROM classification_config WHERE key = 'payroll_country' OR key LIKE 'monday_%intl%';
