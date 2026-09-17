# How payroll gets its punches today — the upload pipeline, end to end

**Date:** 2026-09-17. **Why:** groundwork for replacing the manual Teramind file upload with a direct
API pull (`docs/superpowers/plans/2026-09-17-payroll-via-teramind-api.md`). Read-only research; line
numbers are from the mirror at commit `f9dd0a3`.

## 1. The flow in `ProcessPayroll.tsx` (57,828 bytes, 1,025 lines, protected)

1. **Step 1 — Pay Period.** Period Name, Start Date, End Date. Pre-filled with the next period
   (`nextPeriod()` in `periodName.ts`). Typing an existing name = re-run (amber banner, optional
   "re-run for one employee only"). **A period is never created on its own** — the `periods` row is
   written by `upsertPeriod` at the end of a run (l.523).
2. **Step 2 — Teramind Export.** `<input type="file" accept=".csv,.xlsx">` (l.689). On upload
   (l.173–184) the file is parsed **in the browser** by `parseTeramindFile` → `teramindRows`. The card
   shows file name, rows parsed and `Coverage: min → max`. Nothing is sent anywhere.
3. "Export pulled mid-day" checkbox (l.724); `teramindMaxDate` (l.564–567) = max
   `timeStarted.slice(0,10)`, passed as `midDayPullDate`.
4. **Step 3 — Options:** outage dates, per-run exclusions (never persisted).
5. **Run** (`formReady`, l.569, requires `teramindFile`). `handleRun` (l.313–438): validates the name,
   confirms a re-run, `processTeramindData(...)` (l.350), pulls three Monday boards, writes three
   `run_snapshots` rows (the Teramind one holds only `teramindRows.slice(0,100)`, l.366), builds
   warnings, name-mapping step if needed, then `runEngine` (l.440–533): engine → upsert in batches of
   5 → `softDeleteStaleEntries` → `upsertPeriod`.

## 2. The contract between the file and the engine

`teramindParser.ts` reads the **first sheet**, fuzzy-matches three headers (identifier: `email` /
`user` / `employee`; start: `time started`…; end: `time finished`…) into

```ts
export interface TeramindRawRow { email: string; timeStarted: string; timeFinished: string; }
```

One row per **login session**. `processTeramindData(rows, dstWindows, resolver?, knownEmails?)`
returns `Map<teramind_email (lower-case), Map<'YYYY-MM-DD', { entry: Date; exit: Date }>>`:
a running **min(start) / max(finish)** per (email, **start date**). A 23:50→00:35 session is filed
under the start date with an exit on the next calendar day; the engine then forces that row YELLOW
("Session ran past midnight").

`parseWallClock` (l.125–153) accepts `YYYY-MM-DD[T ]HH:MM[:SS][ AM/PM]` and **refuses anything with
`Z` or `±HH:MM`** — deliberately, because a shifted hour moves money. An API feeding this code must
hand over timezone-free **US-Eastern clock text**.

The engine (`runClassificationEngine(input: EngineInput)`) reads the map in exactly two places
(`classificationEngine.ts:482`, `:518`) using raw `emp.teramind_email` — keys must stay lower-case.

**No test covers the parser.** Every engine test builds the map by hand.

## 3. What is saved, and what is not

Written per run: `run_snapshots` ×3, `payroll_entries` (upsert on
`(period_name, employee_id, work_date)`), stale rows soft-deleted, `periods` upsert, `name_aliases`.
**The uploaded punches are not stored** — no raw table, no file name, only 100 snapshot rows.

## 4. Period lifecycle

`/process` (create + process in one act) → `/action-required` and `/payroll-master` (review; Tim can
edit punches via `updatePunchTimes` and classification via `updatePayrollEntry`) → `/hrk-summary`
(CSV built in the browser; `saveHrkExport` stores the JSON in `hrk_exports`; sending to HRK is
out-of-band) → `/period-log`.

- `periods`: `period_name` (unique, shape `Q1|Q2-Mon-YYYY`), `start_date`, `end_date`,
  `processed_at` (overwritten every run), counts, `notes`. **No locked / sent state.** No overlap
  validation.
- **Re-run:** the upsert's `DO UPDATE` overwrites every field unconditionally — reviewed rows
  included. `resolved_by` / `resolved_at` exist but nothing writes them (BACKLOG #2). Nothing consults
  `hrk_exports` before a re-run.
- Attendance has no other punch source: `v_attendance_daily`, `loadAttendanceDaily`,
  `loadAttendanceReportDays` all read `payroll_entries`. Any date inside a period with `processed_at`
  counts as processed (`attendanceReport.ts:336`), so a partially-filled period turns missing days
  into unexplained absences.

## 5. When periods are actually run (Period Log on `/dev`, read 2026-09-17)

| Period | Dates | Processed |
|---|---|---|
| Q2-Aug-2026 | 08-10 → 08-24 | 08-25 14:24 |
| Q1-Aug-2026 | 07-26 → 08-09 | 08-10 19:27 |
| Q2-Jul-2026 | 07-11 → 07-25 | 07-27 15:40 |
| Q1-Jul-2026 | 06-26 → 07-10 | 07-13 15:08 |
| Q2-Jun-2026 | 06-11 → 06-25 | 06-25 20:11 |
| Q1-Jun-2026 | 05-25 → 06-10 | 06-18 15:11 |
| Q2-May-2026 | 05-11 → 05-24 | 05-25 20:10 |
| Q1-May-2026 | 04-24 → 05-10 | 05-11 16:19 |
| Q2-Apr-2026 | 04-11 → 04-23 | 04-23 18:24 |
| Q1-Apr-2026 | 03-26 → 04-10 | 04-10 15:46 |

12 periods, 9 HRK exports (Q1-Sep exported twice on 09-11, Q2-Aug twice on 08-26). Recent habit: run
the day after the period ends. Older habit: run on the last day (hence the mid-day checkbox).

## 6. The model for "pull from an API and keep a copy"

The Monday mirror: `pullMondayBoard.ts` (dumb HTTP transport) → `mondaySync.ts` (`pullAllItems`
cursor loop, `batchUpsert` in chunks of 100) → mirror tables with `raw JSONB`, `synced_at`, a
`deleted_on_monday` flag instead of deletes → `monday_sync_log` → `MondaySyncCard` (progress, counts,
last error, logs failures too). `useAccessSync` adds a throttled on-open sync with an in-flight guard.

## 7. What needs care when punches come from an API

1. Timestamps with a timezone are rejected → convert to Eastern clock text in one tested lib.
2. `formReady` / `handleRun` / `StepCard complete` all require a `File` object.
3. `midDayPullDate` and the two coverage warnings derive from the rows' date prefix — keep the rows
   in the same `YYYY-MM-DD HH:MM:SS` shape and they keep working.
4. An empty or failed pull must **block** the run; today an empty file silently yields a period of
   absences.
5. Keep map keys lower-case; several Teramind agents may belong to one employee.
6. Guard L4 demands exactly 14 `cfgGet` fallbacks in `ProcessPayroll.tsx`.
7. Save the full pull (there is no longer a file on someone's disk to fall back on).
8. Not made worse, but easier to hit once pulling is one click: re-runs overwrite reviewed rows;
   paid periods are not locked; running before a period ends manufactures absences. Logged for a
   follow-up, deliberately out of scope for the source swap.
