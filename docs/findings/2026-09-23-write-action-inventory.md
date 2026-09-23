# Write-action inventory — who can call each write, and where a lock would go

2026-09-23. Read-only research on branch `claude/deep-code-review-prep-88d684`. Nothing in `src/`
was changed. Follows up item 3 of `docs/findings/2026-09-22-deep-code-review.md` ("No write action
checks who is calling").

## Plain-language summary (for Saul)

- The app has **66 actions that change something**: 61 write to the main payroll database,
  4 write to the separate disciplinary database, and 1 talks to Monday.com.
- **Today none of them checks who is asking.** The app hides buttons and pages from managers,
  but the database itself would accept the request from anyone signed in.
- **61 of 66 should be "super users only".** No manager has a legitimate reason to call any
  of them. That includes the four that have no caller at all (dead code).
- **Managers legitimately do only two writes**: *Close Case* and *Reopen* on the Disciplinary
  page. Both run on the **disciplinary database**, which has no list of users, so the
  proposed database lock cannot protect them without extra work (see note 6).
- **5 cannot be checked** by the proposed lock: the 4 disciplinary writes and the Monday call.
- The lock that fits is one small database function, `assert_super(email)`, that **stops the
  save with an error** when the caller isn't an active super user. It never quietly does
  nothing.

## How to read the table

- **DB**: `P` = `GAF Planilla DB` (main database). `D` = `SAUL Disciplinary Action Forms DB`
  (the second database). `M` = `Monday.com API` (an HTTP call, not SQL).
- **Shape**: the kind of SQL statement. `INS-V` = `INSERT … VALUES`, `INS-S` = `INSERT … SELECT`,
  `OC-U` / `OC-N` = `ON CONFLICT DO UPDATE` / `DO NOTHING`, `jae` = batch rows read with
  `jsonb_array_elements({{params.rows}}::jsonb)`. No action uses `jsonb_to_recordset`.
  `CTE` = a `WITH x AS (UPDATE …)` in front of the main statement. `RET` = has `RETURNING`.
- **Gate**: why a non-super cannot reach the caller today. This is a browser-side gate only.
  - `RS` = the route is wrapped in `<RequireSuper>` in `src/app/app.tsx`: `/process`,
    `/action-required`, `/payroll-master`, `/period-log`, `/hrk-summary`, `/admin/*`
    (lines 47-49, 51, 65, 68).
  - `BG` = background sync that starts with `if (!isSuper) return;`
    (`MondayAutoSync.tsx:78`, `AccessAutoSync.tsx:20`, `TeramindAutoSync.tsx:26`).
  - `btn` = the page is open to managers but the button or dialog is only rendered when
    `isSuper` is true.
  - `OPEN` = a manager can reach it and press it.
- `isSuper` comes from `ViewerContext.tsx:74` and follows the *viewed-as* role. So a super
  user who is "viewing as" a manager sees the manager's UI. A database lock based on the real
  `{{ user.email }}` would still let that super user save. That is the right behaviour.
- Caller paths are relative to `src/app/`. Line numbers are the call line, or the
  `useMutateAction` line when the mutate function is handed to a helper.

## Inventory

| # | Action (`src/actions/…`) | DB | Shape | Callers (file:line) | Gate | Verdict |
|---|---|---|---|---|---|---|
| 1 | `claimSyncRun` | P | INS-S `WHERE NOT EXISTS`, RET | `components/MondayAutoSync.tsx:159, :254` | BG | SUPER-ONLY |
| 2 | `deleteAccessGroup` | P | DELETE | `pages/admin/access/GroupsTab.tsx:109`; `pages/admin/access/syncAccessFromMonday.ts:114` via `useAccessSync` | RS, BG | SUPER-ONLY |
| 3 | `deleteAccessGroupManager` | P | DELETE | `pages/admin/access/GroupsTab.tsx:111` | RS | SUPER-ONLY |
| 4 | `deleteAccessGroupMember` | P | DELETE | `GroupsTab.tsx:113`; `syncAccessFromMonday.ts:115` | RS, BG | SUPER-ONLY |
| 5 | `deleteAppUser` | P | DELETE; already has `u.email <> lower(btrim({{ user.email }}::text))` plus a last-super guard (silently 0 rows) | `pages/admin/access/UsersTab.tsx:53` | RS | SUPER-ONLY |
| 6 | `deleteDocumentationOption` | P | DELETE | `pages/admin/AdminLookups.tsx:448` | RS | SUPER-ONLY |
| 7 | `deleteEventType` | P | DELETE | `AdminLookups.tsx:438` | RS | SUPER-ONLY |
| 8 | `deleteEventTypeRule` | P | DELETE | `AdminLookups.tsx:544` | RS | SUPER-ONLY |
| 9 | `deleteHoliday` | P | DELETE | `pages/admin/AdminHolidays.tsx:44` | RS | SUPER-ONLY |
| 10 | `deleteLookup` | P | `DO $$` block with `RAISE EXCEPTION` and 3 DELETEs | **none (dead)** | — | SUPER-ONLY (dead) |
| 11 | `deleteNameAlias` | P | DELETE | `pages/admin/employees/AliasesTab.tsx:32` | RS | SUPER-ONLY |
| 12 | `deletePayImpact` | P | DELETE | `AdminLookups.tsx:443` | RS | SUPER-ONLY |
| 13 | `deletePeriod` | P | DELETE | `pages/PeriodLog.tsx:78` | RS | SUPER-ONLY |
| 14 | `deletePeriodEntries` | P | DELETE (hard delete of `payroll_entries`) | `PeriodLog.tsx:76` | RS | SUPER-ONLY |
| 15 | `deletePeriodSnapshots` | P | DELETE | `PeriodLog.tsx:77` | RS | SUPER-ONLY |
| 16 | `pullMondayBoard` | M | HTTP POST; the GraphQL `query` text comes from the browser | `components/MondayAutoSync.tsx:177, :195, :203, :211`; `pages/admin/access/useAccessSync.ts:64`; `pages/admin/employees/MondayTab.tsx:192, :211, :217, :223`; `pages/ProcessPayroll.tsx:307` | BG, RS | CANNOT-CHECK (not SQL) |
| 17 | `renamePeriod` | P | **4 UPDATE statements in one action** | `PeriodLog.tsx:110` | RS | SUPER-ONLY |
| 18 | `restorePayrollEntry` | P | UPDATE | `PeriodLog.tsx:127` | RS | SUPER-ONLY |
| 19 | `saveHrkExport` | P | INS-V | `pages/HrkSummary.tsx:147` | RS | SUPER-ONLY |
| 20 | `saveNameAlias` | P | INS-V OC-U | `AliasesTab.tsx:25`; `pages/admin/employees/UnmatchedList.tsx:103`; `ProcessPayroll.tsx:546` | RS | SUPER-ONLY |
| 21 | `saveRunSnapshot` | P | INS-V | `ProcessPayroll.tsx:372, :373, :374` | RS | SUPER-ONLY |
| 22 | `softDeletePayrollEntry` | P | UPDATE | `pages/PayrollMaster.tsx:347` | RS | SUPER-ONLY |
| 23 | `softDeleteStaleEntries` | P | UPDATE RET | `ProcessPayroll.tsx:512` | RS | SUPER-ONLY |
| 24 | `updateDisciplinaryActionClosed` | **D** | UPDATE `AND closed_at IS NULL` RET | `pages/disciplinary/CloseCaseDialog.tsx:44`, opened by the **Close Case** button in `ActionDetail.tsx` (not `isSuper`-gated); route `/disciplinary` has no `RequireSuper` | **OPEN** | CANNOT-CHECK — **manager-allowed by design** |
| 25 | `updateDisciplinaryActionDeleted` | **D** | UPDATE `AND deleted_at IS NULL` RET | `pages/disciplinary/DeleteActionDialog.tsx:46`; Delete buttons at `ActionDetail.tsx:121, :139` are `isSuper` only | btn | CANNOT-CHECK (UI says super only) |
| 26 | `updateDisciplinaryActionReopened` | **D** | UPDATE RET | `pages/disciplinary/ActionDetail.tsx:63`; **Reopen** link is not `isSuper`-gated | **OPEN** | CANNOT-CHECK — manager-reachable (the undo for Close) |
| 27 | `updateDisciplinaryActionRestored` | **D** | UPDATE RET | `ActionDetail.tsx:73`; Restore button gated at `:91` | btn | CANNOT-CHECK (UI says super only) |
| 28 | `updateEmployeeFlag` | P | UPDATE | `pages/admin/employees/RosterTab.tsx:65`; `pages/admin/employees/syncDirectory.ts:158` via `MondayAutoSync.tsx:176` and `MondayTab.tsx:198` | RS, BG | SUPER-ONLY |
| 29 | `updateEmployeeRoleManager` | P | UPDATE | `syncDirectory.ts:154`, via the same two paths | RS, BG | SUPER-ONLY |
| 30 | `updateEmployeeStartDate` | P | UPDATE keyed by `display_name` | `syncDirectory.ts:223`, via the same two paths | RS, BG | SUPER-ONLY |
| 31 | `updateMondayAttendanceFormsDeleted` | P | UPDATE with **no WHERE** (every row) | `pages/admin/employees/mondaySync.ts:152` via `MondayAutoSync.tsx:204`, `MondayTab.tsx:218` | RS, BG | SUPER-ONLY |
| 32 | `updateMondayContractsDeleted` | P | UPDATE, no WHERE | `mondaySync.ts:152` via `MondayAutoSync.tsx:212`, `MondayTab.tsx:224` | RS, BG | SUPER-ONLY |
| 33 | `updateMondayRequestsDeleted` | P | UPDATE, no WHERE | `mondaySync.ts:152` via `MondayAutoSync.tsx:196`, `MondayTab.tsx:212` | RS, BG | SUPER-ONLY |
| 34 | `updatePayrollEntry` | P | UPDATE | `pages/ActionRequired.tsx:220, :256`; `PayrollMaster.tsx:238, :303, :326` | RS | SUPER-ONLY |
| 35 | `updatePtoApproval` | P | UPDATE | `pages/pto/RecordApprovalDialog.tsx:187`; the dialog is mounted only when `isSuper` (`PtoTracker.tsx:103`); `/pto` is open to managers | btn | SUPER-ONLY |
| 36 | `updatePtoApprovalStatus` | P | UPDATE | `pages/pto/PtoBreakdown.tsx:147, :153`; Withdraw/Restore buttons inside `isSuper` at `PtoSubRow.tsx:114` | btn | SUPER-ONLY |
| 37 | `updatePunchTimes` | P | UPDATE | `ActionRequired.tsx:215`; `PayrollMaster.tsx:233` | RS | SUPER-ONLY |
| 38 | `updateTeramindAgentLink` | P | CTE(UPDATE agents) + UPDATE sessions | `pages/admin/teramind/TeramindAgentsCard.tsx:121, :134` | RS | SUPER-ONLY |
| 39 | `updateTeramindAgentLinks` | P | UPDATE … FROM jae (skips hand-made links on purpose) | `pages/admin/teramind/useTeramindPull.ts:98` (`syncAgents`) via `MondayAutoSync.tsx:267`, `TeramindTab.tsx:40` | BG, RS | SUPER-ONLY |
| 40 | `upsertAccessGroup` | P | CTE(UPDATE) + INS-S OC-N | `GroupsTab.tsx:99, :108`; `syncAccessFromMonday.ts:116` | RS, BG | SUPER-ONLY |
| 41 | `upsertAccessGroupManager` | P | INS-V OC-U | `GroupsTab.tsx:110`; `syncAccessFromMonday.ts:127` | RS, BG | SUPER-ONLY |
| 42 | `upsertAccessGroupMember` | P | INS-V OC-N | `GroupsTab.tsx:112`; `syncAccessFromMonday.ts:133` | RS, BG | SUPER-ONLY |
| 43 | `upsertAppUser` | P | CTE(UPDATE) + INS-S OC-U (**can promote anyone to `super_user`**) | `UsersTab.tsx:45`; `syncAccessFromMonday.ts:105, :111` | RS, BG | SUPER-ONLY — highest priority |
| 44 | `upsertClassificationConfig` | P | INS-V OC-U | `AdminLookups.tsx:551`; `pages/attendance/activity/ActivityThresholds.tsx:76`, which is mounted only when `isSuper` (`AttendanceActivity.tsx:115`); `/attendance/*` is open to managers | RS, btn | SUPER-ONLY |
| 45 | `upsertDocumentationOption` | P | INS-V OC-N | `AdminLookups.tsx:447` | RS | SUPER-ONLY |
| 46 | `upsertDstCalendar` | P | INS-V OC-U | `pages/admin/AdminDstCalendar.tsx:18` | RS | SUPER-ONLY |
| 47 | `upsertEmployee` | P | INS-V OC-U | `RosterTab.tsx:54`; `syncDirectory.ts:185, :200` via `MondayAutoSync` / `MondayTab` | RS, BG | SUPER-ONLY |
| 48 | `upsertEventType` | P | INS-V OC-N | `AdminLookups.tsx:437` | RS | SUPER-ONLY |
| 49 | `upsertEventTypeRule` | P | INS-V OC-U | `AdminLookups.tsx:523, :533` | RS | SUPER-ONLY |
| 50 | `upsertFloatingHoliday` | P | INS-V OC-U | **none (dead)** | — | SUPER-ONLY (dead) |
| 51 | `upsertHoliday` | P | INS-V OC-U | `AdminHolidays.tsx:21` | RS | SUPER-ONLY |
| 52 | `upsertLookup` | P | `DO $$` block with `RAISE EXCEPTION` and 3 INSERTs | **none (dead)** | — | SUPER-ONLY (dead) |
| 53 | `upsertMondayAttendanceForms` | P | INS-S jae OC-U | `mondaySync.ts:146` via `MondayAutoSync.tsx:204`, `MondayTab.tsx:218` | RS, BG | SUPER-ONLY |
| 54 | `upsertMondayContracts` | P | INS-S jae OC-U | `mondaySync.ts:146` via `MondayAutoSync.tsx:212`, `MondayTab.tsx:224` | RS, BG | SUPER-ONLY |
| 55 | `upsertMondayRequests` | P | INS-S jae OC-U | `mondaySync.ts:146` via `MondayAutoSync.tsx:196`, `MondayTab.tsx:212` | RS, BG | SUPER-ONLY |
| 56 | `upsertMondaySyncLog` | P | INS-V OC-U | `MondayAutoSync.tsx:232`; `useAccessSync.ts:68, :73`; `pages/admin/employees/MondaySyncCard.tsx:51, :62` | BG, RS | SUPER-ONLY |
| 57 | `upsertPayImpact` | P | INS-V OC-N | `AdminLookups.tsx:442` | RS | SUPER-ONLY |
| 58 | `upsertPayrollEntries` | P | INS-V OC-U, one row per call, fired in `Promise.all` batches | `ProcessPayroll.tsx:491` | RS | SUPER-ONLY |
| 59 | `upsertPeriod` | P | INS-V OC-U | `ProcessPayroll.tsx:529` | RS | SUPER-ONLY |
| 60 | `upsertPtoApproval` | P | INS-V OC-U (partial index) RET | `RecordApprovalDialog.tsx:199, :213` (dialog super-only, see #35) | btn | SUPER-ONLY |
| 61 | `upsertPtoEmployee` | P | INS-V OC-U | **none (dead)** | — | SUPER-ONLY (dead) |
| 62 | `upsertSchedule` | P | INS-V OC-U | `pages/admin/AdminSchedules.tsx:137` | RS | SUPER-ONLY |
| 63 | `upsertSyncLog` | P | UPDATE (despite the name) | `MondayAutoSync.tsx:225, :274` | BG | SUPER-ONLY |
| 64 | `upsertTeramindAgents` | P | INS-S jae OC-U | `useTeramindPull.ts:93` (`syncAgents`) | BG, RS | SUPER-ONLY |
| 65 | `upsertTeramindPullLog` | P | INS-V RET | `useTeramindPull.ts:186, :203` (`pullRange`) | BG, RS | SUPER-ONLY |
| 66 | `upsertTeramindSessions` | P | INS-S jae `DISTINCT ON … ORDER BY` OC-U RET | `useTeramindPull.ts:182` (`pullRange`) via `TeramindAutoSync.tsx:75`, `TeramindTab.tsx:40`, `pages/process/TeramindSourceCard.tsx:178` (also `isSuper`-gated at `:213`) | BG, RS | SUPER-ONLY |

`useAccessSync` is invoked from `AccessAutoSync.tsx:39` (BG), `MondayAutoSync.tsx:190` (BG),
`BuildFromMonday.tsx:26` and `MondayTab.tsx:200` (both under `/admin`, RS).

No `load*` or `count*` action contains `INSERT`, `UPDATE` or `DELETE`. The Teramind HTTP
actions (`loadTeramindAgentDirectory`, `loadTeramindTimeRecords`, `loadTeramindLoginSessions`)
only read.

### Counts

| Verdict | Count | Which |
|---|---|---|
| SUPER-ONLY | **61** | every `GAF Planilla DB` write, 4 of them dead (`deleteLookup`, `upsertLookup`, `upsertFloatingHoliday`, `upsertPtoEmployee`) |
| MANAGER-ALLOWED on `GAF Planilla DB` | **0** | the access-roles spec (`docs/superpowers/specs/2026-09-15-access-roles-design.md:31`) removes all manager edits except closing a disciplinary case |
| CANNOT-CHECK | **5** | `updateDisciplinaryActionClosed` and `updateDisciplinaryActionReopened` (both manager-allowed), `updateDisciplinaryActionDeleted`, `updateDisciplinaryActionRestored`, `pullMondayBoard` |

## Answers to the specific questions

### (a) How `{{ user.email }}` is used today

- The standard form is **`{{ user.email }}::text`**, with spaces inside the braces and an
  explicit cast. It is always either passed to `access_viewer(...)`, which lower-cases it, or
  wrapped in `lower(btrim(...))`.
- 20 loaders use `a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text)`
  (the scoped-loader pattern).
- `loadCurrentViewer.ts:7` uses `lower(btrim({{ user.email }}::text)) AS real_email`.
- `loadMondayAttendanceFormsRange.ts:24-27` has the only super check:
  `EXISTS (SELECT 1 FROM public.app_users u WHERE u.email = access_viewer(...) AND u.role = 'super_user' AND u.active)`.
  It uses the viewed-as identity. **Writes must use the real `{{ user.email }}`, never
  `access_viewer(..., viewAs)`.**
- `deleteAppUser.ts:9` is the only write that uses it: `u.email <> lower(btrim({{ user.email }}::text))`.
- `loadWhoAmI.ts:7` is the throwaway probe: `SELECT {{ user.email }} AS email` (no cast).
- SSO returns mixed case (`Saul.F@…`), so every comparison must lower-case it.
- **Still unverified**: that UIB fills in `{{ user.email }}` on the server, so a browser cannot
  send a different value (`docs/findings/2026-09-15-uib-identity-probe.md:13, :25-27`). Every
  database lock depends on this. It needs to be tested (look at the network payload of an
  action call) before we tell anyone the lock cannot be bypassed.

### (b) Fail loudly vs silently affect 0 rows

**Loud (the save stops with an error):**
- `deleteLookup` / `upsertLookup` have `RAISE EXCEPTION 'Invalid table name'` inside a
  `DO $$` block. These are the only `RAISE` statements in any action, and neither action has
  a caller.
- Constraint errors: unique indexes, the `NOT VALID` shape `CHECK` on `periods.period_name`,
  the `app_users.email` `CHECK (email = lower(btrim(email)))`, and the `role IN (...)` `CHECK`.
- Callers do surface a rejected promise. `CloseCaseDialog.tsx:45-47` shows `e.message`,
  `HrkSummary.tsx:159` shows an error banner, and an uncaught `await` in a click handler
  raises UIB's runtime-error banner. The background syncs `catch` and `console.warn`, so an
  error there is quiet, but they never run for a non-super anyway.
- Unverified: whether UIB passes the Postgres message text through. `src/AGENTS.md` records
  one failure that came back only as "Unknown error". A rejection is certain; the wording is
  not.

**Silent (0 rows, no error). Some are on purpose:**
- `claimSyncRun`: `WHERE NOT EXISTS` returns 0 rows when someone else already claimed the
  run. The caller reads "no id" as "skip".
- `deleteAppUser`: the self-delete and last-super guards return 0 rows. `UsersTab.tsx:55-57`
  finds out by re-reading the list.
- `updateDisciplinaryActionClosed` / `…Deleted`: `AND closed_at IS NULL` /
  `AND deleted_at IS NULL` return 0 rows on a second click. The callers ignore `RETURNING`
  and report success.
- `updateTeramindAgentLinks`: `AND (linked_by IS NULL OR linked_by = 'auto')` silently skips
  links made by hand.
- `ON CONFLICT DO NOTHING` in `upsertAccessGroup`, `upsertAccessGroupMember`,
  `upsertEventType`, `upsertPayImpact` and `upsertDocumentationOption`.
- Every `UPDATE … WHERE id = X` quietly does nothing when the id doesn't exist.

**Implication.** A guard written as `AND EXISTS (super check)` would follow the silent
pattern: a non-super's save would look successful. The owner does not want that. The guard
has to `RAISE`.

### (c) Do actions ever contain more than one statement?

- **Yes, one: `renamePeriod.ts`** has four separate `UPDATE` statements.
- `deleteLookup` / `upsertLookup` are a single `DO $$ … $$` statement containing several
  statements. The CTE actions (`upsertAppUser`, `upsertAccessGroup`,
  `updateTeramindAgentLink`) are single statements.
- **There is no evidence that `renamePeriod` has ever run successfully from the app.**
  Nothing in `docs/` records it running, and the one real rename (Q1-Aug-20260, 2026-09-10)
  was done by a migration.
- Unverified: whether UIB sends the four statements in one transaction, or accepts them at
  all. With bound parameters, Postgres refuses more than one command per prepared statement.
  The `DO $$` actions also put `{{params.x}}` inside a dollar-quoted body, which only works
  if UIB substitutes values as text.
- **So the lock must not rely on a separate leading `SELECT assert_super(...);` statement.**
  Put the check inside each write statement.

### (d) How a new SQL function would be added

- **File**: a new file under `src/migrations/`, named `<10-digit sequence>_<snake_name>.sql`.
  The latest is `1782012000_teramind_ghost_records.sql`, so the next would be something like
  `1782013000_assert_super.sql`.
- **Header**: date, what it creates, and a commented rollback line, following the pattern in
  `1782002000_access_roles.sql:1-7`.
- **Applying it**: the UIB prompt says "create this file with exactly this SQL, then apply
  it". UIB's AI runs it against the primary hosted datasource (`GAF Planilla DB`, per
  `datasources.yml` `vibeAppPrimaryHostedDatasourceId`). The run is recorded in
  `uib_migrations` (authoritative) and in the export's `applied.txt` (not reliable, and must
  not be hand-edited).
