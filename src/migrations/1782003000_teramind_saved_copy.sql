-- Durable local mirror of Teramind session and agent data. Rows keyed by agent_id
-- (agents) and agent_id + started_raw + computer (sessions). employee_id is resolved at
-- sync time and may be NULL when no link exists. linked_by tracks the source of the
-- agent-to-employee link: NULL (no link), 'auto' (automatic matcher), or a username
-- (hand-made link). Rows are never deleted; deleted agents are flagged deleted=true.

CREATE TABLE IF NOT EXISTS teramind_agents (
  agent_id          BIGINT PRIMARY KEY,
  employee_id       BIGINT NULL REFERENCES employees(id) ON DELETE SET NULL,
  email             TEXT,
  name              TEXT,
  deleted           BOOLEAN NOT NULL DEFAULT false,
  linked_by         TEXT,
  raw               JSONB,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teramind_agents_employee ON teramind_agents (employee_id);
CREATE INDEX IF NOT EXISTS idx_teramind_agents_email ON teramind_agents (lower(email));

CREATE TABLE IF NOT EXISTS teramind_sessions (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id          BIGINT NOT NULL,
  employee_id       BIGINT NULL REFERENCES employees(id) ON DELETE SET NULL,
  work_date         TEXT NOT NULL,
  started_et        TEXT NOT NULL,
  finished_et       TEXT NOT NULL,
  started_raw       TEXT NOT NULL,
  duration_s        INT NOT NULL DEFAULT 0,
  computer          TEXT NOT NULL DEFAULT '',
  raw               JSONB,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, started_raw, computer)
);
CREATE INDEX IF NOT EXISTS idx_teramind_sessions_agent_date ON teramind_sessions (agent_id, work_date);
CREATE INDEX IF NOT EXISTS idx_teramind_sessions_date ON teramind_sessions (work_date);

CREATE TABLE IF NOT EXISTS teramind_pull_log (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date_from         TEXT,
  date_to           TEXT,
  pulled_at         TIMESTAMPTZ DEFAULT NOW(),
  pulled_by         TEXT,
  trigger           TEXT,
  agent_count       INT,
  row_count         INT,
  saved_count       INT,
  truncated         BOOLEAN DEFAULT false,
  error             TEXT
);

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES (
  'teramind_sync_every_minutes',
  '180',
  'Teramind sync interval (minutes)',
  'How often the Hub refreshes its saved copy of Teramind sessions while a super user has it open. Teramind itself only updates once a day, so a short interval gains nothing.',
  'number',
  'teramind'
)
ON CONFLICT (key) DO NOTHING;

-- ROLLBACK
-- DROP TABLE IF EXISTS teramind_pull_log;
-- DROP TABLE IF EXISTS teramind_sessions;
-- DROP TABLE IF EXISTS teramind_agents;
-- DELETE FROM classification_config WHERE key = 'teramind_sync_every_minutes';
