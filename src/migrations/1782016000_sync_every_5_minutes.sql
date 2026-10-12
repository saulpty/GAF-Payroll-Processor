-- Saul, 2026-10-12: background refresh every 5 minutes instead of 15.
-- Only touches the row if it still holds the seeded 15.

UPDATE classification_config
SET value = '5',
    updated_at = NOW()
WHERE key = 'sync_every_minutes'
  AND value = '15';

-- ROLLBACK
-- UPDATE classification_config SET value = '15', updated_at = NOW() WHERE key = 'sync_every_minutes' AND value = '5';
