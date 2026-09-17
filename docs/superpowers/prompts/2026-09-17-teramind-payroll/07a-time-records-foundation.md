# 07a — Switch the saved copy to Teramind's Time Records feed (migration, libs, actions)

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…`, `src/actions/…` means `actions/…`, `src/migrations/…` means
`migrations/…`. Never create a top-level folder named `src`.**

## Files that may change — each one replaced/created with the content below, character for character

- `src/migrations/1782003100_teramind_time_records.sql` — NEW (apply it)
- `src/app/lib/teramindTypes.ts`, `src/app/lib/teramindRows.ts`, `src/app/lib/teramindPull.ts` — REPLACE
- `src/actions/loadTeramindTimeRecords.ts` — NEW
- `src/actions/upsertTeramindSessions.ts`, `upsertTeramindPullLog.ts`, `loadTeramindPullLog.ts`,
  `loadTeramindSessions.ts`, `loadTeramindVsPayroll.ts` — REPLACE

No other file may be touched — **no page or hook in this prompt** (the next prompt does those).
Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`, `classificationEngine.ts`,
`AdminLookups.tsx`, `teramindParser.ts`, or anything under `src/components/ui/`.

## Why

The comparison screen showed that Teramind's "login session" feed is the wrong source for payroll:
people stay logged in for days, so only a third of days matched. The owner pointed at Teramind's
**Time Records** screen — the screen payroll's export file has always come from. Its feed
(`POST /tt/r/time-records/grid`) is reachable through the same `Teramind API` datasource, is live for
today, accepts a list of agent ids, takes `pageSize` up to 5000, and returns exact instants in
`period: [startEpochSeconds, endEpochSeconds]`. Rows already saved from login sessions are kept and
marked `source = 'login_session'`; everything new is `source = 'time_record'`.

Do not reformat, rename or "improve" anything below.

## Migration

### `src/migrations/1782003100_teramind_time_records.sql`

```sql
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
```

## Libs

### `src/app/lib/teramindTypes.ts`

```ts
// Types shared by the Teramind libs, actions and pages. Types only — no runtime code.
// A "session" is one Teramind login session: a start instant and a length in seconds.
// All *_et fields are US-Eastern wall-clock text `YYYY-MM-DD HH:MM:SS` with no timezone,
// because the payroll code refuses any timestamp that carries one.

/** One agent from Teramind's roster, normalised. */
export type TeramindAgent = { agent_id: number; email: string; name: string; deleted: boolean };

/** One login session exactly as it is saved in `teramind_sessions`. */
export type TeramindSessionSave = {
  agent_id: number;
  employee_id: number | null;
  work_date: string;      // Eastern date of the session START (cross-midnight sessions stay on this date)
  started_et: string;     // 'YYYY-MM-DD HH:MM:SS'
  finished_et: string;    // 'YYYY-MM-DD HH:MM:SS' — may fall on the next calendar day
  started_raw: string;    // the timestamp exactly as Teramind returned it (part of the unique key)
  duration_s: number;
  computer: string;
  source?: 'login_session' | 'time_record';  // which Teramind feed the row came from
  is_manual?: boolean;    // a time record someone typed into Teramind by hand
};

/** A saved session as loaded back for payroll/attendance: the row plus the employee's email. */
export type TeramindSessionRow = TeramindSessionSave & { teramind_email: string };

/** What the payroll file parser hands to processTeramindData — we must produce exactly this. */
export type TeramindRawRow = { email: string; timeStarted: string; timeFinished: string };

/** One chunk of a pull: inclusive date range, `YYYY-MM-DD`. */
export type PullChunk = { from: string; to: string };
```

### `src/app/lib/teramindRows.ts`

