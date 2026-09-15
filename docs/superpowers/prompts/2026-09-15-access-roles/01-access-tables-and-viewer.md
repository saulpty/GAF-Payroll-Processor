# 01 — Access tables, the visibility view, and two viewer actions

## Files that may change

- `src/migrations/1782002000_access_roles.sql` (new)
- `src/actions/loadCurrentViewer.ts` (new)
- `src/actions/loadVisibleEmployeeIds.ts` (new)

No other file may be touched. Do not create, delete, rename or reformat
anything else. No page, no component, no route, no change to existing actions.

## Why

We are adding roles. A **super user** sees and edits the whole app. A
**manager** sees only employees in the groups ("departments") they are
attached to, as primary, secondary, tertiary manager and so on. A manager
marked `all_employees` sees every employee but still not Payroll or Admin.

The previous round verified that `{{ user.email }}` works inside a SQL action
and returns the signed-in person's email **in mixed case**
(`Saul.F@vitasyahc.com`). So every email in this feature is stored and compared
**lower-cased**.

This round only creates the data layer. Nothing in the app uses it yet, so the
app must look and behave exactly as before.

No time or date value is touched. Timezone invariant unaffected.

## 1. Migration `src/migrations/1782002000_access_roles.sql`

Create this file with exactly this SQL, then apply it.

```sql
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
```

## 2. `src/actions/loadCurrentViewer.ts`

Same shape as `src/actions/loadWhoAmI.ts`. Parameters go flat. Do not put
`{{params.viewAs}}` inside quotes.

```ts
import { action } from '@uibakery/data';

function loadCurrentViewer() {
  return action('loadCurrentViewer', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT lower(btrim({{ user.email }}))                  AS real_email,
             v.viewer                                         AS email,
             u.id, u.display_name, u.role, u.all_employees, u.active
        FROM (SELECT access_viewer({{ user.email }}, {{params.viewAs}}::text) AS viewer) v
        LEFT JOIN app_users u ON u.email = v.viewer;
    `,
  });
}

export default loadCurrentViewer;
```

It always returns exactly one row. `id` is null when the email is not on the list.

## 3. `src/actions/loadVisibleEmployeeIds.ts`

```ts
import { action } from '@uibakery/data';

function loadVisibleEmployeeIds() {
  return action('loadVisibleEmployeeIds', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT a.employee_id
        FROM v_employee_access a
       WHERE a.email = access_viewer({{ user.email }}, {{params.viewAs}}::text)
       ORDER BY a.employee_id;
    `,
  });
}

export default loadVisibleEmployeeIds;
```

## Acceptance — run these and paste the raw results in your reply

1. The migration applied without error.
2. `loadCurrentViewer` with `{ viewAs: '' }` returns one row with
   `email = 'saul.f@vitasyahc.com'`, `role = 'super_user'`, `active = true`.
3. `loadCurrentViewer` with `{ viewAs: 'nobody@example.com' }` returns one row
   with `email = 'nobody@example.com'` and `id = null`.
4. `loadVisibleEmployeeIds` with `{ viewAs: '' }`: report the row count. It must
   equal `SELECT count(*) FROM employees`; report that number too.
5. Then confirm every identifier used in each file is imported.

Do not build anything else. Do not offer to build the next step.
