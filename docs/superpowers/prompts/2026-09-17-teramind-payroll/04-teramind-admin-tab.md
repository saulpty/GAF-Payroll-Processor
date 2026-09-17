# 04 — Admin → Employees: Teramind tab (roster sync + login-session pull)

## Files that may change

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/pages/admin/…` means `app/pages/admin/…` — next to the existing `AdminEmployeesHub.tsx`.
Never create a top-level folder named `src`.**

- `src/app/pages/admin/teramind/useTeramindPull.ts` — NEW
- `src/app/pages/admin/teramind/TeramindAgentsCard.tsx` — NEW
- `src/app/pages/admin/teramind/TeramindPullCard.tsx` — NEW
- `src/app/pages/admin/teramind/TeramindTab.tsx` — NEW
- `src/app/pages/admin/AdminEmployeesHub.tsx` — one small edit: add a "Teramind" tab

No other file may be touched. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`,
or anything under `src/components/ui/`.

## Why

Saul needs an admin screen to link Teramind login accounts to our ~45 employees and pull
raw login-session history for payroll's future use. One more tab on the existing
Admin → Employees page, same "sync card" look as Monday. All SQL/HTTP actions and pure
libraries this needs already exist — build only the four new files plus the tab addition.

## Already built — import, do not recreate

Actions (`src/actions/`, each takes flat params, never a `{ params: {} }` wrapper):
- `loadTeramindAgentDirectory()` — no params, HTTP, whole-company roster (~937 agents)
- `loadTeramindLoginSessions({dateFrom, dateTo})` — HTTP, whole-company login sessions for
  the range (~500/day), hard-capped at 50,000 rows
- `loadTeramindAgents()` — no params, SQL, saved agents incl. `employee_id`, `employee_name`, `linked_by`
- `loadTeramindPullLog()` — no params, SQL, last 50 pull-log rows
- `upsertTeramindAgents({rows})` — `rows = JSON.stringify(chunk)`; each row needs
  `agent_id, email, name, deleted, raw`
- `updateTeramindAgentLinks({rows, linked_by})` — bulk-links agents whose `linked_by` is
  null or `'auto'`; `rows = JSON.stringify([{agent_id, employee_id}, …])`
- `updateTeramindAgentLink({agent_id, employee_id, linked_by})` — single link/unlink
  (pass `employee_id: ''` to unlink)
- `upsertTeramindSessions({rows})` — `rows = JSON.stringify(chunk)`; each row needs
  `agent_id, work_date, started_et, finished_et, started_raw, duration_s, computer, raw`
- `upsertTeramindPullLog({date_from, date_to, pulled_by, trigger, agent_count, row_count, saved_count, truncated, error})`
  — `error: ''` when none
- `loadAttendanceEmployees({viewAs})` — existing, already scoped to the viewer and
  active-only; use for the employee list, returns `id` and `email` (the Teramind email)

Libraries (`src/app/lib/`, pure, do not modify):
- `teramindRows.ts` — `unwrapRows(resp)`, `normalizeAgent(row)`, `linkAgents(agents, employees)`,
  `normalizeSession(row, sessionClock)`
- `teramindTime.ts` — `sessionClock(raw, durationS)`; pass this exact function as the second
  arg to `normalizeSession`, never format/parse a Teramind timestamp any other way
- `teramindPull.ts` — `pullChunks(from, to, maxDays=7)`, `isTruncated(rowCount, limit)`,
  `coversRange(log, from, to)`
- `teramindTypes.ts` — `TeramindAgent`, `TeramindSessionSave`, `PullChunk` (import type only)

All already exist in the repo. If any import fails to resolve, stop and report it — do not
recreate the file.

## 1. `useTeramindPull.ts`

Same imperative-call pattern as `src/app/pages/admin/access/useAccessSync.ts`:
`const [fetchX] = useMutateAction(xAction)`, then `await fetchX({...flatParams})`. Get the
signed-in viewer from `useViewer()` (`src/app/context/ViewerContext.tsx`) for `pulled_by`.
Exposes `{ syncAgents, pullRange, syncing, pulling, error }` where:

```
syncAgents: () => Promise<{ agents: number; linked: number; unlinked: number }>
pullRange: (from: string, to: string, trigger: 'manual' | 'backfill') =>
  Promise<{ fetched: number; saved: number; dropped: number; truncated: boolean }>
```

`syncAgents()`:
1. `unwrapRows(await fetchDirectory({}))`, map through `normalizeAgent`, drop nulls.
2. Call `loadTeramindAgents({})` first to know which `agent_id`s are already linked
   (non-null `employee_id`). Keep a directory row if `!deleted` OR it's already linked.
3. Attach `raw: <original directory row>` to each kept agent; save via `upsertTeramindAgents`
   in chunks of 200.
4. `loadAttendanceEmployees({ viewAs })` (`viewAs` from `useViewer()`, passed flat like every other caller) for the ~45 active employees.
5. `linkAgents(keptAgents, employees.map(e => ({ id: e.id, teramind_email: e.email })))`.
6. `updateTeramindAgentLinks({ rows: JSON.stringify(links), linked_by: 'auto' })`.
7. Return `{ agents: keptAgents.length, linked: links.length, unlinked: unlinkedEmployees.length }`.

