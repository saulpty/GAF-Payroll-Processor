# Deep code review of the whole app — 2026-09-22

> **Read `2026-09-23-review-of-the-review.md` first.** Every headline item below was re-checked on
> 2026-09-23. Items 4 (480 vs 420) and 7 (all requests approved) are **wrong**: both are Saul's
> own rulings. Item 5 has not happened yet. Item 8's Saturday part is the paid rest day. The rest hold.

**Read-only. Nothing was fixed.** This is the list to work from. Every item below still
goes through the change loop in `docs/CHANGE-LOOP.md` (prompt file → UIB → export → sync →
tests → look at the page → commit).

## How this was done

Nine reviewers ran in parallel, each on one slice of the app, with heavier models on the
money-bearing code:

| Slice | Model | Files |
|---|---|---|
| Payroll engine and Teramind libraries | Opus | `src/app/lib/classificationEngine.ts`, `teramind*.ts`, `punchMinutes.ts`, `periodName.ts`, `parseTimeInput.ts`, PTO libs |
| Payroll pages and their actions | Opus | `ProcessPayroll`, `PayrollMaster`, `ActionRequired`, `PeriodLog`, `HrkSummary`, 35 actions |
| Every SQL action (all 125) — scoping, injection, correctness | Opus | `src/actions/*` |
| Access, viewer identity, navigation, admin | Sonnet | `access.ts`, contexts, gates, auto-syncs, `pages/admin/**` |
| Attendance Today / List / Reports, Activity | Sonnet | `pages/attendance/**`, `activityDays.ts`, `attendanceReport.ts`, `TeramindAutoSync` |
| PTO, Contracts, Disciplinary, Monday mirror | Sonnet | `pages/pto/**`, `contracts/**`, `disciplinary/**`, `mondaySync.ts`, `MondayAutoSync` |
| Shared components, tools, and the test suite itself | Sonnet | `components/*`, `useRowEdits`, `tools/*.mjs`, all 45 test files |
| Access SQL: `access_viewer`, `v_employee_access`, views, constraints, migrations | Sonnet | `src/migrations/*` |
| Mechanical conventions sweep (15 KB, naming, timezone, params-wrapper, hardcoded ids, docs drift) | Haiku | whole of `src/` |

The claims that would cost money or expose data were then re-verified by hand against the
source (and, for the period-name and time-input bugs, by running the functions). Each
finding below carries a confidence: **high** means the code path was read end to end or the
function was executed; **medium** means the mechanism is confirmed but whether it bites
depends on data or intent that only Saul or Tim can confirm.

Test suite at the time of review: **469 pass, 0 fail** (45 files). `CLAUDE.md` still says the
baseline is 464; the handoff's 469 is the right number.

---

## The ten that matter most

Ranked by how much money or exposure is at stake, and how soon.

### 1. The app refuses the second half of every month as a "typo" — Q2-Sep cannot be run
`src/app/lib/periodName.ts:65`, called from `src/app/pages/ProcessPayroll.tsx:329` · **critical · high**

`nearMatch` treats one edit as a typo, and `Q2-Sep-2026` is one edit from `Q1-Sep-2026`. Executed
today: `nearMatch('Q2-Sep-2026', ['Q1-Sep-2026'])` returns `Q1-Sep-2026`, so Process Payroll
stops with *"looks like the existing period Q1-Sep-2026 — pick it from the list"*. The only
thing the message offers is to re-run Q1-Sep, which would overwrite the first half of the
month. `nextPeriod` auto-fills exactly this name. **This blocks the Q2-Sep run due on Sep 25.**
The test (`tests/periodName.test.ts` P4) misses it because its fixture already contains both
Q1 and Q2 of the same month, so the exact-match early return fires first.

*Plain language:* the typo-catcher is too eager. Q1 and Q2 of the same month differ by one
character, which it reads as a mistake.

### 2. Every signed-in manager's browser runs the access-groups sync
`src/app/components/AccessAutoSync.tsx:17-47`, mounted at `src/app/app.tsx:38` · **critical · high**

