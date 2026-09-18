-- Activity monitoring thresholds. "Needs A Look" and the break-length flag on the Activity tab
-- must never hardcode a number in the page, so the three thresholds live here like every other
-- classification_config setting. Safe to run twice.

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES (
  'activity_min_active_minutes',
  '390',
  'Minimum active minutes (Activity tab)',
  'Below this many active minutes on a scheduled day (before today, no reason chip), the day is flagged Needs A Look. Scaled by shift length: shiftMinutes * (390/480).',
  'number',
  'teramind'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES (
  'activity_break_minutes',
  '60',
  'Expected break minutes (Activity tab)',
  'Breaks = (last record finish - first record start) - active minutes. This is the expected break length used when judging a day on the Activity tab.',
  'number',
  'teramind'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES (
  'activity_break_over_minutes',
  '30',
  'Break-over-expected flag threshold (Activity tab)',
  'A day is flagged for a long break when time away exceeds activity_break_minutes by more than this many minutes.',
  'number',
  'teramind'
)
ON CONFLICT (key) DO NOTHING;

-- ROLLBACK
-- DELETE FROM classification_config WHERE key IN
--   ('activity_min_active_minutes', 'activity_break_minutes', 'activity_break_over_minutes');
