# 10 — AGENTS.md: document the Teramind saved copy

**Inside this project the code root *is* `src`; `AGENTS.md` is the file at the project root that you
read before every change.**

## Files that may change

- `AGENTS.md` — **append** the section below at the very end of the file, exactly as written.

No other file may be touched. Do not rewrite, reorder or "refresh" any existing part of `AGENTS.md`.
One correction inside the existing text is allowed and required: wherever `AGENTS.md` describes the
Process Payroll run as *requiring* an uploaded Teramind CSV/XLSX, add the words
"(or punches captured from the Teramind API — see *Teramind saved copy* below)". Change nothing else.

## Section to append

```md
---

## Teramind saved copy (added 2026-09-17)

Payroll's punches used to come only from a file exported from Teramind's **Time Records** screen.
The Hub now pulls those same records itself, keeps them, and payroll can capture a period from them.
The uploaded file remains as a backup path and must keep working.

**Source of truth for punches = Teramind Time Records**, `POST /tt/r/time-records/grid` on the
`'Teramind API'` datasource (`loadTeramindTimeRecords`): live for today, filtered by an `agents`
array, `pageSize` up to 5000, exact instants in `period: [startEpochSec, endEpochSec]`.
**Never use the `login_session` analytics feed for payroll or attendance** — people stay logged in
for days; it matched payroll on 33% of days, Time Records on 96–99.6%
(`docs/findings/2026-09-17-teramind-api-vs-past-periods.md` in the git mirror).
`loadTeramindLoginSessions` exists only as a diagnostic toggle on the comparison screen.

### Tables (never deleted from — no `DELETE` in any Teramind action)
- `teramind_agents` — `agent_id` PK, `employee_id` (nullable), `email`, `name`, `deleted`,
  `linked_by` (`'auto'` or a person; a hand-made link is never overwritten by the matcher).
  **Many agents → one employee.** Former employees and deleted Teramind accounts are linked on
  purpose, so history compares fully.
- `teramind_sessions` — one row per record: `agent_id`, `employee_id`, `work_date` (US-Eastern date of
  the record **start**; a record that crosses midnight stays on its start date), `started_et`,
  `finished_et` (`YYYY-MM-DD HH:MM:SS` US-Eastern wall-clock text, no timezone), `started_raw`,
  `duration_s`, `computer`, `source` (`time_record` | `login_session`), `is_manual`, `raw`.
  Unique `(agent_id, started_raw, computer)`; the upsert de-duplicates each batch with `DISTINCT ON`
  because Teramind can return one row twice.
- `teramind_pull_log` — one row per pull, success or failure, with `source` and `trigger`
  (`manual` | `backfill` | `capture`).

### Rules
- **Time conversion lives in `app/lib/teramindTime.ts` and nowhere else** (`sessionClock`). It is the
  only timezone conversion in the app. Everything stored and displayed is US-Eastern wall-clock text.
- **Read Teramind-derived times as integers.** The data layer rewrites date-looking TEXT into ISO
  timestamps on its way to the browser, so loaders return `YYYYMMDD` ints and minutes-since-midnight
  ints (`loadTeramindPunchDays`, `loadTeramindVsPayroll`). Slice `work_date`-like values to 10 chars.
- **Punches handed to payroll are cut to the whole minute, never rounded** (`punchDaysToRawRows` in
  `app/lib/teramindPunches.ts`) — the export file only ever carried minutes.
- **Only `app/pages/admin/teramind/useTeramindPull.ts` may import the Teramind HTTP actions.** Pulls
  are super-user only. Managers never call Teramind; they read the saved copy through loaders scoped
  with `v_employee_access` (`loadTeramindSessions`, `loadTeramindPunchDays`, `loadTeramindVsPayroll`).
- **Payroll capture always runs as the real signed-in super user** — `TeramindSourceCard` passes
  `viewAs: ''` on purpose. Do not "fix" it to use `useViewer().viewAs`.
- `ProcessPayroll.tsx` must never be able to run the engine on empty or stale `teramindRows`: the
  capture card is disabled during the `mapping` / `warnings` states, and `handleRun`,
  `handleMappingSave` and *Proceed Anyway* each refuse when `teramindRows.length === 0`.
- No Teramind host name in code; no hardcoded agent ids.

### File map
- Libs (pure, `import type` only): `teramindTypes.ts`, `teramindTime.ts`, `teramindRows.ts`
  (`normalizeTimeRecord`, `linkAgents`), `teramindPull.ts` (`recordWindow`, `inDateRange`,
  `coversRange`), `teramindPunches.ts` (`punchDaysToRawRows`), `teramindCompare.ts`.
- Admin → Employees → **Teramind** tab: `app/pages/admin/teramind/` — roster sync + links, pull /
  backfill, pull log, **Teramind vs Payroll** comparison (read-only).
- Process Payroll step 2: `app/pages/process/TeramindSourceCard.tsx` (Capture From Teramind / Use
  Saved Copy); the upload zone under it is the backup.
```

## Acceptance

1. Only `AGENTS.md` changed.
2. The new section is at the end of the file, exactly as above.
3. Apart from the one added parenthesis about the uploaded file, no existing line changed.
