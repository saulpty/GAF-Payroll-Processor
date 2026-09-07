# Record the Reports tab in `AGENTS.md`

Documentation only. No code.

## The only file you may change

- `src/AGENTS.md`

**No other file.** No page, no component, no action, no lib, no migration.

## 1. The route table

Find the row:

```
| `/attendance/*` | `Attendance.tsx` | attendance dashboard; three tabs driven by URL, one component instance so tab switching does not remount |
```

Change `three tabs` to `four tabs driven by URL (Dashboard, Employees, Trends,
Reports)`, and add a row directly beneath it:

```
| `/attendance/reports` | `attendance/AttendanceReport.tsx` | per-employee-day report: punches, the Absence/Tardiness form behind the day, and whether it was filed before the shift started. Owns the loaders; `AttendanceReportStrips.tsx` (default view) and `AttendanceReportTable.tsx` take plain props. Verdicts come from `lib/attendanceReport.ts` |
```

## 2. A short section on the report module

Add this near the other library notes:

### `attendanceReport.ts` — the Reports tab's verdict engine

- Pure TypeScript, **no imports at all**. Callers pass the engine's helpers
  (`isScheduledWorkDay`, `getSchedule`, `parseTimeToMinutes`) in through
  `ReportInput.helpers`, the same rule `mondayResolve.ts` follows, so Node's
  TypeScript loader can load it directly for tests and there is still only one
  copy of the work-day gate and the DST rule. Types live in
  `attendanceReportTypes.ts` and are pulled back with a **type-only** import,
  which is erased before the code runs. A plain import breaks every test.
- `buildAttendanceReport(input)` returns `{ rows, perEmployee, unmatchedForms }`,
  one row per employee per scheduled work day in range.
- **It reads `payroll_entries` directly, never `v_attendance_daily`.** The view
  drops days with no punches, so it cannot see an absence — which is most of
  what this report exists to show.
- **It normalises its own inputs.** Every incoming date is sliced to 10
  characters and every index is keyed by `String(id)`, because a Postgres `DATE`
  arrives as `2026-06-01T00:00:00.000Z` and a `BIGINT` can arrive as a string.
  Both failures are silent and both render as false absences. Do not remove the
  normalisation on the grounds that the SQL already formats correctly — one
  caller not doing so is enough to break the page, and that is exactly what
  happened on 2026-09-07.
- **Scoring follows presence.** `countsToScore` is true for on-time, every late
  verdict, and every absence including reported ones; false for `pto`,
  `permission`, `holiday` and `not_processed`. PTO and a birthday day off are
  visible but must never move someone's score; an unexplained absence must.
  `onTimeRate` is `null`, never `0`, when there are no scored days.
- Guarded by `tests/attendanceReport.test.ts` — 47 cases, including R43–R47
  which feed it ISO timestamps and string ids.

## 3. The two flags it surfaces

Add a note that the report deliberately shows two data problems rather than
hiding them, both from `ReportRow.flags`:

- `recordedUnexplainedButFormOnFile` — payroll recorded an unjustified absence
  while a form exists for that day. 13 such days as of 2026-09-07.
- `formEmailUnrecognised` — the form was filed from an address that is not the
  employee's `teramind_email`. 113 such forms across 24 employees as of
  2026-09-07, and **the payroll engine cannot see any of them**, because
  `rowMatchesEmp` matches on email only when an email is present and never falls
  back to the name or `name_aliases`.

## Acceptance

1. Only `src/AGENTS.md` changed.
2. The route table lists `/attendance/reports` and says four tabs.
3. The three points that would cause a regression if forgotten are stated: no
   imports, reads `payroll_entries` not the view, normalises its own inputs.
4. Nothing else in the file is reworded or reordered.
