# 04 — Attendance → Activity: one tab, four new files

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…` and `src/actions/…` means `actions/…`. Never create a top-level folder
named `src`.**

## Files that may change

- `src/app/pages/attendance/activity/useActivityData.ts` — NEW
- `src/app/pages/attendance/activity/AttendanceActivity.tsx` — NEW
- `src/app/pages/attendance/activity/ActivityByEmployee.tsx` — NEW
- `src/app/pages/attendance/activity/ActivityByDay.tsx` — NEW
- `src/app/pages/attendance/activity/ActivityNeedsLook.tsx` — NEW
- `src/app/pages/Attendance.tsx` — add the `activity` tab, three lines, described below
- `src/app/TopNav.tsx` — add one link to the Attendance section, described below
- `src/app/FilterBar.tsx` — add one `ROUTE_CONFIG` entry, described below

`src/app/app.tsx` needs **no** change — `/attendance/*` is already one catch-all route handled by
`Attendance.tsx`. Confirm this and do not touch `app.tsx`.

No other file may be touched. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything
under `src/components/ui/`. This tab only reads — it never writes payroll, PTO, or attendance data.

## Contract

Read `docs/superpowers/prompts/2026-09-18-activity/CONTRACT.md` in full before writing anything —
it is frozen and overrides any other note. It defines: the `loadTeramindActivityDays` SQL action's
`ActivityDayRow` output (already built in a prior slice — this prompt only *calls* it, never edits
the action or the migration), the pure lib `src/app/lib/activityDays.ts` (already built — `import
type` and its functions only, never edit that file either), the Why-chip wording and tones, and the
Title Case / US Eastern / "no punches → no row" rules. If either `loadTeramindActivityDays.ts` or
`src/app/lib/activityDays.ts` do not exist yet, stop and report that instead of improvising them.

## Why

Today shows one day; Reports shows the official record. Neither answers "how much is this person
actually working, day over day" — that needs Teramind's Time Records shaped into per-employee,
per-day activity with the same Why context (PTO, permission, holiday, WFH) Reports already computes,
so a real absence and a form-covered day off don't look the same.

## 1. `useActivityData.ts`

Exports a hook, e.g. `useActivityData({ dateFrom, dateTo }: { dateFrom: string; dateTo: string })`,
called from `AttendanceActivity.tsx` only. Inside it, `viewAs` comes from `useViewer()`. Load, with
every param **flat** — never wrapped in a `params:` object (see "Three bugs" in the root CLAUDE.md):

- `loadTeramindActivityDays` with `{ dateFrom, dateTo, viewAs }`
- `loadAttendanceEmployees` with `{ viewAs }` (same loader the Reports tab uses)
- `loadAttendanceReportDays` with `{ dateFrom, dateTo, manager: '', viewAs }` — **required**:
  `buildAttendanceReport` gets `coveredBy` (PTO / Permission / Holiday) and the official
  entry/exit times from these payroll rows. Without them every Why chip that comes from payroll is
  missing and every day reads as `Live` instead of `Official`.
- `loadMondayAttendanceFormsRange` with `{ dateFrom, dateTo, manager: '', viewAs }`
- `loadMondayRequestsRange` with `{ dateFrom, dateTo, manager: '', viewAs }`
- `loadHolidays` with `{}`
- `loadPeriods` with `{}` — **required**, `buildAttendanceReport` takes `periods`
- `loadDstCalendar` with `{}` — **required**, `buildAttendanceReport` takes `dstWindows`; without
  it `getSchedule` reads the wrong shift start and every arrival looks late or early
- `loadClassificationConfig` with `{}` — filter its rows to `category === 'teramind'` and pick out
  `activity_min_active_minutes`, `activity_break_minutes`, `activity_break_over_minutes` by `key`,
  building an `ActivitySettings` object (numeric fallbacks 390/60/30 only if a key is missing, and
  if any fallback is used, return which keys fell back so the shell can show a small notice — same
  spirit as the Action Required page's red banner for config fallbacks, but this can be a quieter
  inline note since Activity is not payroll).

Call `buildActivityDays` (from `@/app/lib/activityDays`) with `dateFrom`, `dateTo`, `today` (=
`toLocalYMD(new Date())` from `classificationEngine`), the mapped employees, the raw
`ActivityDayRow[]`, the report rows and requests, and the settings.

`buildActivityDays` takes `isScheduledWorkDay` as `(emp, date: string) => boolean`. The real
`isScheduledWorkDay` in `classificationEngine.ts` has a **different signature** —
`(date: Date, workDays: string | undefined)`. Do **not** pass it straight through (that calls
`.getDay()` on an employee object and throws). Pass a small adapter defined in this hook:

```ts
const isScheduledFor = (emp: unknown, date: string) =>
  isScheduledWorkDay(new Date(date + 'T12:00:00'), (emp as { work_days?: string }).work_days);
```

(the `T12:00:00` noon form is what `attendanceReport.ts`'s own `ymdToDate` uses — this is the one
permitted `new Date(str)`, for a weekday lookup only, never for date arithmetic.)

Building the `reportRows` argument needs `buildAttendanceReport` (from
`@/app/lib/attendanceReport`, same as `AttendanceReport.tsx` already does) fed by **all eight**
inputs it declares — `employees`, `payrollRows`, `forms`, `requests`, `holidays`, `periods`,
`dstWindows`, `helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes }` — copy that call
shape from `AttendanceReport.tsx` lines 92-103 verbatim; don't reinvent Why-chip logic here.

Return `{ days, byEmployee, totals, loading, error, configFallbacks }` (or equivalent) for the shell
to consume. Keep this file under 12 KB — if the `buildAttendanceReport` wiring makes it too big,
that composition may live inline here since it is activity-only, not shared.

## 2. `AttendanceActivity.tsx` — shell

Default export, mounted at `/attendance/activity`. Same page frame as `AttendanceReport.tsx` (flex
column, scrolling body, Attendance green `#2AA876` accents). Reads `dateFrom`, `dateTo` from
`useGlobalFilters()` (populated by the FilterBar switch built in prompt 03; this route defaults to
Dates mode) and calls `useActivityData({ dateFrom, dateTo })`.

- KPI tiles (reuse the `SummaryTile`-style pattern from `AttendanceToday.tsx` or `AttendanceKpis.tsx`
  — do not import from either file, just match the look): **Avg Active Time** (from `totals`, via
  `fmtDuration`-equivalent — reuse `fmtDuration`/`fmtClock` from `@/app/lib/teramindToday` for
  formatting, never hand-roll time math), **Days With Work**, **Needs A Look**, **Late Arrivals**.
- A `By Employee | By Day` segmented switch (same pill styling as the `statusTab`/`pmTab` controls in
  `FilterBar.tsx` — copy the look, not the code). Default: **By Employee** when the selected range
  spans more than 1 day, **By Day** when it is exactly 1 day.
- Footer note, exact wording: "Data Updates Every 15 Minutes · Times In US Eastern" (Title Case, per
  the contract's US-Eastern rule).
- Renders `ActivityNeedsLook` above whichever table is active, then `ActivityByEmployee` or
  `ActivityByDay`.
- Loading / error / empty states in plain language, matching the tone of the other Attendance pages
  (e.g. "No activity for these filters.").

Keep this file under 12 KB — it is a shell; the tables do the heavy rendering.

## 3. `ActivityByEmployee.tsx`

One row per person: Employee (name + role, same two-line cell style as `AttendanceToday.tsx`'s table)
· Days With Work (`9 / 10` — worked over scheduled) · Avg Active (a number plus a small horizontal bar
scaled to the shift length, similar in spirit to a sparkline but simpler — a single filled bar,
no library needed) · Avg First · Avg Last · Needs A Look (a small amber chip with the count, or
nothing when zero) · Away Days (count + `awayLabel` from the summary, e.g. "1 · Sick").

Each row has a chevron (reuse the `lucide-react` chevron icons already used elsewhere in this repo,
e.g. check `AttendanceReportStrips.tsx` or similar for the existing expand/collapse pattern before
inventing a new one). Clicking it expands **all** of that person's days at once (`EmployeeActivity
Summary.days`, newest first per the contract) — no pagination, no "load more". The expanded block has
its own header row: Date (`fmtDayShort` from `@/app/lib/activityDays`, e.g. `Wed Sep 11`) · First –
Last (`fmtClock` from `teramindToday`, "—" when null, append "+1d" when `crossesMidnight`) · Active
(`fmtDuration`) · Breaks (`fmtDuration(breaksMin)`, "—" when `records <= 1`) · Why (the chip from
`day.why`, or nothing when `why` is null — tone-colored per the contract: blue/amber/gray) · Source
(`Live` when `!official`, `Official` with a small check mark when `official && !edited`, `Official,
Edited` with a small dot when `official && edited`).

Reuse `DataTable`/table styling conventions from `AttendanceReportTable.tsx` (header classes, row
hover, `divide-y`). Keep this file under 12 KB.

## 4. `ActivityByDay.tsx`

Flat table, one row per employee-day: Employee · Date · First – Last · Active · Breaks · Why · Source
— same columns and formatting as the expanded block above, plus the Employee column since rows are
not grouped. An **Export CSV** button. There is no shared CSV helper in this codebase yet — write a
small local `exportCsv(rows)` function following the pattern already used in
`src/app/pages/admin/teramind/TeramindCompare.tsx` (`escape` values containing commas/quotes/newlines,
join with commas and `\n`, build a `Blob` of type `text/csv`, `URL.createObjectURL`, a hidden `<a>`
with `download`, then `URL.revokeObjectURL`). Filename: `activity_<dateFrom>_<dateTo>.csv`. Column
order in the CSV: `employee, date, first, last, active_minutes, breaks_minutes, why, source`. Keep
this file under 12 KB.

## 5. `ActivityNeedsLook.tsx`

An amber list (not a table) above whichever main table is showing: one line per flagged day —
Employee · Date (`fmtDayShort`) · a reason string. Reason text: `No Records` when `records === 0`,
otherwise `${fmtDuration(activeMin)} Active · Lunch Gap ${fmtDuration(largestGapMin)}` when
`largestGapMin` is the driver, or just `${fmtDuration(activeMin)} Active` when low activity is the
only flag (match `flag` from `ActivityDay`: `'low_activity'` → just the active-time phrase,
`'long_break'` → the active-time-plus-gap phrase). Only render rows where `needsLook === true`. Keep
this file well under 12 KB — it is a small list, not a table.

## 6. Wiring

- **`Attendance.tsx`**: extend `type Tab = 'list' | 'reports' | 'today' | 'activity'`; in
  `tabFromPath`, add `if (pathname.includes('/activity')) return 'activity';` alongside the existing
  checks (order doesn't matter since the substrings don't collide); in `Attendance()` add
  `if (tab === 'activity') return <AttendanceActivity />;` next to the `reports`/`today` lines; import
  `AttendanceActivity` from `@/app/pages/attendance/activity/AttendanceActivity`. Nothing else in this
  file changes.
- **`TopNav.tsx`**: in the `attendance` section's `links` array, add
  `{ to: '/attendance/activity', label: 'Activity', icon: Activity }` **after** the `Reports` entry
  (tab order becomes Today · List · Reports · Activity). `Activity` is already imported from
  `lucide-react` in this file (it's the section icon) — reuse the same import, don't add a duplicate.
- **`FilterBar.tsx`**: add
  `'/attendance/activity': { periods: true, dateRange: true, employee: true, role: true, manager: true },`
  to `ROUTE_CONFIG`. It needs `periods: true` alongside `dateRange: true` so the Periods | Dates
  switch from prompt 03 renders on this route too (prompt 03's default-mode effect already sends this
  route into Dates mode on entry).

## Rules

Every new file under 12 KB. `useLoadAction(action, default, {...flatParams})` — never a `{ params:
{} }` wrapper; if you add a loader call, grep the file for any other call site of that same action
before moving on. No file under `pages/attendance/` may import a Teramind HTTP action or
`useTeramindPull` — this tab reads the saved copy only, same as Today. Title Case everywhere. Dates
are `YYYY-MM-DD` strings compared as strings; "today" only via `toLocalYMD(new Date())`. Amber/blue/
gray chip tones follow the contract's `WhyChip.tone`. Add `loadTeramindActivityDays` to
`SCOPED_ACTIONS` in `tests/accessGuards.test.ts` if it is not already listed there from the slice that
built the action.

## Acceptance (check on /dev)

1. Attendance shows **Today · List · Reports · Activity**; Activity opens at `/attendance/activity`
   in Dates mode by default, range control visible.
2. KPI tiles show real numbers for the default range; switching By Employee / By Day changes the
   table without reloading data.
3. Expanding a row in By Employee shows every one of that person's days at once, with the header row
   present, no pagination.
4. Needs A Look list shows only scheduled-but-flagged past days; today never appears there.
5. Export CSV on By Day downloads a file named `activity_<from>_<to>.csv` with the right columns.
6. With "View As" a manager: only that manager's people appear, matching the other Attendance tabs.
7. Only the files listed above changed; `node --test "tests/*.test.ts"` still passes.
