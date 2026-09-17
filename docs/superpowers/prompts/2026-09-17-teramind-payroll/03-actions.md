# Teramind actions — ten new action files

Create the ten files below **with exactly this content**. **No other file may be created, modified
or deleted**, and nothing should import them yet. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything under `src/components/ui/`.

## Notes

- Two are HTTP actions on the datasource `'Teramind API'` (that exact string — confirmed by the
  2026-09-17 probe). They follow `pullMondayBoard.ts`: an object body with whole-value
  `{{params.x}}` that is **never inside quotes**.
- Eight are SQL actions on `'GAF Planilla DB'` against the tables created by the previous prompt.
- `loadTeramindSessions` is scoped to the signed-in viewer through `v_employee_access` exactly like
  `loadAttendanceEmployees`. Do not alter that clause.

### `src/actions/loadTeramindAgentDirectory.ts`

```ts
import { action } from '@uibakery/data';

// Teramind's agent roster (whole company). Super-only callers: the Teramind admin tab.
// `manager` is accepted for the house rule that every load* takes one; it is not used.
function loadTeramindAgentDirectory() {
  return action('loadTeramindAgentDirectory', 'HTTP', {
    datasourceName: 'Teramind API',
    options: {
      method: 'GET',
      url: '/v1/agents',
      queryParams: { fields: 'name,email_address,deleted,online' },
    },
  });
}

export default loadTeramindAgentDirectory;
```

### `src/actions/loadTeramindAgents.ts`

```ts
import { action } from '@uibakery/data';

function loadTeramindAgents() {
  return action('loadTeramindAgents', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        ta.agent_id,
        ta.employee_id,
        ta.email,
        ta.name,
        ta.deleted,
        ta.linked_by,
        COALESCE(e.display_name, '') AS employee_name,
        ta.synced_at
      FROM teramind_agents ta
      LEFT JOIN employees e ON e.id = ta.employee_id
      ORDER BY ta.name;
    `,
  });
}

export default loadTeramindAgents;
```

### `src/actions/loadTeramindLoginSessions.ts`

```ts
import { action } from '@uibakery/data';

// Login sessions for a date range, whole company, times in US Eastern.
// The cube cannot be filtered by agent (probe 2026-09-17: `in` is rejected, `range` silently
// returns nothing), so callers keep only linked agents before saving. Super-only callers.
// `manager` is accepted for the house rule that every load* takes one; it is not used.
function loadTeramindLoginSessions() {
  return action('loadTeramindLoginSessions', 'HTTP', {
    datasourceName: 'Teramind API',
    options: {
      method: 'POST',
      url: '/wip/tma-query',
      headers: { 'Content-Type': 'application/json' },
      bodyType: 'object',
      body: `{
        cube: "login_session",
        timezone: "America/New_York",
        aggregate: false,
        dims: ["agent", "date", "timestamp", "computer"],
        measures: ["time_s"],
        dim_filters: { date: { range: [{{params.dateFrom}}, {{params.dateTo}}] } },
        limit: 50000
      }`,
    },
  });
}

export default loadTeramindLoginSessions;
```

### `src/actions/loadTeramindPullLog.ts`

```ts
import { action } from '@uibakery/data';

function loadTeramindPullLog() {
  return action('loadTeramindPullLog', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        id,
        date_from,
        date_to,
        pulled_at,
        pulled_by,
        trigger,
        agent_count,
        row_count,
        saved_count,
        truncated,
        error
      FROM teramind_pull_log
      ORDER BY pulled_at DESC
      LIMIT 50;
    `,
  });
}

export default loadTeramindPullLog;
```

### `src/actions/loadTeramindSessions.ts`

```ts
import { action } from '@uibakery/data';

// Saved Teramind login sessions for a date range, scoped to the signed-in viewer.
// `manager` is accepted (house rule: every load* takes one); manager filtering happens in React
// with matchesManager, exactly as the Attendance pages do.
function loadTeramindSessions() {
  return action('loadTeramindSessions', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        ts.agent_id,
        ts.employee_id,
        lower(e.teramind_email) AS teramind_email,
        ts.work_date,
        ts.started_et,
        ts.finished_et,
        ts.started_raw,
        ts.duration_s,
        ts.computer
      FROM teramind_sessions ts
      INNER JOIN employees e ON e.id = ts.employee_id
      WHERE ts.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
        AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                      WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ORDER BY e.id, ts.started_et;
    `,
  });
}

