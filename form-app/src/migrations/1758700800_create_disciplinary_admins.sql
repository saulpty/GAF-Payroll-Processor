CREATE TABLE IF NOT EXISTS disciplinary_admins (
  email TEXT PRIMARY KEY CHECK (email = lower(btrim(email))),
  name  TEXT NOT NULL
);

INSERT INTO disciplinary_admins (email, name) VALUES
  ('saul.f@vitasyahc.com', 'Saul Fallembaum'),
  ('tim.m@vitasyahc.com',  'Timothy Moore')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE disciplinary_actions
  ADD COLUMN IF NOT EXISTS edited_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_by              TEXT,
  ADD COLUMN IF NOT EXISTS pdf_en_original_base64 TEXT;