Its two siblings (`MondayAutoSync.tsx:78`, `TeramindAutoSync.tsx:26`) start with
`if (!isSuper) return;`. This one does not. After 20 s, and every 60 s after, a manager's tab
calls `loadAllEmployees` (the full company roster with notes, emails, start and end dates —
no `v_employee_access` clause), `loadAppUsers`, `pullMondayBoard`, and then the
`upsertAppUser` / `upsertAccessGroup*` / `deleteAccessGroup*` write actions. The whole
manager-scoping feature is bypassed on a timer, from every manager session.

### 3. No write action checks who is calling; the client-side gate is the only lock
`src/actions/upsertAppUser.ts:19-26`, `updatePayrollEntry.ts`, `updatePtoApproval.ts`,
`updateDisciplinaryActionDeleted.ts`, and every other `upsert*`/`update*`/`delete*` · **critical · high**

`access_viewer()` in SQL correctly refuses to let a non-super impersonate — that read-side
control is real. But no write carries any predicate on `{{ user.email }}`. A manager who can
reach any page can call `upsertAppUser` with their own email and `role: 'super_user'`
(`ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role` promotes them), or set
`discount_total_minutes = 0` and `payroll_ready = 'YES'` on anyone's row, or soft-delete their
own disciplinary case (`updateDisciplinaryActionDeleted.ts:3` literally says *"super users
only, enforced in the UI"*). `RequireSuper` hides pages; it does not stop calls. The pattern
that would fix it already exists in `loadMondayAttendanceFormsRange.ts:25-27`
(`EXISTS (SELECT 1 FROM app_users WHERE email = ... AND role='super_user' AND active)`).

### 4. Every operator save docks a full-day absence at 480 minutes; the engine uses the configured 420
`src/app/lib/classificationEngine.ts:234` and the calls at `PayrollMaster.tsx:215, 296, 738`,
`ActionRequired.tsx:209` · **critical · high**

`computeDiscount` defaults `fullDayMinutes` to a hardcoded 480. The engine passes the configured
`full_day_absence_discount_minutes` (seeded 420) in exactly one place (line 680). No page
passes it. So: the engine writes an unjustified absence at 420; the operator opens Action
Required, picks *Unpaid*, commits; the row is rewritten at 480. **One extra hour docked per
absence day, every time an operator touches it.** The reverse also happens: re-saving an
absence whose impact is *Constancia Medica* or *Paid – Exception* zeroes the 420.

### 5. A soft-deleted payroll row that the engine produces again stays deleted
`src/actions/upsertPayrollEntries.ts:24-45` · **high · high**

The `ON CONFLICT ... DO UPDATE` list updates every field except `deleted_at` / `deleted_by`.
Sequence: a run soft-deletes a day as stale (this is exactly what happened to the missing
Saturday Sep 19 — see `docs/findings/2026-09-22-weekend-sync-gap.md`), the data is backfilled,
the period is re-run, the engine produces the day, the upsert updates the row in place — and it
stays invisible in Payroll Master, Action Required and HRK. The run log says "saved". Only
Period Log's one-row-at-a-time Restore can bring it back. Related: the amber banner at
`ProcessPayroll.tsx:607` still says stale rows *"are left in place"*; the confirm dialog at
line 347 and the code at line 511 say they are removed.

### 6. Unpaid permissions and floating-holiday days skip review and go straight to "ready"
`src/app/lib/classificationEngine.ts:598` with `computeDerivedFields` at lines 307-315 · **high · high**

The permission branch deliberately marks unpaid permissions and Floating Holiday / Birthday
days YELLOW so an operator confirms them. But it also fills `event_type_1` and `pay_impact_1`,
and `computeDerivedFields` treats "YELLOW with both filled" as resolved: `payroll_ready = YES`,
`status_current = GREEN`. The row never appears in Action Required. For *Permiso No
remunerado* that means a silent **480-minute** dock (the same 480 as item 4), while an
unjustified absence docks 420. The doc comment at lines 286-288 describes the opposite
behaviour from the code.

### 7. Every Permissions-board row is treated as approved
`src/app/pages/ProcessPayroll.tsx:296` · **high · medium**

The board parser pushes `status: 'Approved'` on every permission row, so the engine's
`status.toLowerCase() !== 'rejected'` filter at line 579 can never exclude anything. A request
that a manager rejected, or that nobody has approved yet, is classified as a full-day paid
PTO / permission day, the employee's real punches for that day are discarded (the branch
builds from `baseEntry`, not `tmEntry` — line 599), and nothing lands in a review queue.
*Medium confidence only because the Permissions board may hold approved requests only; if it
also holds pending or rejected ones, this is critical.*

