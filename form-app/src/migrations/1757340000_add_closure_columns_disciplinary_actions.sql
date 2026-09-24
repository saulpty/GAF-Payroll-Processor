ALTER TABLE disciplinary_actions
  ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by    TEXT,
  ADD COLUMN IF NOT EXISTS closure_note TEXT;
