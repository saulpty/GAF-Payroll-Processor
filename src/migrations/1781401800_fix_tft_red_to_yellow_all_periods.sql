-- Fix TFT (Time-for-Time) entries that were incorrectly stored as RED.
-- New rule: TFT always → YELLOW, operator reviews manually regardless of minutes late.
-- Applies to all periods. Only touches unresolved entries (resolved_by IS NULL).

UPDATE payroll_entries
SET
  initial_status = 'YELLOW',
  status_current = 'YELLOW',
  payroll_ready  = 'NO',
  auto_notes     = REGEXP_REPLACE(
                     auto_notes,
                     'TFT on file but late > \d+ min — escalated to RED for review\.',
                     'TFT on file — operator must review.'
                   ),
  updated_at     = NOW()
WHERE event_type_1 = 'Tardanza'
  AND initial_status = 'RED'
  AND resolved_by IS NULL
  AND (
    auto_notes ILIKE '%tft on file%'
    OR auto_notes ILIKE '%time for time%'
    OR auto_notes ILIKE '%late time payback%'
  );