- **Verify** with `SELECT name FROM uib_migrations ORDER BY applied_at DESC LIMIT 1`.
- **Can an action call a user-defined function?** Yes. `access_viewer(text, text)` was
  created by migration `1782002000` and 20 actions call it.
- **Can it be plpgsql?** No plpgsql function exists yet; that one is `LANGUAGE sql`. But
  dollar-quoted plpgsql bodies have gone through UIB's migration runner before (`DO $$`
  blocks with `RAISE` in `1781803800`, `1781900200`, `1781986600` and `1782000100`), and
  `access_viewer` shows the connection role can `CREATE FUNCTION`. Nothing suggests plpgsql
  is blocked.
- **The disciplinary database is migrated by the other UIB app**, "GAF Disciplinary Actions
  Form" (see `docs/superpowers/prompts/2026-09-16-disciplinary-and-labels/00-form-app-deleted-columns.md`).
  A Hub migration never reaches it.

### (e) Callers that run with no signed-in user

- **None in the code.** Every write is started from a browser tab, through `useMutateAction`.
  There is no server-side job, UIB automation, webhook or cron in the export: `datasources.yml`
  and `src/` contain none.
- **The background syncs run inside a super user's open tab**, so `{{ user.email }}` is that
  super user's email. They also stop when `isSuper` is false: while loading, while viewing as
  a manager, and for managers.
