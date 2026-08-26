# Code review findings — 2026-08-26

Produced by the code + sync + UI/UX review. Ranked by payroll risk. Every P0/P1
below is evidence-backed; where a number is claimed it was predicted first and
then measured in the live app, per `LESSONS.md`.

Phase 0 gate result: fresh export `GAF HR Hub (33).zip` synced with
`added: 0, changed: 1, removed: 0` — the single change was `version.yml`
(UIB platform 3.192.0 → 3.194.0). **Nothing under `src/` moved, and
`modelVersion` stayed 81, so nobody had edited the app since the last sync.**
The mirror is a faithful copy of what is live. Tests 96/96.

---

## P0 — Soft-deleted payroll rows are still counted on most screens

**The Summary Dashboard — the app's home page — overstates unpaid time by 126
hours for the current period.**

Measured live, 2026-08-26, period `Q2-Aug-2026`:

| Screen | Total discount hours | Action behind it |
|---|---|---|
| Dashboard → `DISCOUNT HOURS` | **308.2h** | `loadSummaryDashboard.ts` |
| HRK Summary → `Total Discount Hours` | **182.2h** | `loadHrkSummary.ts` |
| **Difference** | **126.0h** | = 18 rows × 420 min |

126.0 hours is exactly the 18 phantom off-day rows that migration
`1781900200` soft-deleted on 2026-08-25. `loadHrkSummary` filters
`deleted_at IS NULL` in all three of its CTEs; `loadSummaryDashboard` has no
such filter, so it still counts them. The figure was predicted before it was
measured and matched to the decimal.

This is not one screen. Eleven code paths that read `payroll_entries` omit the
filter:

| Action / view | What it feeds | Effect |
|---|---|---|
| `loadSummaryDashboard.ts:26-28` | Dashboard KPIs incl. discount hours | **P0 — payroll-adjacent number, wrong by 126h** |
| `loadSummaryAllPeriods.ts:24` | Per-period green/yellow/red totals | P1 |
| `v_attendance_daily` (all 16 definitions) | Whole Attendance dashboard | P1 — the deleted phantom rows still render as absences |
| `loadActionRequired.ts:12-14` | Action Required queue | P1 |
| `loadActionRequiredCounts.ts:10-13` | RED/YELLOW tab counts | P1 |
| `loadCommittedEntries.ts:12-14` | Committed entries table | P1 |
| `loadUnresolvedCount.ts:8-9` | Nav badge (currently reads 91) | P1 |
| `loadUnresolvedPerPeriod.ts:8-9` | Recent Periods "N open" | P1 |
| `loadPtoEmployeeDetail.ts:18-19, 43-44` | Payroll tally beside a PTO row | P2 |
| `updateEntryExit.ts`, `updatePayrollEntry.ts` | Edit by id | P3 — a deleted row remains editable |

**Why it was missed:** migration `1781900200`'s own comment says *"Upstream:
loadHrkSummary already filters deleted_at IS NULL"* — it named the one action
that was checked, and nobody swept the rest. The 2026-08-25 cleanup was verified
against Payroll Master and HRK Summary, both of which filter correctly, so the
verification passed while nine other screens stayed wrong.

**Fix:** add `AND deleted_at IS NULL` (or `pe.deleted_at IS NULL`) to each
action, and to `v_attendance_daily`. Independent, mechanical, and separately
verifiable — the Dashboard should fall to 182.2h and match HRK Summary exactly.

---

## P1 — Attendance date window rolls forward after 7pm Panama

`toISOString().slice(0,10)` returns tomorrow's date once local time passes
19:00, because Panama is UTC−5 year-round. Confirmed live defects:

- `GlobalFilterContext.tsx:5-6, 35-36` — `fmt(new Date())` seeds `TODAY` and the
  default 30-day window for the Attendance dashboard.
- `Attendance.tsx:39-42` — `today()` is the fallback whenever the operator
  **clears** the From/To date input, which is a normal UI action, not an edge case.
- `attendanceStats.ts:245` — narrower: only mis-flags the partial-week marker at
  the Sunday/Monday boundary. P3.

Verified **harmless**, do not change: `attendanceStats.ts:155`,
`AttendancePanel.tsx:43` (Postgres `DATE` → UTC-midnight round-trip),
`attendanceStats.ts:202` (local-midnight anchored), and `ptoAccrual.ts:56`
(pure `Date.UTC` arithmetic at both ends — TZ-invariant by construction).

