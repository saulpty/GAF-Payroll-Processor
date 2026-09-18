# 01 — One shared refresh interval for every external-data copy: Monday boards + Teramind roster

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…`, `src/actions/…` means `actions/…`, `src/migrations/…` means
`migrations/…`. Never create a top-level folder named `src`.**

## Files that may change

- `src/migrations/1782011000_sync_every_minutes.sql` — NEW, content below, character for character (apply it)
- `src/actions/loadSyncLog.ts` — NEW (you write it: `SELECT * FROM sync_log ORDER BY ran_at DESC LIMIT 200`, no params beyond the house `manager` no-op)
- `src/actions/upsertSyncLog.ts` — NEW (you write it: one `INSERT INTO sync_log (kind, ran_by, created, updated, error) VALUES (...)`, flat params)
- `src/actions/claimSyncRun.ts` — NEW (you write it: the DB-level lock described in section 3a)
- `src/app/components/MondayAutoSync.tsx` — NEW (you write it, section 3)
- `src/app/components/TeramindAutoSync.tsx` — smallest edit: read `sync_every_minutes` first, fall back to `teramind_sync_every_minutes` (section 4)
- `src/app/components/AccessAutoSync.tsx` — smallest edit: same fallback (section 4)
- `src/app/app.tsx` — smallest edit: import `MondayAutoSync` and render `<MondayAutoSync />` on the
  line directly after the existing `<TeramindAutoSync />`. Touch nothing else in this file.
- `src/app/pages/admin/employees/syncDirectory.ts` — smallest edit: `askCandidates` gets one new
  caller-supplied mode (section 2); the function body's matching/writing logic does not change.
- `src/app/pages/admin/employees/MondayTab.tsx` — the muted status line + weekly created count
  (section 5). This is the only page-level file that may change.

No other file may be touched. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything
under `src/components/ui/`. No page under `pages/` other than `MondayTab.tsx`.

## Why

Two auto-sync components already exist (`AccessAutoSync`, `TeramindAutoSync`), each polling on its
own schedule while a super user has the Hub open. The owner wants **one** shared setting —
`sync_every_minutes`, default 15 — and wants that same "keep it fresh automatically" treatment
extended to the four Monday boards (directory, requests, attendance_forms, contracts) and the
Teramind roster, which today only update when someone clicks "Sync Now" on the Monday tab. Manual
buttons stay; they just stop being the only way data moves. New employees the Directory sync finds
are created silently — Monday's board already decided who counts as an employee — with a count shown
in Admin so a human can still notice when it happens.

## 1. Migration — verbatim

```sql
-- One shared auto-sync interval for every keep-fresh timer (Access groups, Teramind, and now the
-- four Monday boards + Teramind roster). Existing timers keep working off their own key until they
-- switch over in code; this migration only adds the new key and a small run log.

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES (
  'sync_every_minutes',
  '15',
  'Data refresh interval (minutes)',
  'How often the Hub refreshes its saved copies of external data (Monday boards, Teramind roster, Teramind time records, Access groups) while a super user has it open. Minimum 5.',
  'number',
  'teramind'
)
ON CONFLICT (key) DO NOTHING;

UPDATE classification_config
SET description = description || ' Superseded by sync_every_minutes.'
WHERE key = 'teramind_sync_every_minutes'
  AND description NOT LIKE '%Superseded by sync_every_minutes%';

CREATE TABLE IF NOT EXISTS sync_log (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       TEXT NOT NULL,               -- 'directory' | 'requests' | 'attendance_forms' | 'contracts' | 'teramind_roster'
  ran_at     TIMESTAMPTZ DEFAULT NOW(),
  ran_by     TEXT,                        -- viewer email, or 'auto'
  created    INT DEFAULT 0,               -- e.g. new employees created (directory only)
  updated    INT DEFAULT 0,
  error      TEXT
);