```ts
// Tolerant readers for Teramind API responses. The exact response shapes Teramind will hand us
// are not confirmed yet, so these accept several plausible wrappers and field names rather than
// assuming one. Also links Teramind "agents" (login accounts) to our employees by email, and
// normalizes one raw login-session row into the shape we save to teramind_sessions. A time
// conversion is injected (normalizeSession's `toClock` param) rather than imported.

import type { TeramindAgent, TeramindSessionSave } from './teramindTypes.ts';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asRowArray(arr: unknown): Record<string, unknown>[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isPlainObject);
}

export function unwrapRows(resp: unknown): Record<string, unknown>[] {
  if (Array.isArray(resp)) return asRowArray(resp);
  if (isPlainObject(resp)) {
    if (Array.isArray(resp.data)) return asRowArray(resp.data);
    if (Array.isArray(resp.rows)) return asRowArray(resp.rows);
    if (Array.isArray(resp.result)) return asRowArray(resp.result);
    if (isPlainObject(resp.data) && Array.isArray(resp.data.rows)) return asRowArray(resp.data.rows);
  }
  return [];
}

function toPositiveInt(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === 'string') {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export function agentIdOf(v: unknown): number | null {
  if (Array.isArray(v)) return v.length === 0 ? null : agentIdOf(v[0]);
  if (isPlainObject(v)) {
    if ('id' in v) return toPositiveInt(v.id);
    if ('agent_id' in v) return toPositiveInt(v.agent_id);
    return null;
  }
  return toPositiveInt(v);
}

export function normalizeAgent(row: Record<string, unknown>): TeramindAgent | null {
  const id = toPositiveInt(row.agent_id) ?? toPositiveInt(row.id);
  if (id === null) return null;

  let email = '';
  for (const c of [row.email, row.email_address, row.login, row.username, row.user_email]) {
    if (typeof c === 'string' && c.trim() !== '' && c.includes('@')) {
      email = c.trim().toLowerCase();
      break;
    }
  }

  let name = '';
  if (typeof row.name === 'string' && row.name.trim() !== '') {
    name = row.name.trim();
  } else {
    const first = typeof row.first_name === 'string' ? row.first_name : '';
    const last = typeof row.last_name === 'string' ? row.last_name : '';
    name = `${first} ${last}`.trim();
  }

  const d = row.deleted;
  const deleted = d === true || d === 1 || d === '1' || d === 'true';

  return { agent_id: id, email, name, deleted };
}

export function linkAgents(
  agents: TeramindAgent[],
  employees: { id: number; teramind_email: string }[],
): { links: { agent_id: number; employee_id: number }[]; unlinkedEmployees: number[]; multiAgentEmployees: number[] } {
  const norm = (s: string) => s.trim().toLowerCase();

  const empByEmail = new Map<string, number>();
  const localPartMap = new Map<string, Set<number>>();
  for (const e of employees) {
    const email = norm(e.teramind_email);
    empByEmail.set(email, e.id);
    const local = email.split('@')[0];
    if (!local) continue;
    if (!localPartMap.has(local)) localPartMap.set(local, new Set());
    localPartMap.get(local)!.add(e.id);
  }

  const links: { agent_id: number; employee_id: number }[] = [];
  const linkedEmployeeIds = new Set<number>();
  const agentsPerEmployee = new Map<number, Set<number>>();

  for (const agent of agents) {
    const email = norm(agent.email);
    if (!email) continue;
    let employeeId = empByEmail.get(email) ?? null;
    if (employeeId === null) {
      const local = email.split('@')[0];
      const candidates = localPartMap.get(local);
      if (candidates && candidates.size === 1) employeeId = [...candidates][0];
    }
    if (employeeId === null) continue;
    links.push({ agent_id: agent.agent_id, employee_id: employeeId });
    linkedEmployeeIds.add(employeeId);
    if (!agentsPerEmployee.has(employeeId)) agentsPerEmployee.set(employeeId, new Set());
    agentsPerEmployee.get(employeeId)!.add(agent.agent_id);
  }

  const unlinkedEmployees = employees.map((e) => e.id).filter((id) => !linkedEmployeeIds.has(id));
  const multiAgentEmployees = [...agentsPerEmployee.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([empId]) => empId);

  return { links, unlinkedEmployees, multiAgentEmployees };
}

export function normalizeSession(
  row: Record<string, unknown>,
  toClock: (
    raw: string | number,
    durationS: number,
  ) => { work_date: string; started_et: string; finished_et: string; started_raw: string } | null,
): TeramindSessionSave | null {
  const agentId = agentIdOf(row.agent ?? row.agent_id);
  if (agentId === null) return null;

  const rawStart = row.timestamp ?? row.start ?? row.time_started;
  if (typeof rawStart !== 'string' && typeof rawStart !== 'number') return null;

  const rawDuration = row.time_s ?? row.duration;
  let durationS = 0;
  if (typeof rawDuration === 'number' && Number.isFinite(rawDuration)) {
    durationS = rawDuration;
  } else if (typeof rawDuration === 'string') {
    const n = Number(rawDuration);
    durationS = Number.isFinite(n) ? n : 0;
  }

  const clock = toClock(rawStart, durationS);
  if (clock === null) return null;

  let computer = '';
  const rawComputer = row.computer;
  if (typeof rawComputer === 'string') {
    computer = rawComputer;
  } else if (Array.isArray(rawComputer)) {
    // Teramind sends [id, name] (confirmed by the 2026-09-17 probe): take the first string.
    const first = rawComputer.find((x: unknown) => typeof x === 'string') ?? rawComputer[0];
    if (typeof first === 'string') computer = first;
    else if (isPlainObject(first) && typeof first.name === 'string') computer = first.name;
  } else if (isPlainObject(rawComputer) && typeof rawComputer.name === 'string') {
    computer = rawComputer.name;
  }

  return {
    agent_id: agentId,
    employee_id: null,
    work_date: clock.work_date,
    started_et: clock.started_et,
    finished_et: clock.finished_et,
    started_raw: clock.started_raw,
    duration_s: durationS,
    computer,
  };
}

/**
 * One row of Teramind's Time Records grid (the screen payroll's export file comes from):
 * `{ agent:{agent_id}, period:[startEpochSec, endEpochSec], is_manual, meta:{computer_id} }`.
 * The instants are exact, so the clock text comes from `toClock` and never from the display strings.
 */
export function normalizeTimeRecord(
  row: Record<string, unknown>,
  toClock: (raw: string | number, durationS: number) =>
    { work_date: string; started_et: string; finished_et: string; started_raw: string } | null,
): TeramindSessionSave | null {
  const agentId = agentIdOf(row.agent ?? row.agent_id);
  if (agentId === null) return null;
  const period = Array.isArray(row.period) ? row.period : [];
  const start = Number(period[0]);
  const end = Number(period[1]);
  if (!Number.isFinite(start) || start <= 0) return null;
  let duration = Number.isFinite(end) && end >= start ? end - start : Number(row.duration);
  if (!Number.isFinite(duration) || duration < 0) duration = 0;
  const clock = toClock(Math.trunc(start), Math.trunc(duration));
  if (clock === null) return null;
  const meta = isPlainObject(row.meta) ? row.meta : {};
  const computerId = meta.computer_id;
  return {
    agent_id: agentId,
    employee_id: null,
    work_date: clock.work_date,
    started_et: clock.started_et,
    finished_et: clock.finished_et,
    started_raw: String(Math.trunc(start)),
    duration_s: Math.trunc(duration),
    computer: computerId === null || computerId === undefined ? '' : String(computerId),
    source: 'time_record',
    is_manual: row.is_manual === true || row.is_manual === 1,
  };
}
```

