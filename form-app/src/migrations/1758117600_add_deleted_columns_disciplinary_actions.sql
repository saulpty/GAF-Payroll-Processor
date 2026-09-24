ALTER TABLE disciplinary_actions
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by    TEXT,
  ADD COLUMN IF NOT EXISTS deletion_note TEXT;