-- ROLLBACK
-- DROP TABLE IF EXISTS sync_log;
-- UPDATE classification_config SET description = replace(description, ' Superseded by sync_every_minutes.', '') WHERE key = 'teramind_sync_every_minutes';
-- DELETE FROM classification_config WHERE key = 'sync_every_minutes';
```

## 2. `syncDirectory.ts` — silent-create mode

`DirectoryDeps.askCandidates` today always shows the "Add unmatched Monday employees?" dialog and
waits for a human to pick. Add a way for a caller to skip the dialog and create every candidate:

- Change the type to accept either the existing dialog function, **or** the literal string
  `'auto'`. When `deps.askCandidates === 'auto'`, `syncDirectory` creates all `newCandidates`
  directly (same `upsertEmp` call it already makes for the dialog's selection) instead of calling a
  function and waiting on a Promise.
- `MondayTab.tsx`'s manual "Sync Now" path keeps passing the dialog function — nothing about the
  human-triggered flow changes.
- `syncDirectory`'s return value gains one field: `createdCount` is already computed internally: it
  becomes `created` on `SyncResult` so callers (including the new auto-sync) can log it.
  `SyncResult` lives in `mondaySync.ts` — add the optional field there (`created?: number`), don't
  remove or rename `items`/`matched`/`unmatched`.

## 2b. Silent create needs two brakes

`upsertEmployee` is `ON CONFLICT (teramind_email) DO UPDATE`, so two tabs racing cannot produce two
rows for the same email. The real duplicate risk is different: a candidate is anyone in the Monday
*Current Employees* group whose email `deps.resolve` could not match and that is not already a
`teramind_email` in `deps.emps`. When an existing employee's Monday email column differs from their
stored `teramind_email` — which is exactly why `loadNameAliases` exists — the human dialog is what
catches it today. Silent creation would file that person a second time, with `active: true` and
`excluded_from_payroll: false`, i.e. straight into payroll. So in `'auto'` mode only:

- Skip any candidate whose `name` case-insensitively matches an existing `display_name` in
  `deps.emps`. Count the skips.
- If more than **3** candidates survive in one run, create **none** of them and return the run as an
  error (`error: 'N candidates need review'`) so the `sync_log` row and the Monday tab show it.
  A Monday board does not gain four people in fifteen minutes; that many means something broke.

Both brakes live in the `'auto'` branch. The human "Sync Now" path keeps today's behaviour exactly.

## 3a. A database-level claim, not just a per-tab flag

`let inFlight` is per browser tab. Every super user with the Hub open runs their own copy, and the
`sync_log` "is it due?" row is only written **after** a run finishes — a full four-board Monday sync
takes far longer than the 60-second tick, so two tabs will routinely both see "due" and both start.
That is 8 board pulls against Monday's complexity budget instead of 4, and two directory syncs
writing `employees` at once. Claim the run in the database first:

`claimSyncRun.ts` — one statement, flat params, returns the inserted rows (zero rows = someone else
has it):

```sql
INSERT INTO sync_log (kind, ran_by, created, updated, error)
SELECT {{params.kind}}::text, {{params.ranBy}}::text, 0, 0, 'running'
WHERE NOT EXISTS (
  SELECT 1 FROM sync_log
  WHERE kind = {{params.kind}}::text
    AND ran_at > NOW() - ({{params.intervalMinutes}}::int * INTERVAL '1 minute')
)
RETURNING id;
```

`MondayAutoSync` runs a board only when `claimSyncRun` returns a row, and afterwards `upsertSyncLog`
records the outcome — so `upsertSyncLog` becomes an `UPDATE sync_log SET created, updated, error
WHERE id = {{params.id}}` rather than a second `INSERT` (keep the file, keep the name, change the
statement). This replaces the "read `loadSyncLog`, compare `ran_at`" check in section 3 for deciding
whether to run; `loadSyncLog` is still what section 5's status line reads. The roster's
once-per-calendar-day rule is the same claim with `intervalMinutes` set to the minutes remaining in
the day — or simply claim with 1440 and keep the `ran_at` date comparison as a second check.

## 3. `src/app/components/MondayAutoSync.tsx` — you write this

Renders nothing (`return null`). Model: `TeramindAutoSync.tsx` for the timer/config/in-flight shape,
`MondayTab.tsx` for which functions to call and how their deps are built.

- Runs **only when `useViewer().isSuper` is true**. Everyone else: no action call, no timer.
- Interval: `sync_every_minutes` from `loadClassificationConfig`, default 15, minimum 5 (same
  parsing as `TeramindAutoSync`).
- Check on mount and then every 60 seconds; skip the tick when `document.hidden` is true.
- A **module-level** `let inFlight = false` — only one sync (of any kind) runs at a time across both
  auto-sync components isn't required, but within `MondayAutoSync` itself only one run at a time.
  Set before starting, clear in `finally`.
- "Have we synced recently enough?" reads `loadSyncLog` (the new action): for each `kind` in
  `directory`, `requests`, `attendance_forms`, `contracts`, find the newest row with no `error`; if
  it's older than the interval (or missing), that board is due. Run due boards in that fixed order —
  directory, requests, attendance_forms, contracts — one at a time, each awaited before the next
  starts, using the **same functions `MondayTab.tsx` builds them from**:
  `syncDirectory` (from `syncDirectory.ts`), `syncRequests` (from `syncRequests.ts`),
  `syncAttendanceForms` (from `syncAttendanceForms.ts`), `syncContracts` (from `syncContracts.ts`).
  Build each call's deps the same way `MondayTab.tsx`'s `onSyncDirectory`/`onSyncRequests`/
  `onSyncAttForms`/`onSyncContracts` do (same actions: `loadClassificationConfig`,
  `loadAllEmployees`, `loadNameAliases`, `pullMondayBoard`, `updateEmployeeRoleManager`,
  `updateEmployeeFlag`, `upsertEmployee`, `updateEmployeeStartDate`, `upsertMondayRequests`,
  `upsertMondayAttendanceForms`, `upsertMondayContracts`, `updateMondayRequestsDeleted`,
  `updateMondayAttendanceFormsDeleted`, `updateMondayContractsDeleted`), except:
  - `askCandidates: 'auto'` (silent create — section 2), not the dialog.
  - After each board's sync (success or failure), write one row to `sync_log` via `upsertSyncLog`:
    `kind` = the board key, `ran_by: 'auto'`, `created`/`updated` from the result where available
    (0 otherwise), `error`: the caught message or `''`.
  - A board's sync failing must not stop the other three from being attempted this tick.
  - Directory's `syncDirectory` also drives the access-groups sync today (`useAccessSync`) — call
    that too, same as `MondayTab.tsx` does, best-effort (its own failure doesn't block anything).
- Teramind roster (`useTeramindPull().syncAgents`) runs **at most once per calendar day**: guard by
  the newest `sync_log` row with `kind = 'teramind_roster'` and no error — if its `ran_at` is today
  (compare as a date, not a 24h window), skip. Otherwise run it after the four Monday boards, and log
  the result the same way (`kind: 'teramind_roster'`, `created: 0`, `updated: result.linked`).
- Never throws into React, never shows UI: wrap each board/roster call in try/catch,
  `console.warn('Monday/roster auto-sync (<kind>) failed:', e)`, log the error row, move on.
- No date/time arithmetic beyond `Date.now()` comparisons and one calendar-day comparison for the
  roster guard; use the same date-string approach `easternDate`/`toLocalYMD` uses elsewhere — never
  `new Date(str)` for comparing YMD strings, only for comparing real timestamps like `ran_at`.

## 4. `TeramindAutoSync.tsx` and `AccessAutoSync.tsx` — smallest edit

`AccessAutoSync.tsx` currently has no interval read at all (it syncs once on mount). Give it the same
config lookup `TeramindAutoSync` has — read `sync_every_minutes`, fall back to
`teramind_sync_every_minutes` if the new key is missing (both default to 15, minimum 5) — and apply
the same "don't re-run inside the interval" check `TeramindAutoSync` already does, using
`useAccessSync`'s own last-run signal if it exposes one, otherwise a module-level timestamp set after
each successful `sync(false)` call. Do not change `AccessAutoSync`'s sync call itself or its
super-user gating if it has none today — only add the interval-aware re-run behavior.

In `TeramindAutoSync.tsx`, change only the config lookup: try `sync_every_minutes` first, and if that
key is absent from the config rows, fall back to `teramind_sync_every_minutes`. Same default (15) and
minimum (5). Nothing else in this file changes.

## 5. `MondayTab.tsx` — status line + weekly count

Below the four `MondaySyncCard`s (same place the "N employees · N aliases loaded" line already sits),
add:

- A muted, small line: **"Data Updates Every 15 Minutes · Last Run `<time>` · Sync Now still
  available"** — the "15" is the live `sync_every_minutes` value (from `loadClassificationConfig`,
  already loaded in this file), not a hardcoded string; `<time>` is the newest `ran_at` across all
  `sync_log` rows with no error, formatted the same way `MondaySyncCard`'s `fmtDate` does (reuse that
  formatting logic, don't duplicate a second date formatter — export it from `MondaySyncCard.tsx` if
  it isn't already exported, or inline the same `toLocaleString` call).
- **"N new employees created by sync this week"** — count of `sync_log` rows where
  `kind = 'directory'`, `ran_by = 'auto'`, `ran_at >= now() - interval '7 days'`, summed `created`.
  Compute this in `loadSyncLog`'s existing rows client-side (no new action) or add the aggregation to
  `loadSyncLog` itself, whichever keeps `loadSyncLog` simplest — your call, but don't add a second
  load action for it.

Both lines are informational only — no new buttons, no change to the four `MondaySyncCard`s
themselves.

## Rules

Every file under 15 KB · action params always **flat** · no hardcoded Monday board/column/group ids
(all come from `cfg`, already the case in the sync functions) · `loadSyncLog`/`upsertSyncLog` take
the house `manager` param even though unused, per the one-action-per-file convention · this work
never touches `payroll_entries` and never runs for a manager (`RequireSuper` already gates the
Employees page; `MondayAutoSync` also checks `isSuper` itself, same belt-and-suspenders as
`TeramindAutoSync`).

## Acceptance (check on /dev, signed in as a super user)

1. Only the files listed above changed; `app.tsx` differs by one import line and one JSX line.
2. Within about one `sync_every_minutes` interval of opening any page, `sync_log` has a row for
   `directory`, `requests`, `attendance_forms`, and `contracts`, each with no `error`.
3. The Directory board's silent-create path does not change the count of active employees beyond
   what the Monday board's Current Employees group actually contains — i.e. no duplicate or spurious
   creations; a re-run within the interval does not create a second `sync_log` row per kind.
4. Admin → Rules & Config shows `sync_every_minutes` (default 15) and `teramind_sync_every_minutes`
   now reads "superseded by sync_every_minutes" in its description.
5. Admin → Employees → Monday tab shows the "Data Updates Every 15 Minutes · Last Run …" line and the
   weekly created-by-sync count, both reading live values, not placeholders.
6. With "View As" set to a manager, `MondayAutoSync` makes no action calls at all.

## Guard idea (do not write the test — flagging for a future `lessonGuards.test.ts` addition)

`MondayAutoSync.tsx` should contain the string `isSuper`, the string `document.hidden`, and a
module-level in-flight flag declaration (`let inFlight`) — the same three tells
`AccessAutoSync.tsx`/`TeramindAutoSync.tsx` carry, so a future edit that silently drops the
super-user gate, the hidden-tab check, or the overlap guard is easy to catch by name.
