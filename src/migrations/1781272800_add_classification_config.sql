-- Adds a classification_config table for editable engine rules.
-- Seeds the default values matching current hardcoded behaviour.

CREATE TABLE classification_config (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  value_type  TEXT NOT NULL DEFAULT 'text',  -- 'text' | 'number' | 'boolean' | 'impact'
  category    TEXT NOT NULL DEFAULT 'general',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('tft_late_red_threshold_minutes',  '30',                   'TFT Red Threshold (min)',         'If employee has TFT on file and is late MORE than this many minutes, entry is escalated to RED for operator review.',          'number',  'tardiness'),
  ('non_grace_auto_resolve',          'true',                 'Auto-resolve non-grace tardiness', 'When enabled, non-grace-list employees who are late are automatically resolved to GREEN with the configured auto impact.',      'boolean', 'tardiness'),
  ('non_grace_auto_impact',           'Unpaid (without Grace)','Non-grace auto pay impact',       'Pay impact automatically applied when a non-grace-list employee is late and auto-resolve is enabled.',                         'impact',  'tardiness'),
  ('grace_pardon_requires_form',      'true',                 'Grace pardon requires form',       'When enabled, grace-list employees are only pardoned (Paid Grace) if they also submitted a GAF Attendance Form.',              'boolean', 'grace'),
  ('grace_excess_split_event',        'true',                 'Split grace excess into 2nd event','When enabled, if a grace-list employee exceeds the grace window (even with a form), the excess minutes appear as a 2nd Tardanza event for operator review.', 'boolean', 'grace'),
  ('no_data_no_form_impact',          'Unpaid',               'No-data/no-form auto impact',     'Pay impact suggested when an employee has no Teramind data and no absence form. Entry stays RED.',                             'impact',  'absence'),
  ('early_leave_auto_impact',         '',                     'Early leave auto impact',          'If set, automatically applies this pay impact to Salida Temprano events. Leave blank to require operator input.',              'impact',  'early_leave'),
  ('monday_board_attendance',         '9542698245',           'Monday Board: Attendance',         'Monday.com board ID for the GAF Attendance Form (tardiness/absence submissions).',                                             'number',  'monday_boards'),
  ('monday_board_adjustments',        '18394647909',          'Monday Board: Adjustments',        'Monday.com board ID for the Time Adjustments / TFT board.',                                                                    'number',  'monday_boards'),
  ('monday_board_permissions',        '18394590373',          'Monday Board: Permissions & PTO',  'Monday.com board ID for the Permissions & Requests board (PTO, WFH, Compensatory, etc.).',                                    'number',  'monday_boards'),
  ('monday_col_attendance_email',     'email_mkzjpqgt',       'Attendance: Email column ID',      'Monday column ID for employee email on the Attendance board.',                                                                 'text',    'monday_columns'),
  ('monday_col_attendance_date',      'date0d5ep965',         'Attendance: Date column ID',       'Monday column ID for the date on the Attendance board.',                                                                       'text',    'monday_columns'),
  ('monday_col_attendance_type',      'single_selectjxb85m6', 'Attendance: Type column ID',       'Monday column ID for the type (Tardiness/Absence) on the Attendance board.',                                                  'text',    'monday_columns'),
  ('monday_col_adjustments_email',    'email_mkzjtb9v',       'Adjustments: Email column ID',     'Monday column ID for employee email on the Adjustments board.',                                                               'text',    'monday_columns'),
  ('monday_col_adjustments_date',     'date_mkzk6a5a',        'Adjustments: Date column ID',      'Monday column ID for the date on the Adjustments board.',                                                                     'text',    'monday_columns'),
  ('monday_col_adjustments_type',     'single_selectnisb6ij', 'Adjustments: Type column ID',      'Monday column ID for the adjustment type on the Adjustments board.',                                                          'text',    'monday_columns'),
  ('monday_col_permissions_email',    'email_mkzjqdh7',       'Permissions: Email column ID',     'Monday column ID for employee email on the Permissions board.',                                                               'text',    'monday_columns'),
  ('monday_col_permissions_daterange','date_rangeye9vcz9z',   'Permissions: Date range column ID','Monday column ID for the date range on the Permissions board.',                                                               'text',    'monday_columns'),
  ('monday_col_permissions_type',     'single_selectogxov2i', 'Permissions: Type column ID',      'Monday column ID for the request type on the Permissions board.',                                                             'text',    'monday_columns'),
  ('monday_col_permissions_type_alt', 'single_select889imtb', 'Permissions: Type column ID (alt)','Alternative Monday column ID for request type (fallback).',                                                                  'text',    'monday_columns');