## P1 — `teramindParser.ts:143` is reachable, and it can move money

Correcting what was said earlier in this session: this is **not** merely latent.
`parseWallClock` is called on every Teramind row (`teramindParser.ts:182-183`),
and its bare `new Date(s)` fallback fires whenever a timestamp misses the primary
regex. Its own comment concedes *"may be wrong in some TZ"*. When it fires it
yields a wrong `entry_time`/`exit_time`, which feeds `late_minutes` and
`discount_total_minutes`. Frequency depends on how often Teramind deviates from
its usual export format.

By contrast `classificationEngine.ts:187` **is** dead — `parseTeramindTimestamp`
has no caller anywhere in `src/`. It deserves the same explicit "never wire this
back up" note that `teramindToPanama` already carries in `AGENTS.md`.

## P1 — The H4 test does not scan the file it most needs to

`ProcessPayroll.tsx:211-213, 220-230` holds 14 hardcoded Monday board/column ids
as silent `cfgGet(key, '<literal>')` fallbacks. They would match H4's own
regexes — but `tests/hardcoding.test.ts:132-150` never scans that file. So
`CLAUDE.md:65` ("Tests H4/H5 fail the build if one appears in code") and
`BACKLOG.md:123-124` ("removed the last hardcoded IDs") are both untrue for the
one file that actually drives payroll classification.

## P1 — The database cannot be rebuilt from this repo

Replaying `src/migrations/*.sql` in timestamp order **hard-fails**:
`1781803700_revive_pto_tables.sql` runs `ALTER TABLE pto_approvals …`, but the
only `CREATE TABLE` for `pto_approvals`, `pto_employees` and
`pto_floating_holidays` lives in `docs/recovered-migrations/1781402200_create_pto_tables.sql`,
outside `src/`. Eight live PTO actions depend on those tables.

`applied.txt` lists 25 of 46 files. **It is written by UI Bakery, not by hand** —
`git log --follow` shows it changing only inside `sync:` commits — so the 21-file
hole cannot be repaired locally; an edit would be destroyed by the next export.
The authoritative ledger is the `uib_migrations` table inside UIB, which holds
the full SQL of every applied migration.

## P2 — `v_attendance_daily` has silently regressed twice

The view has been redefined 16 times. Two fixes were dropped and never restored:

- **Date serialization.** `1781290300` changed the output to
  `TO_CHAR(work_date,'YYYY-MM-DD') AS date` precisely because a raw date
  serializes as an ISO timestamp through the JS driver. `1781400200` did a
  `DROP`/`CREATE` and reverted to `work_date AS date`; every later definition
  including the current `1781900100` kept the revert.
- **Time format token.** `1781400600` fixed `'HH12:MI AM'` (not valid Postgres)
  to `'HH:MI AM'`. `1781401300` reintroduced `'HH12:MI AM'`, and `1781900100`
  still carries it.

Both need confirming against live data before any change.

## P2 — `loadActionRequiredCounts.ts:13` breaks the NULL-safe pattern

It uses `{{params.periodName}} = ''` where four siblings use
`COALESCE({{params.periodName}}, '') = ''`. **Currently inert** — the only
caller passes `period` from `useState('')`, always a string. But it is the exact
shape of the bug that has now bitten three times, one refactor away from
returning.

## P3 — Smaller items

- `FilterBar.tsx:22` shows a From/To date filter on `/process`, but
  `ProcessPayroll.tsx` never reads `dateFrom`/`dateTo`. A control that does nothing.
- `deleteLookup.ts:10-21`, `upsertLookup.ts:9-23` — `NULL NOT IN (...)` is `NULL`,
  so the guard is bypassed and the block silently no-ops. Mitigated at the caller.
- `updateEmployeeStartDate.ts:9` matches on `display_name`, a non-unique column.
- Stale docs: `CLAUDE.md:48` says baseline 87 (actual 96); `CHANGE-LOOP.md:111`
  still lists `AdminEmployeeSync.tsx`, deleted 2026-08-18 and asserted absent by H5.

## Verified clean

No `{ params: {...} }` wrappers anywhere. No `{{params.}}` inside quoted strings.
No hardcoded Monday **group** ids. The Current-Employees rule is correctly
enforced at the sync boundary (`syncDirectory.ts:150`) with no unfiltered
consumer. Working tree clean in both checkouts.