### `src/app/lib/teramindPull.ts`

```ts
// Splits a date range into inclusive chunks of at most `maxDays` for pulling Teramind sessions,
// extending one day past `to` to catch sessions that start after midnight Eastern (and sessions
// that cross midnight at the end of a pay period). Also: detecting a truncated API page,
// computing the rolling "keep fresh" range, and checking whether past pull-log rows already
// cover a date range. All date math is done in whole days via Date.UTC on parsed integers.

import type { PullChunk } from './teramindTypes.ts';

function parseYMD(s: string): [number, number, number] {
  const parts = s.split('-').map((p) => Number.parseInt(p, 10));
  return [parts[0], parts[1], parts[2]];
}

function toDayNumber(s: string): number {
  const [y, m, d] = parseYMD(s);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function fromDayNumber(day: number): string {
  const dt = new Date(day * 86400000);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const d = dt.getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function pullChunks(from: string, to: string, maxDays = 7): PullChunk[] {
  if (from > to) return [];

  const fromDay = toDayNumber(from);
  const toDay = toDayNumber(to) + 1; // catches cross-midnight sessions at the end of the range
  const chunks: PullChunk[] = [];

  let start = fromDay;
  while (start <= toDay) {
    const end = Math.min(start + maxDays - 1, toDay);
    chunks.push({ from: fromDayNumber(start), to: fromDayNumber(end) });
    start = end + 1;
  }

  return chunks;
}

export function isTruncated(rowCount: number, limit: number): boolean {
  return rowCount >= limit;
}

export function keepFreshRange(todayEastern: string): PullChunk {
  const today = toDayNumber(todayEastern);
  return { from: fromDayNumber(today - 1), to: todayEastern };
}

export function coversRange(
  log: { date_from: string; date_to: string; error: string | null; truncated: boolean }[],
  from: string,
  to: string,
): boolean {
  if (from > to) return true;

  const covered = new Set<number>();
  for (const entry of log) {
    if (entry.error || entry.truncated) continue;
    const start = toDayNumber(entry.date_from);
    const end = toDayNumber(entry.date_to);
    for (let d = start; d <= end; d++) covered.add(d);
  }

  const fromDay = toDayNumber(from);
  const toDay = toDayNumber(to);
  for (let d = fromDay; d <= toDay; d++) {
    if (!covered.has(d)) return false;
  }

  return true;
}

/**
 * Epoch-second window to ask the Time Records grid for. Deliberately one day wider on each side
 * than the Eastern dates wanted: the rows carry exact instants, so the caller keeps only rows whose
 * Eastern work_date is inside from..to (see `inDateRange`) and no timezone maths is needed here.
 */
export function recordWindow(from: string, to: string): { periodStart: number; periodEnd: number } {
  return {
    periodStart: (toDayNumber(from) - 1) * 86400,
    periodEnd: (toDayNumber(to) + 2) * 86400 - 1,
  };
}

/** Plain string comparison of YYYY-MM-DD dates, inclusive. */
export function inDateRange(workDate: string, from: string, to: string): boolean {
  return workDate >= from && workDate <= to;
}
```