### 8. HRK Summary subtracts Constancia hours twice
`src/actions/loadHrkSummary.ts:99, 150-156, 205-213` · **high · high**

`constancia_hours` is derived from `discount_total_minutes` on Constancia rows (line 99).
`discount_agg` sums `discount_total_minutes` over **all** rows, including those same
Constancia rows (line 150-156). `total_worked_hours` then subtracts both. A 2-hour Constancia
takes 4 hours off worked time on the file that goes to the consultant. The same query also
credits 8 base hours per **Saturday** for Mon–Fri staff (`EXTRACT(DOW) BETWEEN 1 AND 6`,
lines 24-33) and ignores `end_date`, so a leaver is billed to the period end.

### 9. Every manager's browser downloads the full disciplinary file
`src/actions/loadDisciplinaryActions.ts:35-37`, called from `DisciplinaryTable.tsx:79` with
`manager: null, employeeName: null`; route at `app.tsx:63` has no `RequireSuper` · **high · high**

Scenario, expectation, what happened, evidence, prior warnings, consequences — for every
employee — arrive in the browser, and React hides the rows the viewer may not see. The
disciplinary database cannot join `v_employee_access` (second Postgres instance), so the fix
is to pass the allowed employee list in as a parameter. Not in `SCOPED_ACTIONS`.

### 10. Payroll Master's tabs, filters and CSV export only see the first 500 rows
`src/actions/loadPayrollMaster.ts:20` (`LIMIT 500`), `PayrollMaster.tsx:360-387` · **high · high**

A 15-day period for 45 people is roughly 675 rows. The RED tab filters the loaded page, not
the period. The footer count comes from `countPayrollMaster` and is right; the visible rows
are not. Export CSV on the RED tab writes only the RED rows that happened to be on page 1.

---

## Everything else, by area

Severity · confidence · file:line · what it is → what goes wrong.

### Payroll engine (`src/app/lib`)

- **high · medium** · `classificationEngine.ts:482, 518` · `teramindData.get(emp.teramind_email)` is not lowercased; the parser lowercases every key (`teramindParser.ts:74, 100, 184`). A mixed-case email on the roster loses every punch → every scheduled day becomes *Ausencia Injustificada* at 420. `ProcessPayroll.tsx:393` and `loadTeramindPunchDays.ts:30` already lowercase; only the engine does not. (Likely safe today if all stored emails are lowercase — worth one query to confirm.)
- **high · medium** · `classificationEngine.ts:133` · `parseTimeToMinutes` returns 0 *silently* for a blank or null schedule time. `loadEmployees` uses `LEFT JOIN schedules`, so an employee with no schedule gets shift start = midnight → a 9:00 arrival is 540 minutes late, auto-resolved to *Unpaid (without Grace)*, GREEN, ready. Same for a stored `"9am"` the regex misses.
- **high · high** · `classificationEngine.ts:599` · The full-day-permission branch discards `tmEntry`. Someone on PTO who comes in and works gets a GREEN PTO row with null punches; the holiday branch (556-566) and absence branch (621-631) both escalate on punches, this one does not.
- **medium · high** · `punchMinutes.ts:58` · A non-blank but unparseable `grace_until` (historic `"9am"`) yields a 900-minute grace window and zeroes `late_after_grace` on every Action Required save.
- **medium · high** · `classificationEngine.ts:812` · Past-midnight branch overwrites `auto_notes` and sets YELLOW, but a late row keeps its auto-filled `pi1`, so `computeDerivedFields` flips it back to GREEN/ready and the tardiness note is lost.
- **medium · high** · `ProcessPayroll.tsx:471` · `midDayPullDate` is the export's latest data date, not today, so the "mid-day pull" backfill can rewrite genuine early departures on a fully complete last day. AGENTS.md says "never widen the gate"; `hardcoding.test.ts` H2 cannot see it because it passes the date in.
- **medium · medium** · `classificationEngine.ts:426` vs `ptoPayrollMatch.ts:159` · `permissionCoversDate` treats the end date as inclusive; PTO matching treats the return date as exclusive. A "leave Fri, return Mon" request pays Monday as PTO in one and counts it as a work day in the other. Confirm the board's `to` semantics.
- **medium · medium** · `teramindParser.ts:108` · Username-part fallback returns the first known email whose local part matches, no ambiguity check; `teramindRows.ts:104` guards the identical case with `size === 1`.
- **medium · high** · `parseTimeInput.ts:35-42` · `2400` → `"24:00 AM"` (accepted by `STRICT_TIME`, 1440 minutes → 900 late minutes docked); `1230a` → `"0:30 AM"`, and `tests/parseTimeInput.test.ts:20` asserts that wrong output as correct.
- **low · medium** · `teramindRows.ts:97` · `linkAgents` links agents flagged `deleted: true`; the field is computed and never consulted.
- **low · high** · `classificationEngine.ts:686` · WFH detection matches `'wfh'`; the board's type is *Work From Home*, so `isWfh` is never true.

