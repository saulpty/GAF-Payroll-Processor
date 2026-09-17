# Probe: what does the Teramind API datasource actually return?

**This is a read-only investigation. Change no existing file. Apply no migration. Write nothing to
any database.** You may create **exactly one** temporary file, `src/actions/zzProbeTeramind.ts`, if
(and only if) you need an action in order to call the HTTP datasource. It will be deleted by the
next prompt. No other file may be created, modified or deleted.

If you create it, it must be a dumb transport and nothing else:

```ts
import { action } from '@uibakery/data';

function zzProbeTeramind() {
  return action('zzProbeTeramind', 'HTTP', {
    datasourceName: '<the Teramind datasource name — question 1>',
    options: {
      method: {{params.method}},
      url: {{params.url}},
      queryParams: {{params.queryParams}},
      bodyType: 'object',
      body: {{params.body}},
    },
  });
}

export default zzProbeTeramind;
```

Do not import it anywhere. Do not add it to any page.

## Why this is being asked

Payroll currently gets its punches from a Teramind report that a person downloads and uploads. We
are going to fetch the same information from the Teramind API instead. A Teramind HTTP datasource was
connected to this app on 2026-09-17. Before any design is locked we need to know the exact shapes it
returns — especially **timestamps**, because payroll refuses any time that carries a timezone, and a
wrong hour changes what people are paid.

Another app in this workspace ("Work Pattern Monitor") already uses the same API through a
datasource it calls `'Teramind API'`, with these calls: `GET /v1/agents`, and `POST /wip/tma-query`
with a `cube` of `login_session` or `activity`.

## What to report

Keep answers short: shapes, counts and two or three sample rows each — not data dumps.

1. **Datasource name.** List every datasource connected to this app and the exact string a
   `datasourceName` field must contain for each. State the one exact string for the Teramind one.

2. **Agents.** `GET /v1/agents` with no `fields` filter.
   a. The full list of field names on one agent object.
   b. Which field holds the person's email address? Show three sample values.
   c. Total agents returned; how many are `deleted`.
   d. Run `SELECT id, display_name, teramind_email FROM employees WHERE active = true` on
      `GAF Planilla DB` and report: how many active employees match an agent by email
      (case-insensitive); how many match **more than one** agent (list them with the agent ids and
      agent names); how many match none (list them).

3. **Login sessions.** `POST /wip/tma-query` with body
   `{ cube: "login_session", timezone: "America/New_York", aggregate: false,
   dims: ["agent","date","timestamp","computer"], measures: ["time_s"],
   dim_filters: { date: { range: ["2026-08-10","2026-08-11"] } }, limit: 50000 }`
   a. Is the response a bare array or wrapped (e.g. `{ data: [...] }`)? Show three raw rows exactly
      as returned.
   b. **The exact format of `timestamp`** — quote two values character for character. Does it carry
      `Z` or an offset like `-04:00`? Is `date` a plain `YYYY-MM-DD`? Is it the Eastern calendar day?
   c. What shape is `agent` in a row — a number, `[42]`, `[{id:42}]`, something else?
   d. Is `time_s` the length of the session in seconds? Largest value seen.
   e. Row count for those two days.
   f. Repeat with an agent filter added to `dim_filters`, trying in turn
      `agent: { in: [<one real agent id as a number>] }`, the same id as a string, and
      `agent: { in: [] }`. For each: row count, or the error. (The other app's author noted that an
      agent filter on this cube "silently returns 0 rows" — we need to know whether that is true.)

4. **Volume.** Same query as 3 without the agent filter, range `2026-08-10` → `2026-08-24`
   (one 15-day pay period). Row count only. Did it hit the 50,000 limit?

5. **How far back does the data go?** Same query for `2026-03-11` → `2026-03-12`, and for
   `2025-09-15` → `2025-09-16`. Row counts only.

6. **Smell test against payroll.** Pick one active employee who matched exactly one agent in 2d.
   For `2026-08-11`, `2026-08-12` and `2026-08-13`, report side by side:
   - from the API: the earliest `timestamp`, and the latest (`timestamp` + `time_s`), for that agent
     among rows whose `date` is that day;
   - from `GAF Planilla DB`:
     `SELECT work_date, entry_time, exit_time, period_name FROM payroll_entries
      WHERE employee_id = <id> AND LEFT(work_date,10) IN ('2026-08-11','2026-08-12','2026-08-13')
        AND deleted_at IS NULL`.
   Do not interpret or convert the times — quote both sides as returned.

7. **Scheduling.** Can this app run an action on a timer **with no browser open** (a scheduled job,
   automation, or server-side trigger available to this project)? Answer yes or no, and if yes name
   the feature and the shortest interval. Do not create one.

8. **Today's data.** Same query as 3 for today's date only. How recent is the newest `timestamp`
   compared with the current time? Does a session that is still in progress appear, and what does
   its `time_s` look like?

## Acceptance

1. No file other than (optionally) `src/actions/zzProbeTeramind.ts` was created, modified or deleted.
2. No migration was applied and nothing was written to any database.
3. Every numbered question has an answer, or a plain statement of what failed and the exact error.
4. Timestamps in 3b and 6 are quoted character for character.
