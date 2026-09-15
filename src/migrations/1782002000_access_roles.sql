-- 2026-09-15. Roles and manager-scoped access (roadmap G).
-- Creates app_users, access_groups, access_group_members, access_group_managers,
-- view v_employee_access, function access_viewer; seeds two super users and one
-- classification_config key. Touches no existing row except that one config insert.
-- Rollback: DROP VIEW v_employee_access; DROP FUNCTION access_viewer(text, text);
--   DROP TABLE access_group_managers, access_group_members, access_groups, app_users;
--   DELETE FROM classification_config WHERE key = 'monday_col_directory_manager_email';

CREATE TABLE IF NOT EXISTS app_users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  display_name  TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL CHECK (role IN ('super_user', 'manager')),
  all_employees BOOLEAN NOT NULL DEFAULT false,
  active        BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_groups (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_group_members (
  group_id    BIGINT NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id)     ON DELETE CASCADE,
  PRIMARY KEY (group_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_access_group_members_employee ON access_group_members (employee_id);

CREATE TABLE IF NOT EXISTS access_group_managers (
  group_id BIGINT   NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
  user_id  BIGINT   NOT NULL REFERENCES app_users(id)     ON DELETE CASCADE,
  rank     SMALLINT NOT NULL DEFAULT 1 CHECK (rank >= 1),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_access_group_managers_user ON access_group_managers (user_id);

-- One row per (viewer email, employee id) the viewer may see.
CREATE OR REPLACE VIEW v_employee_access AS
  SELECT u.email, e.id AS employee_id
    FROM app_users u
    CROSS JOIN employees e
   WHERE u.active AND (u.role = 'super_user' OR u.all_employees)
  UNION
  SELECT u.email, m.employee_id
    FROM app_users u
    JOIN access_group_managers gm ON gm.user_id = u.id
    JOIN access_group_members  m  ON m.group_id = gm.group_id
   WHERE u.active AND u.role = 'manager';

-- The effective viewer. An active super user may "view as" another email;
-- everyone else is always themselves. Both inputs are lower-cased.
CREATE OR REPLACE FUNCTION access_viewer(real_email TEXT, view_as TEXT)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT CASE
           WHEN COALESCE(btrim(view_as), '') <> ''
            AND EXISTS (SELECT 1 FROM app_users
                         WHERE email = lower(btrim(real_email))
                           AND role = 'super_user' AND active)
           THEN lower(btrim(view_as))
           ELSE lower(btrim(real_email))
         END
$$;

INSERT INTO app_users (email, display_name, role) VALUES
  ('saul.f@vitasyahc.com', 'Saul Fallembaum', 'super_user'),
  ('tim.m@vitasyahc.com',  'Timothy Moore',   'super_user')
ON CONFLICT (email) DO NOTHING;

INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('monday_col_directory_manager_email', 'text_mkzj8b73', 'Directory: Manager Email column',
   'Panama Employee Directory column holding the manager''s email. Used by Admin > Access to build groups from Monday and by the directory sync to place new hires.',
   'text', 'monday_columns')
ON CONFLICT (key) DO NOTHING;
