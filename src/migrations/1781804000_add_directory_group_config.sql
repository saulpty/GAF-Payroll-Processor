-- Group ids on the Panama Employee Directory board (8592460836), read from the
-- Monday API on 2026-08-19. Membership of the "current" group is the authority
-- for whether an employee is active; the Status column can be blank on a newly
-- added row, as it was for a rehire on that date.

INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('monday_group_directory_current', 'topics',      'Directory: Current Employees group id',
   'Group id on the Panama Employee Directory board whose members are current employees. Rows in this group set employees.active = true; rows in any other group set it false.', 'text', 'monday_columns'),
  ('monday_group_directory_past',    'group_title', 'Directory: Past employees group id',
   'Group id holding former employees. Recorded for readability; the sync only needs the current-group id.', 'text', 'monday_columns')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, label = EXCLUDED.label, description = EXCLUDED.description;