### Payroll pages and actions

- **high · high** · `PayrollMaster.tsx:199-247`, `ActionRequired.tsx:200-227` · Save does `await updateTimes` then `await updateEntry` with no try/catch or transaction. A blip between them leaves new punches with old minutes and a spinner that never stops. This is the "save path that skips the engine" lesson, still open.
- **high · high** · `PayrollMaster.tsx:314-327` · Undo Bulk writes `documentation: ''` on every restored row, but the snapshot never captured `documentation`. Thirty rows lose *Doctor Note – Logged* with no way back.
- **high · high** · `HrkSummary.tsx:115-161` · Overrides patch display fields only; `total_worked_hours` is never recomputed; "Save Edits" copies state and persists nothing; no `beforeunload`. The CSV can contradict itself.
- **high · high** · `deletePeriodEntries.ts:6`, `PeriodLog.tsx:71-86` · Hard `DELETE FROM payroll_entries`, which AGENTS.md forbids, across three untransacted calls with no catch. A mid-way failure leaves a period row with no entries and nothing to restore.
- **high · medium** · `ActionRequired.tsx:165-190` · Selection survives a tab switch; broadcast falls back to `trow = row`, so off-tab selected ids get seeded with the clicked row's punch times and notes. Commit bar says "all N" and commits the filtered subset.
- **medium · high** · `ProcessPayroll.tsx:231-255, 813-823` · The red "config fallback" banner covers 3 of the 14 `cfgGet` fallbacks; the 11 column-id lookups run inside `parseMondayItems` into a Set nobody re-renders from.
- **medium · high** · `ProcessPayroll.tsx:892`, `ActionRequired.tsx:232-250` · `void runEngine()` with no catch; bulk commit with no try/finally. A rejected upsert mid-run leaves a period with entries and no `periods` row (the "invisible orphan" lesson).
- **medium · high** · `loadAttendanceReportDays.ts:29`, `loadAttendanceDaily.ts:24`, `loadTeramindVsPayroll.ts:42` · Duplicate-day tie-break is `ORDER BY period_name DESC`, which is alphabetical by month (*Sep* > *Oct*), not chronological. Tie-break on `end_date` or `updated_at`.
- **medium · high** · `PeriodLog.tsx:232-247` · HRK re-download builds a different column set from the original export and emits `hire_date` unsliced (`2024-03-11T00:00:00.000Z`).
- **medium · medium** · `HrkSummary.tsx:101-126, 293-300` · Override map and React key are `display_name`; a rehire (two rows, same name) collapses into one and shares overrides.
- **medium · medium** · `softDeleteStaleEntries.ts:13-15` · `kept_keys: ''` yields `{""}` and `<> ALL` is always true → every row in range soft-deleted; `employee_ids: ''` throws on the bigint cast.
- **medium · high** · `loadUnresolvedCount.ts:7-10` · Nav badge counts unresolved rows across all periods ever; the page filters to one. `loadUnresolvedPerPeriod` already has the right numbers.
- **low** · `loadDeletedEntries` has no LIMIT and loads every deleted row on each Period Log render · `handleBulkSave` is one round trip per row · `saveHrkExport` is always called with `exportedBy: ''` · `PayrollMaster.exportCsv` quotes only notes, so a comma in a name shifts columns · `loadPayrollMaster` ILIKE does not escape `%`/`_`.

