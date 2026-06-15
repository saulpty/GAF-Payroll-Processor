-- Seed missing pay impact values used by the classification engine.
INSERT INTO pay_impacts (name)
VALUES
  ('Paid via Time-for-Time'),
  ('Incapacidad'),
  ('Paid (Grace)'),
  ('Paid – Exception'),
  ('Paid – Sin Compensatorio')
ON CONFLICT (name) DO NOTHING;

-- Fix existing holiday entries that have blank pay_impact_1:
-- auto-resolve them to Paid / GREEN (operator can override if employee worked)
UPDATE payroll_entries
SET
  pay_impact_1   = 'Paid – Sin Compensatorio',
  initial_status = 'GREEN',
  status_current = 'GREEN',
  payroll_ready  = 'YES',
  auto_notes     = auto_notes || ' [Auto-resolved: Paid – Sin Compensatorio. Override if employee worked this holiday → use Compensatorio.]'
WHERE event_type_1 = 'Feriado'
  AND pay_impact_1 = ''
  AND payroll_ready = 'NO';