## Actions

### `src/actions/loadTeramindTimeRecords.ts`

```ts
import { action } from '@uibakery/data';

// One page of Teramind's Time Records grid — the screen payroll's export file has always come
// from. Live for today, filtered to the agent ids we pass, exact instants in `period`.
// `agents` is an array of numbers and is substituted whole. Super-only callers.
// `manager` is accepted for the house rule that every load* takes one; it is not used.
function loadTeramindTimeRecords() {
  return action('loadTeramindTimeRecords', 'HTTP', {
    datasourceName: 'Teramind API',
    options: {
      method: 'POST',
      url: '/tt/r/time-records/grid',
      headers: { 'Content-Type': 'application/json' },
      bodyType: 'object',
      body: `{
        agents: {{params.agents}},
        departments: [],
        computers: [],
        tasks: [],
        filter: "",
        page: {{params.page}},
        pageSize: {{params.pageSize}},
        periodStart: {{params.periodStart}},
        periodEnd: {{params.periodEnd}},
        customFilter: [],
        partial: 0
      }`,
    },
  });
}

export default loadTeramindTimeRecords;
```

### `src/actions/upsertTeramindSessions.ts`

```ts
import { action } from '@uibakery/data';

// Saves Teramind login sessions. Teramind sometimes returns the same session twice in one
// response, and Postgres refuses to touch a row twice in one ON CONFLICT statement, so the batch
// is de-duplicated on the natural key first (keeping the longest duration).
function upsertTeramindSessions() {
  return action('upsertTeramindSessions', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO teramind_sessions (
        agent_id, employee_id, work_date, started_et, finished_et, started_raw,
        duration_s, computer, raw, synced_at, source, is_manual
      )
      SELECT DISTINCT ON ((r->>'agent_id')::bigint, r->>'started_raw', COALESCE(r->>'computer', ''))
        (r->>'agent_id')::bigint,
        ta.employee_id,
        r->>'work_date',
        r->>'started_et',
        r->>'finished_et',
        r->>'started_raw',
        COALESCE((r->>'duration_s')::int, 0),
        COALESCE(r->>'computer', ''),
        (r->'raw'),
        NOW(),
        COALESCE(NULLIF(r->>'source', ''), 'login_session'),
        COALESCE((r->>'is_manual')::boolean, false)
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      LEFT JOIN teramind_agents ta ON ta.agent_id = (r->>'agent_id')::bigint
      ORDER BY (r->>'agent_id')::bigint, r->>'started_raw', COALESCE(r->>'computer', ''),
               COALESCE((r->>'duration_s')::int, 0) DESC
      ON CONFLICT (agent_id, started_raw, computer) DO UPDATE SET
        finished_et   = EXCLUDED.finished_et,
        duration_s    = EXCLUDED.duration_s,
        employee_id   = COALESCE(EXCLUDED.employee_id, teramind_sessions.employee_id),
        raw           = EXCLUDED.raw,
        source        = EXCLUDED.source,
        is_manual     = EXCLUDED.is_manual,
        synced_at     = NOW()
      RETURNING id;
    `,
  });
}

export default upsertTeramindSessions;
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
        truncated, error, source
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
        NULLIF({{params.error}}::text, ''),
        COALESCE(NULLIF({{params.source}}::text, ''), 'login_session')
      )
      RETURNING id;
    `,
  });
}

export default upsertTeramindPullLog;
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
        error,
        source
      FROM teramind_pull_log
      ORDER BY pulled_at DESC
      LIMIT 100;
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
        ts.computer,
        ts.is_manual
      FROM teramind_sessions ts
      INNER JOIN employees e ON e.id = ts.employee_id
      WHERE ts.source = 'time_record'
        AND ts.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
        AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                      WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ORDER BY e.id, ts.started_et;
    `,
  });
}

