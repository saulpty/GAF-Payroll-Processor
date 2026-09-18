# 03 — FilterBar: a Periods | Dates switch on the Attendance routes

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…` and `src/actions/…` means `actions/…`. Never create a top-level folder
named `src`.**

## Files that may change

- `src/app/context/GlobalFilterContext.tsx` — add two fields, nothing else
- `src/app/FilterBar.tsx` — the switch, the quick picks, the `ROUTE_CONFIG` entries for
  `/attendance` and `/attendance/reports`
- `src/app/pages/Attendance.tsx` — read-only check, described below; touch only if that check fails
- `src/app/pages/attendance/AttendanceReport.tsx` — read-only check, described below; touch only if
  that check fails

No other file may be touched. `FilterBar.tsx` is a shared file used by Payroll, PTO, Contracts and
Disciplinary routes too — make the smallest possible edit and cause **no visual or behavioral change
on any non-attendance route**. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything
under `src/components/ui/`.

## Why

The Attendance section is about to gain an Activity tab that thinks in date ranges, not payroll
periods. Rather than build a second filter bar, the existing one gains a mode switch so List,
Reports and the new Activity tab all pick their range the same way, with sensible per-tab defaults.

## 1. Context — two new fields on `GlobalFilters`

In `src/app/context/GlobalFilterContext.tsx` add:

```ts
attendanceMode: 'periods' | 'dates';
setAttendanceMode: (v: 'periods' | 'dates') => void;
```

Backing state: `useState<'periods' | 'dates'>('periods')`. Include both in the memoized `value` and
its dependency array. `clearAll` does **not** reset `attendanceMode` — it is a view preference, not
a filter value.

## 2. FilterBar — the switch itself

`RouteConfig` gains `dateRange` is already a field; no new type field is needed for the switch — it
appears whenever a route has **both** `cfg.periods` and `cfg.dateRange` set to `true`. Update the two
existing attendance entries in `ROUTE_CONFIG`:

```ts
'/attendance':            { periods: true, dateRange: true, employee: true, role: true, manager: true },
'/attendance/reports':    { periods: true, dateRange: true, employee: true, role: true, manager: true },
```

(`/attendance/today` and the routes for other sections are untouched.)

Render logic, replacing the current unconditional `{cfg.periods && (...)}` / `{cfg.dateRange && (...)}`
blocks **only for this shared case**:

- When `cfg.periods && cfg.dateRange` are both true: render a small segmented control — two buttons,
  "Periods" and "Dates" (Title Case, same pill styling already used for `statusTab`/`pmTab` — rounded
  border group, active = filled, idle = white/hover) — bound to `attendanceMode` /
  `setAttendanceMode`. Below/after it, render the existing `PeriodMultiSelect` block when
  `attendanceMode === 'periods'`, or the existing `From`/`To` date inputs plus a new quick-pick row
  when `attendanceMode === 'dates'`.
- When only `cfg.periods` is true (no route needs this today, but keep it correct): render the
  multi-select as before, unconditionally.
- When only `cfg.dateRange` is true (`/process`, and any other single-date-range route): render the
  date inputs as before, unconditionally. **This is the existing behavior for every non-attendance
  route — do not change it.**

## 3. Quick picks (Dates mode only)

A row of small buttons next to the date inputs: **Today · This Week · Last 14 Days · This Period So
Far · Last Period** (Title Case). Each sets `dateFrom`/`dateTo` directly (no new context setter
needed — call the existing `setDateFrom`/`setDateTo`). Use `toLocalYMD` from
`@/app/lib/classificationEngine` for all "today" math (never `new Date().toISOString()`); compare
dates as strings.

- **Today** — `from = to = today`.
- **This Week** — `from` = the Monday on or before today (ISO week), `to = today`.
- **Last 14 Days** — `from` = today minus 13 days, `to = today` (14 days inclusive).
- **This Period So Far** — using the `periods` array already loaded in `FilterBar` (all periods with
  a non-blank name, not only processed ones): the newest period by `start_date` whose `end_date >=
  today`; if none qualify, fall back to the newest period overall. `from` = that period's
  `start_date`, `to = today` (capped at the period's own `end_date` if today is somehow past it).
- **Last Period** — the newest **processed** period (`processedPeriods[0]`, already sorted newest
  first). `from`/`to` = that period's full `start_date`/`end_date`.

If `periods`/`processedPeriods` is empty when a quick pick is clicked, do nothing (disable the button
or no-op) rather than setting blank/garbage dates.

## 4. Default mode per route

Default: **Periods** on `/attendance` and `/attendance/reports`; **Dates** on `/attendance/activity`
(that route does not exist until prompt 04 creates it — the effect below is written now so it is
ready). Add a `useEffect` in `FilterBar`, mirroring the existing `versionRef`/`periodsVersion` pattern
already in this file: keep a ref of the previous attendance sub-route, and when the pathname's
attendance route changes (comparing `/attendance`, `/attendance/reports`, `/attendance/activity` —
not `/attendance/today`, which has no switch), reset `attendanceMode` to that route's default. A
manual switch made while staying on the same route must stick (do not fight the user by resetting on
every render — only on route change).

## 5. Read-only check on the two consumer pages

`Attendance.tsx` (`AttendanceInner`, around `const safeFrom = dateFrom || daysAgo(30); const safeTo =
dateTo || today();`) and `AttendanceReport.tsx` (same two lines, around line 44-45) both already read
`dateFrom`/`dateTo` straight from `useGlobalFilters()` — not `rangeOf(periods)` directly, since
`FilterBar` is what writes `dateFrom`/`dateTo` into context (via `setAttendancePeriods`'s `range`
argument in Periods mode, or directly in Dates mode per this prompt). **Confirm this remains true
after your FilterBar changes — if it does, do not touch these two files at all.** Only edit one of
them if you find a spot that reads `attendancePeriods` or calls `rangeOf` directly instead of reading
`dateFrom`/`dateTo` from context; if so, change only that spot to read `dateFrom`/`dateTo`.

## Rules

Every file stays under 15 KB. Title Case labels everywhere. No hardcoded Monday board/column/group
ids (none are touched here). Dates are `YYYY-MM-DD` strings compared as strings — never `new
Date(str)` for date math, only `toLocalYMD(new Date())` for "today".

## Acceptance (check on /dev)

1. `/payroll-master`, `/pto`, `/contracts`, `/disciplinary`, `/process` look and behave exactly as
   before — no switch, no visual change.
2. `/attendance` and `/attendance/reports` open in **Periods** mode by default, with the switch
   visible; clicking **Dates** swaps to the date inputs plus the five quick picks; picking a quick
   pick updates the date range shown and the table/report data.
3. Switching back to **Periods** on either tab restores the multi-select and its previously selected
   periods.
4. Navigating List → Reports → List keeps whichever mode you last picked for each tab independently
   is not required — only that re-entering a tab you have not left/returned to yet shows its default.
5. No console errors; List and Reports data still loads correctly in both modes.