export default loadTeramindSessions;
```

### `src/actions/updateTeramindAgentLink.ts`

```ts
import { action } from '@uibakery/data';

function updateTeramindAgentLink() {
  return action('updateTeramindAgentLink', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH updated_agent AS (
        UPDATE teramind_agents
        SET
          employee_id = NULLIF({{params.employee_id}}::text, '')::bigint,
          linked_by = {{params.linked_by}}::text
        WHERE agent_id = {{params.agent_id}}::bigint
        RETURNING agent_id, employee_id
      )
      UPDATE teramind_sessions
      SET employee_id = (SELECT employee_id FROM updated_agent)
      WHERE agent_id = (SELECT agent_id FROM updated_agent);
    `,
  });
}

export default updateTeramindAgentLink;
```

### `src/actions/updateTeramindAgentLinks.ts`

```ts
import { action } from '@uibakery/data';

function updateTeramindAgentLinks() {
  return action('updateTeramindAgentLinks', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE teramind_agents t
      SET
        employee_id = (r->>'employee_id')::bigint,
        linked_by = {{params.linked_by}}::text
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      WHERE t.agent_id = (r->>'agent_id')::bigint
        AND (t.linked_by IS NULL OR t.linked_by = 'auto');
    `,
  });
}

export default updateTeramindAgentLinks;
```

### `src/actions/upsertTeramindAgents.ts`

```ts
import { action } from '@uibakery/data';

function upsertTeramindAgents() {
  return action('upsertTeramindAgents', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO teramind_agents (agent_id, email, name, deleted, raw, synced_at)
      SELECT
        (r->>'agent_id')::bigint,
        r->>'email',
        r->>'name',
        COALESCE((r->>'deleted')::boolean, false),
        (r->'raw'),
        NOW()
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      ON CONFLICT (agent_id) DO UPDATE SET
        email   = EXCLUDED.email,
        name    = EXCLUDED.name,
        deleted = EXCLUDED.deleted,
        raw     = EXCLUDED.raw,
        synced_at = NOW();
    `,
  });
}

export default upsertTeramindAgents;
```

### `src/actions/upsertTeramindPullLog.ts`

```ts
import { action } from '@uibakery/data';

function upsertTeramindPullLog() {
  return action('upsertTeramindPullLog', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO teramind_pull_log (
        date_from, date_to, pulled_by, trigger, agent_count, row_count, saved_count,
        truncated, error
      )
      VALUES (
        {{params.date_from}}::text,
        {{params.date_to}}::text,
        {{params.pulled_by}}::text,
        {{params.trigger}}::text,
        {{params.agent_count}}::int,
        {{params.row_count}}::int,
        {{params.saved_count}}::int,
        {{params.truncated}}::boolean,
        NULLIF({{params.error}}::text, '')
      )
      RETURNING id;
    `,
  });
}

export default upsertTeramindPullLog;
```

### `src/actions/upsertTeramindSessions.ts`

```ts
import { action } from '@uibakery/data';

function upsertTeramindSessions() {
  return action('upsertTeramindSessions', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO teramind_sessions (
        agent_id, employee_id, work_date, started_et, finished_et, started_raw,
        duration_s, computer, raw, synced_at
      )
      SELECT
        (r->>'agent_id')::bigint,
        ta.employee_id,
        r->>'work_date',
        r->>'started_et',
        r->>'finished_et',
        r->>'started_raw',
        COALESCE((r->>'duration_s')::int, 0),
        COALESCE(r->>'computer', ''),
        (r->'raw'),
        NOW()
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      LEFT JOIN teramind_agents ta ON ta.agent_id = (r->>'agent_id')::bigint
      ON CONFLICT (agent_id, started_raw, computer) DO UPDATE SET
        finished_et   = EXCLUDED.finished_et,
        duration_s    = EXCLUDED.duration_s,
        employee_id   = COALESCE(EXCLUDED.employee_id, teramind_sessions.employee_id),
        raw           = EXCLUDED.raw,
        synced_at     = NOW()
      RETURNING id;
    `,
  });
}

export default upsertTeramindSessions;
```

## Acceptance

1. Exactly these ten files were created under `src/actions/`; nothing else changed.
2. Each file matches the content above.
3. Run `loadTeramindPullLog` and `loadTeramindAgents`: both succeed and return 0 rows.
4. Run `loadTeramindAgentDirectory`: it returns an array of several hundred agents, each with
   `agent_id`, `name`, `email_address`, `deleted`, `online`. Report the count only.
