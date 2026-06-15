-- Seed default rules for all event types that the engine produces.
-- PTO already exists (id=1); use ON CONFLICT to safely re-upsert it too.

INSERT INTO event_type_rules (event_type, default_pay_impact, default_doc_option, notes)
VALUES
  ('Tardanza',              'Unpaid (without Grace)', 'Form Submitted',       'Default for non-grace tardiness'),
  ('Salida Temprano',       '',                       NULL,                   'Pay impact depends on context — operator reviews'),
  ('Ausencia Justificada.', '',                       'Doctor Note – Pending','Justified absence; pay impact set after doc review'),
  ('Ausencia Injustificada','Unpaid',                 NULL,                   'Unjustified absence — Unpaid'),
  ('Permiso Remunerado',    'Paid',                   'Form Submitted',       'Paid permission/leave'),
  ('Permiso No remunerado', 'Unpaid',                 'Form Submitted',       'Unpaid permission/leave'),
  ('PTO',                   'Paid',                   'Form Submitted',       'PTO / Vacation'),
  ('Feriado',               'Paid',                   NULL,                   'Public holiday — usually Paid; review if employee worked')
ON CONFLICT (event_type) DO UPDATE SET
  default_pay_impact = EXCLUDED.default_pay_impact,
  default_doc_option = EXCLUDED.default_doc_option,
  notes              = EXCLUDED.notes,
  updated_at         = NOW();

-- Add the absence reason (sick/medical indicator) column ID to classification_config
INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES
  ('monday_col_attendance_reason', 'color_mksnwwxd', 'Attendance: Reason column ID', 'Monday column ID for the absence/tardiness reason (e.g. Sick, Medical) on the Attendance board.', 'text', 'monday_columns')
ON CONFLICT (key) DO UPDATE SET
  value      = EXCLUDED.value,
  label      = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = NOW();