`pullRange(from, to, trigger)`:
1. If `loadTeramindAgents({})` has zero rows with a non-null `employee_id`, throw a
   plain-language error ("Sync the roster and link at least one employee before pulling.")
   without calling the Teramind API.
2. For each chunk from `pullChunks(from, to)`: `loadTeramindLoginSessions({ dateFrom: chunk.from, dateTo: chunk.to })`,
   `unwrapRows`, add to `fetched`, and OR the chunk's `isTruncated(count, 50000)` into `truncated`.
3. For each row: `normalizeSession(row, sessionClock)`; drop nulls; keep only rows whose
   `agent_id` is in the linked set from step 1 — everything else counts toward `dropped`.
4. Attach `raw: <original row>` to each kept session; save via `upsertTeramindSessions` in
   chunks of 200; `saved` = total rows sent across all chunks.
5. On success: exactly one `upsertTeramindPullLog` call for the whole range (not per chunk):
   `{ date_from: from, date_to: to, pulled_by, trigger, agent_count: <linked-agent count>, row_count: fetched, saved_count: saved, truncated, error: '' }`.
6. On any thrown error: still call `upsertTeramindPullLog` with the same shape,
   `saved_count: 0`, `error: <message>` (best-effort, like `MondaySyncCard` logs its own
   failures), then rethrow so the card can show it.

## 2. `TeramindAgentsCard.tsx`

A "Sync Teramind Roster" button calling `syncAgents()`. Below it, two counters: Linked
Employees / Employees With No Agent, computed by joining `loadTeramindAgents()` with
`loadAttendanceEmployees({ viewAs })` in this component. List each active employee with
no linked agent: name, a dropdown of unlinked non-deleted agents (`name (email)`), and a
Link button calling `updateTeramindAgentLink({ agent_id, employee_id, linked_by: <viewer email or name> })`.
For an employee whose agent was linked by a human (`linked_by` not `'auto'` and not null),
show an Unlink control calling `updateTeramindAgentLink({ agent_id, employee_id: '', linked_by: '' })`.
Match `MondaySyncCard.tsx`'s visual pattern (Card/CardHeader/CardContent from
`@/components/ui/card`, `Button`, `Badge`, counters grid) but do not import it — its
`onSync`/`SyncResult` shape and internal `upsertMondaySyncLogAction` call are wired to the
Monday sync-log table, not Teramind's. Write this card's own shell.

## 3. `TeramindPullCard.tsx`

A period picker using the existing `loadPeriods` action, or custom From/To date inputs
(`YYYY-MM-DD` text, compared as strings — never `new Date(str)` for date math). A "Pull"
button calls `pullRange(from, to, 'manual')`. A "Backfill All Periods" button loops every
period oldest→newest (a period's range is `String(start_date).slice(0,10)` → `String(end_date).slice(0,10)`;
ignore periods missing either date): skip when `coversRange(pullLogRows, from, to)` is true,
else call `pullRange(from, to, 'backfill')`; show which period is running and
a running total. After any pull show sessions fetched / saved / dropped (dropped = unlinked
agent), and if `truncated`, warn the range likely holds over 50,000 sessions and should be
pulled in smaller chunks.

## 4. `TeramindTab.tsx`

Shell: `<TeramindAgentsCard />`, `<TeramindPullCard />`, then a table from
`loadTeramindPullLog()` (when, range, by, trigger, fetched, saved, error), then one line:
"Teramind data is complete through yesterday." No new access gate — this page is already
behind `RequireSuper` at the router level, same as the rest of Admin.

## 5. `AdminEmployeesHub.tsx` — smallest edit only

Add a fourth entry to the `Tab` union and the `TABS` array — `{ id: 'teramind', label: 'Teramind', icon: <a lucide icon not already used in this file, e.g. Clock> }` —
import `TeramindTab` from `./teramind/TeramindTab`, and render it when `tab === 'teramind'`.
Touch nothing else in this file.

## Rules

- Every file under 15 KB.
- `useLoadAction(action, default, {...flatParams})` — never `{ params: {...} }`; every
  action call here passes params flat, exactly as shown above.
- Dates are `YYYY-MM-DD` strings, compared as strings. "Today" is `toLocalYMD(new Date())`
  from `classificationEngine` — never `toISOString().slice(0,10)`.
- All Teramind time conversion goes through `sessionClock` — nowhere else in these files.
- No hardcoded URLs, ids, or the literal string `teramind.co` anywhere in these files.
- Title Case labels ("Sync Teramind Roster", "Backfill All Periods", etc).
- One coherent change: these five files only.

## Acceptance (check on /dev)

1. Admin → Employees shows a "Teramind" tab next to Roster, Monday, Aliases.
2. Running "Sync Teramind Roster" once shows roughly 45 linked employees, 0 unlinked.
3. Pulling 2026-08-10 → 2026-08-24 saves roughly 45 employees × 11 work days of sessions
   and writes exactly one row to the pull log.
4. Pulling the same range again does not create duplicate session rows.
5. "Backfill All Periods" skips any period `coversRange` already reports as covered.
6. `git status --short` after export shows only the five files listed above.

Do not build anything else.
