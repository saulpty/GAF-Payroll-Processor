# Attendance → Reports tab

Add a fourth tab under Attendance, alongside Dashboard, Employees and Trends.
The data layer already exists and is unit-tested — this prompt is the screen.

## Files you may change

Create:
- `src/app/pages/attendance/AttendanceReport.tsx` — the tab's data owner
- `src/app/pages/attendance/AttendanceReportStrips.tsx` — the default view
- `src/app/pages/attendance/AttendanceReportTable.tsx` — the alternate view

Modify:
- `src/app/pages/Attendance.tsx` — route the new tab
- `src/app/TopNav.tsx` — add the nav link
- `src/app/FilterBar.tsx` — enable the filters on the new route

**No other file.** Do not touch `attendanceReport.ts`, the actions, any other
page, or anything under `src/components/ui/`.

## What already exists — use it, do not rebuild it

`src/app/lib/attendanceReport.ts` exports `buildAttendanceReport(input)`
returning `{ rows, perEmployee, unmatchedForms }`. Read that file for the exact
shapes; the important ones are `ReportRow.verdict`, `ReportRow.countsToScore`,
`ReportRow.form`, `ReportRow.coveredBy`, `ReportRow.flags`, and `ReportSummary`.

**It has no imports by design.** Callers pass the engine's helpers in:

```ts
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
// …
buildAttendanceReport({ …, helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes } })
```

Actions to call: `loadAttendanceReportDays`, `loadMondayAttendanceFormsRange`,
`loadMondayRequestsRange`, `loadAttendanceEmployees`, `loadHolidays`,
`loadPeriods`.

**Parameters go flat.** `useLoadAction(action, [], { dateFrom, dateTo, manager })`
— never `{ params: { … } }`. That wrapper silently returns nothing and has
already cost this project a full feature's worth of wrong numbers.

## Filters

Read the global filters with `useGlobalFilters()` exactly as `Attendance.tsx`
does today: date range, employee, role, manager. Pass `dateFrom`, `dateTo` and
`manager` to the loaders; filter employee and role in React.

In `FilterBar.tsx`, give `/attendance/reports` the same `ROUTE_CONFIG` entry the
other attendance routes have, including the 30/60/90 presets.

In `TopNav.tsx`, add **Reports** as the fourth Attendance link, after Trends.
In `Attendance.tsx`, extend `tabFromPath` and render `<AttendanceReport />` for
it. Leave the existing three tabs untouched — same components, same props.

## The default view — `AttendanceReportStrips.tsx`

One card per employee, sorted by most problems first (unexplained absences, then
late-without-form, then name).

Card header: name · role on the left; on the right a compact summary —
`Late 3 · forms on time 2/3 · unexplained 1`. Show unexplained in the danger
colour when it is above zero. When `onTimeRate` is `null`, show `No scored days`
rather than `0%`.

Body: the employee's days in the range as a row of small square tiles, grouped
into weeks with a gap between weeks, in date order. Each tile is one scheduled
work day, labelled with the weekday initial. Tile colour by verdict:

| Colour | Verdicts |
|---|---|
| success | `on_time`, `late_reported_on_time`, `absent_reported_on_time` |
| warning | `late_reported_late`, `absent_reported_late` |
| danger | `late_no_form`, `unexplained_absence` |
| muted / neutral | `pto`, `permission`, `holiday`, `not_processed` |

Clicking a tile selects it and shows one detail line beneath the strip:
date · in/out · minutes late · form type and reason · `sent HH:MM (shift HH:MM)`
or `no form`. For a covered day show the cover instead (`PTO`, `Permission`,
the holiday's name). For `not_processed` say `payroll not run for this day yet`.
Selecting a tile in one card clears the selection in the others.

Give every tile an accessible label (employee, date, verdict) — colour must not
be the only carrier of meaning.

## The alternate view — `AttendanceReportTable.tsx`

Columns: Day · Employee · In / out · Late · Form · Verdict.

- **Form** shows `type · reason` on the first line and
  `sent HH:MM, shift HH:MM` in muted text beneath. Tardiness forms have no
  reason in the source data — show the type alone, not an empty separator.
- **Verdict** is a coloured badge using the same mapping as the tiles, with
  readable wording: `On time`, `Late · reported on time`, `Late · form sent
  late`, `Late · no form`, `Absent · reported on time`, `Absent · reported
  late`, `Unexplained absence`, `PTO`, `Permission`, `Holiday`,
  `Not processed yet`.

Above the table, verdict filter chips with counts; clicking toggles a verdict in
or out. Sort by clicking a column header. Default sort: date descending, then
employee name.

## Shared chrome in `AttendanceReport.tsx`

- A view toggle: **Weekly strips** (default) | **All days**.
- A one-line summary strip above the toggle: total scored days, on-time rate,
  unexplained absences, forms on time — for the current filter.
- When `unmatchedForms > 0`, a quiet note:
  `N forms could not be matched to an employee — Admin → Employees → Monday`.
- Loading, empty and error states. Empty means "no scheduled work days in this
  range for these filters", which is a real and unalarming case.

### Two flags that must be visible

Both come from `ReportRow.flags` and both represent real data problems that a
manager needs to see rather than a bug to hide:

- `recordedUnexplainedButFormOnFile` — payroll recorded the day as an
  unjustified absence while a form exists for it. Mark the row and say
  `payroll recorded this as unexplained, but a form is on file`. 13 such days
  exist today.
- `formEmailUnrecognised` — the form was filed from an address that is not the
  employee's company email. Mark it `form filed from an unrecognised email`.
  113 such forms exist today, and the payroll engine cannot see any of them.

Keep these understated — a small icon or muted note, not a red banner. They are
information, not alarms.

## Constraints

- Every file under 15 KB. `AttendanceReport.tsx` owns the data; the two view
  components take plain props and hold no loaders.
- Reuse the existing UI primitives and the styling idioms of
  `AttendanceTable.tsx` and `AttendancePanel.tsx`. Do not invent a new visual
  language, and do not add a chart library.
- No `toISOString()`. Dates are `YYYY-MM-DD` strings compared as strings.
- No Monday board, column or group id anywhere — none is needed; everything
  comes from Postgres.

## Acceptance

1. `/attendance/reports` renders, and the other three tabs are unchanged.
2. The manager, date-range, employee and role filters all narrow the view.
3. Both views render the same underlying rows; the toggle switches between them.
4. No `useLoadAction` call anywhere uses a `{ params: … }` wrapper.
5. Only the six files above changed.
6. TypeScript clean and the page loads with no console error.
