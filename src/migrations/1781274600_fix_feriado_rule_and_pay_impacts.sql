-- Align Feriado rule with engine output (Paid – Sin Compensatorio)
UPDATE event_type_rules
SET default_pay_impact = 'Paid – Sin Compensatorio',
    notes = 'Auto-resolved to Paid – Sin Compensatorio when no Teramind data. YELLOW if employee worked (assign Compensatorio).',
    updated_at = NOW()
WHERE event_type = 'Feriado';

-- Seed any pay impacts the engine references that may be missing
INSERT INTO pay_impacts (name)
VALUES
  ('Paid via Time-for-Time'),
  ('Incapacidad'),
  ('Paid (Grace)'),
  ('Paid – Exception'),
  ('Paid – Sin Compensatorio'),
  ('Compensatorio')
ON CONFLICT (name) DO NOTHING;
