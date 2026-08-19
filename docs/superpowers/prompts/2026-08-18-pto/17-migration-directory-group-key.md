Create and apply a new database migration named `add_directory_group_config` against the `GAF Planilla DB` datasource, with exactly the SQL below. Do not change any other file.

Context: the Panama Employee Directory board has two groups, and group membership is a more reliable "is this person current?" signal than the Status column. Measured on the live board 2026-08-19: the `topics` group ("Current Employees") holds 44 rows with Status = Active plus one with a blank Status, and the `group_title` group ("Past employees") holds 8 Resigned and 12 Offboarded. Group and Status therefore agree on every row except one — a rehire whose new row has no Status set yet.

Monday group ids are Monday ids, so they belong in `classification_config` like every board and column id, not in code.

```sql
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
```

Acceptance: `SELECT value FROM classification_config WHERE key = 'monday_group_directory_current'` returns `topics`. No file other than the new migration and `src/migrations/applied.txt` changed.
