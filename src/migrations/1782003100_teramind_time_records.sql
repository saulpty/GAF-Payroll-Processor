-- Teramind saved copy: remember which Teramind feed each saved row came from.
--
-- The first pulls used the "login_session" analytics feed. On 2026-09-17 we found the feed behind
-- Teramind's own Time Records screen (the screen payroll's export file has always come from). It is
-- live for today, can be filtered to our own people, and returns exact instants. From now on
-- payroll, attendance and the comparison screen read ONLY source = 'time_record'. Rows already
-- saved from login sessions are kept (rows are never deleted) and simply marked as such.
--
-- is_manual: a time record that someone typed into Teramind by hand rather than one the agent
-- software recorded. Payroll will want to see that.

ALTER TABLE teramind_sessions
  ADD COLUMN IF NOT EXISTS source    TEXT    NOT NULL DEFAULT 'login_session',
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE teramind_pull_log
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'login_session';

CREATE INDEX IF NOT EXISTS idx_teramind_sessions_source_date
  ON teramind_sessions (source, work_date);

-- ROLLBACK
-- DROP INDEX IF EXISTS idx_teramind_sessions_source_date;
-- ALTER TABLE teramind_pull_log DROP COLUMN IF EXISTS source;
-- ALTER TABLE teramind_sessions DROP COLUMN IF EXISTS is_manual, DROP COLUMN IF EXISTS source;
