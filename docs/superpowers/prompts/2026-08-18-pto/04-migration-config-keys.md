Create and apply a new database migration named `seed_monday_config_keys` against the `GAF Planilla DB` datasource, with exactly the SQL below. Do not change any other file.

Every ID below was read from Monday's API on 2026-08-18 via the API Playground. None is guessed. Do not "correct", reformat or substitute any value — paste them verbatim, including the Onboarding position column whose ID is the bare word `text`, which is genuinely its column ID on that board.

```sql
-- Monday board and column IDs for the mirror layer. Every value here was read
-- from Monday's API on 2026-08-18 (docs/findings/2026-08-18-monday-column-map.md),
-- not inferred. classification_config.key is UNIQUE, so re-running is safe.

INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('monday_board_onboarding',              '8661565945',           'Monday Board: Employee Onboarding', 'Board 8661565945, Employee Onboarding - position, state, manager, start date, contract end. NOT the directory board; 1781400400 once confused the two.', 'number', 'monday_boards'),

  ('monday_col_requests_name',             'name',                 'Requests: Name',              'Item name on Permissions and Requests. Literal column id name.', 'text', 'monday_columns'),
  ('monday_col_requests_email',            'email_mkzjqdh7',       'Requests: Email',             'Employee-entered email.', 'text', 'monday_columns'),
  ('monday_col_requests_manager_email',    'lookup_mkzhhh4q',      'Requests: Manager Email',     'Mirror column - read column_values.text, not value.', 'text', 'monday_columns'),
  ('monday_col_requests_job_title',        'lookup_mkzh8x4q',      'Requests: Job Title',         'Mirror column - read column_values.text, not value.', 'text', 'monday_columns'),
  ('monday_col_requests_employee_email',   'lookup_mkzhc2az',      'Requests: Employee Email',    'Mirror of the directory email. Differs from the typed Email column.', 'text', 'monday_columns'),
  ('monday_col_requests_request_type',     'single_selectogxov2i', 'Requests: Request Type',      'PTO / Vacation, Time Off / Permission, Floating Holiday, Birthday Day Off, Work From Home.', 'text', 'monday_columns'),
  ('monday_col_requests_permission_type',  'single_select889imtb', 'Requests: Permission Type',   'e.g. Time for Time. Also seeded as monday_col_permissions_type_alt for the payroll run.', 'text', 'monday_columns'),
  ('monday_col_requests_date_range',       'date_rangeye9vcz9z',   'Requests: Dates Requested',   'Timeline column: parse value JSON for from/to.', 'text', 'monday_columns'),
  ('monday_col_requests_return_date',      'dateecjdq0rz',         'Requests: Return to Work Date', '', 'text', 'monday_columns'),
  ('monday_col_requests_start_datetime',   'datecv81o9oh',         'Requests: Start Date and Time', 'Time-for-Time start.', 'text', 'monday_columns'),
  ('monday_col_requests_end_datetime',     'datezy89br45',         'Requests: End Date and Time', 'Time-for-Time end.', 'text', 'monday_columns'),
  ('monday_col_requests_total_days',       'short_text7o6c1a6j',   'Requests: Total Days Requested', 'The board has TWO columns with this title. This is the populated one; short_textzk2linnu is empty. Do not swap them.', 'text', 'monday_columns'),
  ('monday_col_requests_hours_approved',   'numberutelbza0',       'Requests: Hours Per Day Approved', '', 'text', 'monday_columns'),
  ('monday_col_requests_reason',           'single_selectq0dq645', 'Requests: Reason',            'Personal, Medical, etc.', 'text', 'monday_columns'),
  ('monday_col_requests_details',          'long_textmn2wtwum',    'Requests: Details',           '', 'text', 'monday_columns'),
  ('monday_col_requests_submitted',        'dategd1mzgql',         'Requests: Date Submission',   '', 'text', 'monday_columns'),

  ('monday_col_attendance_details',        'text_mksn4fnb',        'Attendance: Details',         '', 'text', 'monday_columns'),
  ('monday_col_attendance_eta',            'single_selectu8a0ezg', 'Attendance: ETA',             '', 'text', 'monday_columns'),
  ('monday_col_attendance_manager_email',  'lookup_mktcdbfj',      'Attendance: Manager Email',   'Mirror column - read column_values.text.', 'text', 'monday_columns'),
  ('monday_col_attendance_role',           'lookup_mm156cye',      'Attendance: Role',            'Mirror column - read column_values.text.', 'text', 'monday_columns'),

  ('monday_col_onboarding_position',       'text',                 'Onboarding: Position',        'The column id really is the bare word text. Note 1781400400 once wrote this same id into monday_col_directory_role, where it was wrong.', 'text', 'monday_columns'),
  ('monday_col_onboarding_state',          'lookup_mktc2x46',      'Onboarding: State',           'Mirror column - read column_values.text.', 'text', 'monday_columns'),
  ('monday_col_onboarding_manager',        'text_mkptja09',        'Onboarding: Manager',         '', 'text', 'monday_columns'),
  ('monday_col_onboarding_manager_email',  'email_mktc7p9z',       'Onboarding: Manager Email',   '', 'text', 'monday_columns'),
  ('monday_col_onboarding_start_date',     'date_mknz53sh',        'Onboarding: Start Date',      'The hire date. fetchMondayStartDates already reads this board.', 'text', 'monday_columns'),
  ('monday_col_onboarding_contract_end',   'date_mkzhvk0f',        'Onboarding: Contract End Date', 'Titled 6 Contract End Date on the board.', 'text', 'monday_columns'),
  ('monday_col_onboarding_3_months',       'date_mm2pgzk7',        'Onboarding: 3 Months',        '', 'text', 'monday_columns'),
  ('monday_col_onboarding_1_year',         'formula_mm6a1fy9',     'Onboarding: 1 Year',          'Formula column.', 'text', 'monday_columns')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      label = EXCLUDED.label,
      description = EXCLUDED.description,
      value_type = EXCLUDED.value_type,
      category = EXCLUDED.category,
      updated_at = NOW();
```

Acceptance: the migration is applied; `SELECT count(*) FROM classification_config WHERE key LIKE 'monday_col_requests_%'` returns 16; `SELECT value FROM classification_config WHERE key = 'monday_board_onboarding'` returns 8661565945; `SELECT value FROM classification_config WHERE key = 'monday_col_onboarding_position'` returns exactly `text`. No file other than the new migration and `src/migrations/applied.txt` changed.