- Places where `{{ user.email }}` could be empty or unexpected:
  1. Actions run from the UIB builder (the action editor's Run button, or UIB's AI testing an
     action) run as the builder user. That was Saul in the probe.
  2. If the app were ever made public or opened without SSO, it could be null. `AccessGate`
     blocks the UI in that case, but it does not block action calls.
- **`assert_super` must treat a null or empty email as "not allowed".**
- Migrations do not go through actions, so a lock does not affect them.

## Notes for whoever builds the lock

1. **Use `STABLE`, not `VOLATILE` or `IMMUTABLE`.** A `STABLE` function whose only argument
   is a constant (the substituted email) is a *pseudo-constant* condition. Postgres runs it
   once, in a gating step **before** scanning any row. So it raises even when the `WHERE`
   matches nothing, and even for an empty `jae` batch.
   - `IMMUTABLE` could be evaluated once when the query is planned and cached — wrong.
   - `VOLATILE` would be evaluated per row, after the other conditions — so an `UPDATE`
     that matched 0 rows would never call it.
2. **Where the guard goes, by shape:**
   - `UPDATE` / `DELETE`: add `AND public.assert_super({{ user.email }}::text)` to the `WHERE`.
     The three `updateMonday*Deleted` actions have no `WHERE`, so add
     `WHERE public.assert_super(...)`.
   - `INSERT … SELECT` (including the `jae` batches): add it to the `WHERE`, or add a
     `WHERE` where there is none.
   - `INSERT … VALUES`: rewrite as `INSERT INTO t (…) SELECT <same exprs> WHERE public.assert_super(...) ON CONFLICT …`.
     Keep the explicit casts on every param. There are 21 of these (#19-21, 41, 42, 44-51,
     56-62, 65), two of them dead.
   - CTE upserts (`upsertAppUser`, `upsertAccessGroup`, `updateTeramindAgentLink`): the check
     **must be inside the `WITH x AS (UPDATE …)`**. Postgres always runs a data-modifying CTE,
     so a check only on the outer `INSERT` would still let the `UPDATE` through.
   - `renamePeriod`: put the check on all four `UPDATE`s. Better still, make it one
     statement (four CTEs), which also fixes the "four statements with no transaction" issue
     from the 2026-09-22 review.
   - Dead actions (#10, 50, 52, 61): delete them rather than guard them.
3. **Use the real identity.** `assert_super(lower(btrim(email)))` looks at `app_users`
   directly. It must never go through `access_viewer(..., viewAs)`.
4. **Performance**: one indexed lookup on `app_users(email)` per statement.
   `upsertPayrollEntries` fires once per row (hundreds per run), which is still negligible.
5. **Add a test** in `tests/accessGuards.test.ts`, alongside `SCOPED_ACTIONS`. Every
   `src/actions/*.ts` on `'GAF Planilla DB'` that contains `INSERT|UPDATE|DELETE` must contain
   `public.assert_super({{ user.email }}::text)`, and the CTE actions must have it inside the
   CTE. This stops a future action from shipping without the lock.
6. **Disciplinary database (CANNOT-CHECK).** `{{ user.email }}` works in any SQL action,
   whatever the datasource. What that database lacks is the list of super users.
   - Options: (i) a form-app migration adds a small `hub_super_users` table plus a copy of the
     function there. The list would be kept by hand, 8 emails today, and the Hub cannot safely
     maintain it without guarding that write too. (ii) Accept the risk, and at least record
     the real caller: `closed_by` / `deleted_by` could be `lower({{ user.email }}::text)`
     instead of a typed name.
   - Close and Reopen are meant for managers, so they would need a "manager of this
     employee" check. That database cannot do it: it has only a free-text employee name and
     no `v_employee_access`.
   - Related: `loadDisciplinaryActions` takes `allNames` as a browser parameter, so its
     scoping is also only browser-side (item 9 of the 2026-09-22 review).
7. **`pullMondayBoard` (CANNOT-CHECK).** The app only sends read queries, but the GraphQL
   text is a browser parameter. If the Monday token can write, any signed-in user who can
   call the action can send a Monday mutation. A database function cannot guard an HTTP
   action. Check the token's scope on Monday, or whether UIB can restrict an action by role
   (not researched).
