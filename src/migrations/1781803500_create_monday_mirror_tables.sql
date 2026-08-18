-- Durable local mirror of four Monday.com boards. Rows are keyed by the
-- Monday item id; employee_id is resolved at sync time (email → alias → name)
-- and is NULL when nothing matched. Rows are never deleted: an item that
-- disappears from the board is flagged deleted_on_monday.

CREATE TABLE IF NOT EXISTS monday_requests (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monday_item_id        BIGINT NOT NULL UNIQUE,
  employee_id           BIGINT NULL REFERENCES employees(id) ON DELETE SET NULL,
  employee_name_raw     TEXT,
  employee_email_raw    TEXT,
  manager_email_raw     TEXT,
  board_group           TEXT,
  request_type          TEXT,
  permission_type       TEXT,
  start_date            DATE,
  end_date              DATE,
  return_date           DATE,
  start_datetime        TEXT,
  end_datetime          TEXT,
  total_days_requested  NUMERIC(6,2),
  hours_approved        NUMERIC(6,2),
  reason                TEXT,
  details               TEXT,
  submitted_at          TEXT,
  raw                   JSONB NOT NULL,
  deleted_on_monday     BOOLEAN NOT NULL DEFAULT false,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monday_requests_employee ON monday_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_monday_requests_type_start ON monday_requests (request_type, start_date);

CREATE TABLE IF NOT EXISTS monday_attendance_forms (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monday_item_id        BIGINT NOT NULL UNIQUE,
  employee_id           BIGINT NULL REFERENCES employees(id) ON DELETE SET NULL,
  employee_name_raw     TEXT,
  employee_email_raw    TEXT,
  board_group           TEXT,
  form_type             TEXT,
  reason                TEXT,
  details               TEXT,
  eta                   TEXT,
  form_date             DATE,
  submitted_at          TEXT,
  raw                   JSONB NOT NULL,
  deleted_on_monday     BOOLEAN NOT NULL DEFAULT false,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monday_attendance_forms_emp_date ON monday_attendance_forms (employee_id, form_date);

CREATE TABLE IF NOT EXISTS monday_contracts (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monday_item_id        BIGINT NOT NULL UNIQUE,
  employee_id           BIGINT NULL REFERENCES employees(id) ON DELETE SET NULL,
  employee_name_raw     TEXT,
  employee_email_raw    TEXT,
  board_group           TEXT,
  position              TEXT,
  state                 TEXT,
  manager_raw           TEXT,
  start_date            DATE,
  contract_end_date     DATE,
  raw                   JSONB NOT NULL,
  deleted_on_monday     BOOLEAN NOT NULL DEFAULT false,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monday_contracts_employee ON monday_contracts (employee_id);

CREATE TABLE IF NOT EXISTS monday_sync_log (
  board_key        TEXT PRIMARY KEY,
  last_synced_at   TIMESTAMPTZ,
  item_count       INT NOT NULL DEFAULT 0,
  matched_count    INT NOT NULL DEFAULT 0,
  unmatched_count  INT NOT NULL DEFAULT 0,
  last_error       TEXT
);
INSERT INTO monday_sync_log (board_key) VALUES ('directory'), ('requests'), ('attendance_forms'), ('contracts')
ON CONFLICT (board_key) DO NOTHING;