### Access, identity, navigation, admin

- **medium · high** · `TopNav.tsx:152` · `loadUnresolvedCount` runs for every viewer, including managers who never see the Payroll section.
- **medium · medium** · `TopNav.tsx:157-158` · Disciplinary badge is company-wide; the page is per-manager, so badge and page disagree.
- **medium · high** · `loadContractsExpiringCount.ts:20-21` vs `ContractsTable.tsx:124` · Badge uses server `CURRENT_DATE` and `< +30`; page uses Panama `asOf` and `<= 30`. They disagree at the boundary and after 19:00 Panama. `loadDisciplinaryDueCount` already does it right with `{{params.asOf}}`.
- **medium · high** · `updateEmployeeStartDate.ts:9` · The only write keyed by `display_name`; called from the auto-sync. Two people with one name both get the start date, which feeds HRK base hours and PTO accrual.
- **medium · medium** · `upsertEmployee.ts:16-27` · `ON CONFLICT (teramind_email)` where `''` is legal, so two blank-email hires collide; `active`, `excluded_from_payroll`, `is_grace_list`, `notes`, `schedule_id` are overwritten straight from EXCLUDED (only `role`/`manager` are COALESCE-protected).
- **medium · medium** · `mondayResolve.ts:19-24` · Name map is last-writer-wins with no preference for active rows; a rehire can steal the contract/tenure row from the active record (the Euclides pattern).
- **medium · high** · `upsertClassificationConfig.ts` · Activity thresholds are "super only" in the UI (`AttendanceActivity.tsx:115`) and unguarded in SQL.
- **low · medium** · `GroupsTab.tsx:94-105` · Duplicate-name check reads the pre-reload closure.
- **low** · `access.ts:35-37` duplicates the super-only route list that `TopNav` and `app.tsx` also encode; no test cross-checks them.
- **Looked fine:** `access_viewer()` (migration `1782002000:58-68`) re-derives the caller from the real `{{ user.email }}` and only honours `viewAs` for an active super — this is the one server-side control that holds. `AccessGate` blocks until ready, so no flash of super UI. Directory sync filters by `monday_group_directory_current`, not Status. No `{ params: {` wrapper anywhere in `src/app`. No hardcoded Monday ids anywhere in `src/`. No `{{params.x}}` inside a quoted SQL string.

### Monday mirror and syncs

- **high · high** · `mondaySync.ts:83` + `updateMondayRequestsDeleted.ts:7-13` (and the AttendanceForms / Contracts twins) · `if (!nextPage) break;` swallows a failed page 2+, and `batchUpsert` then calls the delete-flag action with the truncated list. The action has **no WHERE clause**: `SET deleted_on_monday = NOT (id IN (seen))`. Every row past page 1 (or every row, if the board returns zero items) is flagged deleted in one statement; PTO pending lists, contract columns and attendance forms vanish until a clean sync. Guard: never call it when `seenIds` is empty or the pull was partial.
- **high · medium** · `TeramindAutoSync.tsx:11-92` · No `claimSyncRun` lock, only a per-tab `inFlight` flag. Two supers with the Hub open double-pull Teramind.
- **medium · medium** · `MondayAutoSync.tsx:82-131` · `inFlight` is set after two awaited calls; a slow config/log fetch lets the 60 s tick start a second run.
- **low** · `claimSyncRun.ts:7-14` `INSERT ... WHERE NOT EXISTS` is not atomic · `renamePeriod.ts` runs four untransacted UPDATEs.

### PTO, Contracts, Disciplinary

