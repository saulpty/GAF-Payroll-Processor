-- Teramind keep-fresh sync: the interval was seeded as 180 minutes when we believed Teramind only
-- updated once a day. The Time Records feed is live, so the default becomes 15 minutes.
-- Only touches the row if nobody has changed it by hand.

UPDATE classification_config
SET value = '15',
    description = 'How often the Hub refreshes today''s Teramind time records while a super user has it open. Minimum 5.',
    updated_at = NOW()
WHERE key = 'teramind_sync_every_minutes'
  AND value = '180';

-- ROLLBACK
-- UPDATE classification_config SET value = '180' WHERE key = 'teramind_sync_every_minutes' AND value = '15';