export default loadTeramindSessions;
```

### `src/actions/loadTeramindVsPayroll.ts`

```ts
import { action } from '@uibakery/data';

// One row per employee per day: Teramind's earliest session start / latest finish beside what
// payroll holds for that day. Read-only. Times are returned as whole minutes since midnight
// (integers) because date-looking text is rewritten on its way to the browser.
// `manager` is accepted (house rule: every load* takes one); filtering by manager happens in React.
function loadTeramindVsPayroll() {
  return action('loadTeramindVsPayroll', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH tm AS (
        SELECT s.employee_id,
               s.work_date,
               MIN(s.started_et)  AS first_start,
               MAX(s.finished_et) AS last_finish,
               COUNT(*)::int      AS sessions,
               MAX(s.duration_s)::int AS longest_s,
               BOOL_OR(s.is_manual)   AS has_manual
        FROM public.teramind_sessions s
        WHERE s.employee_id IS NOT NULL
          AND s.source = {{params.source}}::text
          AND s.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
        GROUP BY s.employee_id, s.work_date
      ),
      pe AS (
        SELECT DISTINCT ON (p.employee_id, LEFT(p.work_date, 10))
               p.employee_id,
               LEFT(p.work_date, 10) AS work_date,
               p.period_name,
               NULLIF(TRIM(p.entry_time), '') AS entry_time,
               NULLIF(TRIM(p.exit_time), '')  AS exit_time,
               p.event_type_1,
               p.initial_status,
               (p.updated_at > p.created_at + interval '2 minutes') AS touched_after_run
        FROM public.payroll_entries p
        WHERE p.deleted_at IS NULL
          AND LEFT(p.work_date, 10) BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
        ORDER BY p.employee_id, LEFT(p.work_date, 10), p.period_name DESC
      )
      SELECT e.id AS employee_id,
             e.display_name AS name,
             j.work_date AS day,
             j.period_name,
             j.entry_time AS pay_entry,
             j.exit_time  AS pay_exit,
             CASE WHEN UPPER(j.entry_time) ~ '^[0-9]{1,2}:[0-9]{2} ?[AP]M$'
                  THEN (EXTRACT(EPOCH FROM to_timestamp(UPPER(j.entry_time), 'HH12:MI AM')::time) / 60)::int END AS pay_entry_min,
             CASE WHEN UPPER(j.exit_time) ~ '^[0-9]{1,2}:[0-9]{2} ?[AP]M$'
                  THEN (EXTRACT(EPOCH FROM to_timestamp(UPPER(j.exit_time), 'HH12:MI AM')::time) / 60)::int END AS pay_exit_min,
             CASE WHEN j.first_start IS NOT NULL
                  THEN SUBSTR(j.first_start, 12, 2)::int * 60 + SUBSTR(j.first_start, 15, 2)::int END AS tm_entry_min,
             CASE WHEN j.last_finish IS NOT NULL
                  THEN SUBSTR(j.last_finish, 12, 2)::int * 60 + SUBSTR(j.last_finish, 15, 2)::int END AS tm_exit_min,
             (LEFT(j.last_finish, 10) > j.work_date) AS tm_exit_next_day,
             j.sessions,
             j.longest_s,
             j.has_manual,
             j.event_type_1,
             j.initial_status,
             j.touched_after_run
      FROM (
        SELECT COALESCE(tm.employee_id, pe.employee_id) AS employee_id,
               COALESCE(tm.work_date, pe.work_date)     AS work_date,
               tm.first_start, tm.last_finish, tm.sessions, tm.longest_s, tm.has_manual,
               pe.period_name, pe.entry_time, pe.exit_time, pe.event_type_1, pe.initial_status,
               pe.touched_after_run
        FROM tm
        FULL OUTER JOIN pe ON pe.employee_id = tm.employee_id AND pe.work_date = tm.work_date
      ) j
      JOIN public.employees e ON e.id = j.employee_id
      WHERE e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                     WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ORDER BY j.work_date, e.display_name;
    `,
  });
}

export default loadTeramindVsPayroll;
```

## Acceptance

1. Only the ten files above were created or changed.
2. The migration applied; `teramind_sessions` has columns `source` and `is_manual`,
   `teramind_pull_log` has `source`; existing rows read `login_session`.
3. Each file matches the content above exactly.