- **high · high** · `disciplinary.ts:151-165` · Cases are grouped by raw `employee_name` before any normalisation; two spellings of one person become two rows with a split escalation ladder and a wrong "highest level".
- **medium · high** · `PtoRow.tsx:118` · `Number(row.taken_days) || null` turns a real 0 into "—".
- **medium · medium** · `loadPtoReviewCount.ts:10`, `loadPtoBalancesInputs.ts:14,27` vs `loadPendingPtoRequests.ts:21` · Only one of the three excludes `status = 'withdrawn'`; a withdrawn approval drops out of the badge but stays in the list.
- **medium · medium** · `ptoPayrollMatch.ts:75-76` · Floating Holiday and Birthday produce the identical `pay_impact_1`, so the "what payroll says" panel can match the wrong request.
- **medium · high** · `updateDisciplinaryActionReopened.ts`, `...Restored.ts` · No `IS NULL` idempotency guard, unlike Closed/Deleted; can clear another user's closure.
- **medium · medium** · `loadTeramindDayPunches.ts:37` · Omits `excluded_from_payroll = FALSE` that both sibling loaders apply, so the day view and the Activity view disagree about who worked.
- **low · high** · `loadPendingPtoRequests.ts` · Never imported by any page; dead code that will drift.

### Attendance and Activity

- **medium · high** · `AttendancePanel.tsx:52-58`, `useEmployeeStats.ts:24-28` · Opening an employee panel re-runs the full 9-loader `useActivityData` plus 2 more, company-wide, then discards the result because props win.
- **medium · medium** · `activityDays.ts:105-108, 220-225` · `EXCUSED` omits `'wfh'`, so a thin WFH day gets both the WFH chip and a "Needs A Look" flag.
- **medium · medium** · `attendanceReport.ts:288` · Unscheduled days are skipped entirely, so a worked day-off that payroll later captured never shows "Official" in Activity.
- **medium · medium** · `AttendanceReport.tsx:74-129` · No auto-retry on loader error, unlike Activity (the 2026-09-18 lesson).
- **low · medium** · `useActivityData.ts:218` · "Today" is browser-local `toLocalYMD`, not `easternDate`, contradicting the Activity rule; disagrees for an hour after Eastern midnight during DST.
- **low** · `AttendanceToday.tsx:312-322` maps clicks to rows by `<tr>` index · `TodayRow.tsx:25` "On Leave" override only applies once `late_not_in`, so PTO shows "Not In Yet" before grace ends.

### Shared components, tools, tests

- **high · medium** · `tools/sync-export.mjs:27-38, 89-108` · If the export zip has no `src/` (or it fails to extract), `listFilesRecursive` returns `[]` and `mirrorDirectory` deletes every file in the repo's `src/` as "removed". No sanity check on the size of a deletion; `syncExport.test.ts` has no empty-source case.
- **medium · high** · `EmployeeSearchInput.tsx:33` · Plain `includes()` with no accent folding; typing "Jose" does not find "José". `normalizeName` in the engine already does this.
- **test-coverage** · The 15 KB rule is checked on three hand-picked file lists only · No test for one-action-per-file naming · No test for the params-wrapper pattern (`grep` clean today, but the bug has bitten before) · `DataTable`, `EmployeeSearchInput`, `useRowEdits` have no behaviour tests (only the L6 structural check on one call site) · `parseTimeInput.test.ts:20` enshrines `"0:30 AM"`.
- **Looked fine:** `lessonGuards` L3/L4 are exact-equality ratchets that cannot loosen; `weekendSchedule` W1-W11 run the real engine with controls on both sides; `useRowEdits` compares values, so the presence-based dirty flag is genuinely fixed.

### Database, views and migrations

