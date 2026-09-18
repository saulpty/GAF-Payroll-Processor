-- One shared auto-sync interval for every keep-fresh timer (Access groups, Teramind, and now the
-- four Monday boards + Teramind roster). Existing timers keep working off their own key until they
-- switch over in code; this migration only adds the new key and a small run log.

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES (
  'sync_every_minutes',
  '15',
  'Data refresh interval (minutes)',
  'How often the Hub refreshes its saved copies of external data (Monday boards, Teramind roster, Teramind time records, Access groups) while a super user has it open. Minimum 5.',
  'number',
  'teramind'
)
ON CONFLICT (key) DO NOTHING;

UPDATE classification_config
SET description = description || ' Superseded by sync_every_minutes.'
WHERE key = 'teramind_sync_every_minutes'
  AND description NOT LIKE '%Superseded by sync_every_minutes%';

CREATE TABLE IF NOT EXISTS sync_log (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       TEXT NOT NULL,               -- 'directory' | 'requests' | 'attendance_forms' | 'contracts' | 'teramind_roster'
  ran_at     TIMESTAMPTZ DEFAULT NOW(),
  ran_by     TEXT,                        -- viewer email, or 'auto'
  created    INT DEFAULT 0,               -- e.g. new employees created (directory only)
  updated    INT DEFAULT 0,
  error      TEXT
);

-- ROLLBACK
-- DROP TABLE IF EXISTS sync_log;
-- UPDATE classification_config SET description = replace(description, ' Superseded by sync_every_minutes.', '') WHERE key = 'teramind_sync_every_minutes';
-- DELETE FROM classification_config WHERE key = 'sync_every_minutes';