- **high · high** · `1781189300_gaf_planilla_initial.sql:95-123` · No foreign key from `payroll_entries.period_name` (or `run_snapshots`) to `periods`. This is the gap that made 205 rows vanish in the Q1-Aug-20260 incident; the fix shipped was UI validation plus a `NOT VALID` shape check on `periods` only. Any write that bypasses the UI can orphan a period again.
- **high · medium** · `docs/findings/2026-09-15-uib-identity-probe.md:25-27` · The whole access model rests on `{{ user.email }}` being server-substituted and un-spoofable. The team's own probe left that **unverified** ("confirm server-side substitution before telling Saul that manager scoping cannot be bypassed from the browser"). Item 3 above makes this worse: even if reads are safe, writes have no check at all.
- **medium · high** · `1782002000_access_roles.sql:44-54` · `v_employee_access` has no `e.active` filter; supers and all-employees managers get every employee ever created. Any loader built on it without its own active filter reintroduces the Current-vs-Past trap at the access layer.
- **medium · high** · `docs/sql/schema-audit.sql:27-34` · `pto_employees` and `pto_floating_holidays` have no `CREATE TABLE` anywhere in `src/migrations/` (only an `ALTER` in `1781803700`). The unique constraint that `upsertPtoEmployee`'s `ON CONFLICT (employee_id)` depends on cannot be verified from the repo.
- **medium · medium** · `1781803600_seed_monday_config_keys.sql`, `1781804000_add_directory_group_config.sql:9` · Nine seeded `classification_config` keys are read by no code (`monday_col_requests_name`, `_job_title`, `_employee_email`, `monday_col_attendance_manager_email`, `_role`, `monday_col_onboarding_manager_email`, `_3_months`, `_1_year`, `monday_group_directory_past`). AGENTS.md lists four dead keys; these are not among them. Editing one in Admin does nothing, silently.
- **low · medium** · `1781995000_v_attendance_daily_add_time_off_kind.sql:44-56` · `to_timestamp(..., 'HH12:MI AM')` with two normalisation branches and no guard; one unparseable stored time fails the whole view for everyone.
- **low** · `access_viewer()` has no `SET search_path` (not exploitable today, not SECURITY DEFINER) · `v_employee_managers` does not restrict to `role = 'manager'` · 21 of 68 migration files are absent from `applied.txt` (AGENTS.md already says it is untrustworthy, but cites a smaller gap).
- **Looked fine:** every `ON CONFLICT` target has a matching unique constraint or index. No hard `DELETE` on any `teramind_*` or `monday_*` table. The two big data migrations contain no DROP/TRUNCATE/DELETE. FKs to `employees` are `NO ACTION`, not `CASCADE`. `employees.active` is derived from the Current-Employees group id in `syncDirectory.ts:150`, not Status. `access_group_managers` is flat, so there is no recursion or cycle risk.

### Conventions and docs drift

- **15 KB rule** (CLAUDE.md, *"Files stay under 15 KB. Split a component rather than let one grow."*): beyond the five known untouchables, `PeriodLog.tsx` (24.7 KB), `HrkSummary.tsx` (18.0 KB), `attendanceReport.ts` (16.5 KB).
- `src/AGENTS.md:721` says *"`src/actions/` — 81 files"*; there are 125.
- `CLAUDE.md` baseline 464 vs actual 469.
- Prompt folders with no handoff mention: `2026-09-16-manager-chain`, `2026-09-18-ghost-records`.
- Four `console.log` left in `teramindParser.ts` (30, 37, 55, 218).
- Timezone rule, params-wrapper, quoted `{{params}}`, hardcoded ids, `window.location.reload`, nav-to-redirect: **all clean** (re-checked by hand; the `new Date(s + 'T12:00:00')` sites are the documented safe idiom).

---

## Suggested order of work

1. **Before Sep 25:** item 1 (period name). It is a one-function change in `periodName.ts` — treat `Q1`↔`Q2` of the same month and year as distinct, not as an edit — plus a test case with only Q1 in the fixture.
2. **Same week, payroll money:** items 4, 6, 8, 5, then the save-path pair (Payroll Master / Action Required) and Undo Bulk. All are inside the untouchable files, so each needs Saul's explicit go-ahead and its own prompt.
3. **Data exposure:** items 2, 9, then 3. Item 2 is a one-line gate. Item 9 is a parameter. Item 3 is a pattern to apply across every write action and is the largest piece of work in this list.
4. **Mirror safety:** the Monday delete-flag guard (never mark deleted from an empty or partial pull).
5. Everything else in severity order, plus the docs drift, which is a five-minute commit.
