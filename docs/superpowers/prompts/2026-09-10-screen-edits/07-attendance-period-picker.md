# 07 — Attendance filter bar: pick payroll periods instead of 30/60/90 + dates

Managers should only look at attendance for periods payroll has processed. On
attendance routes the filter bar replaces the 30d/60d/90d buttons and the two
date inputs with a **Periods** multi-select. The pages keep reading
`dateFrom`/`dateTo` from the context — the picker sets them.

## Files you may change

- `src/app/context/GlobalFilterContext.tsx`
- `src/app/FilterBar.tsx`
- **New:** `src/app/components/PeriodMultiSelect.tsx` (under 6 KB)

**No other file may be touched.** `Attendance.tsx`, `AttendanceReport.tsx` and
every action stay byte-identical. `/process` keeps its From/To inputs as today.
Params flat in every `useLoadAction`. No `new Date(str)`, no `toISOString()`:
dates are `YYYY-MM-DD` strings, compared as strings, Postgres values sliced to 10.

## GlobalFilterContext.tsx

- Remove `DayPreset`, `dayPreset`, `setDayPreset` and the `setDayPresetRaw` calls
  in `setDateFrom`/`setDateTo`/`clearAll`.
- Add `attendancePeriods: string[]` (default `[]`) and
  `setAttendancePeriods(names: string[], range: { from: string; to: string } | null)`
  which stores the names and, when `range` is given, sets `dateFrom`/`dateTo`.
- `hasAny` and `clearAll` no longer look at the dates; `clearAll` also sets
  `attendancePeriods` to `[]` (the bar then re-selects the newest period).
- Add both to the type, the value and the `useMemo` dependency list.

## PeriodMultiSelect.tsx

Props: `periods: { period_name: string; start_date: string; end_date: string }[]`
(already newest-first), `selected: string[]`, `onChange: (names: string[]) => void`.

A button styled like the bar's inputs (`h-8 px-2.5 text-[13px] border
border-slate-200 rounded-lg bg-white`) whose label is the one selected name, or
`N periods`, or `Choose…`. Clicking opens a dropdown (absolute, `z-40`, white,
shadow, `max-h-72 overflow-auto`) with one row per period: a checkbox, the
name in medium weight, and the range in slate-400 as `MM-DD-YYYY → MM-DD-YYYY`
using `fmtDate` from `@/app/lib/fmtDate`. A footer link *Newest only* selects
just the first period. Closes on outside click (document `mousedown` listener in
a `useEffect` with cleanup) and on Escape. `aria-expanded` on the button.

## FilterBar.tsx

- Remove `DAY_PRESETS`, the `DayPreset` import, the preset buttons and the
  `dayPreset`/`setDayPreset` reads.
- `RouteConfig` gets `periods?: boolean`. `'/attendance'` and
  `'/attendance/reports'` use `{ periods: true, employee: true, role: true, manager: true }`
  (no `dateRange`). `/process` keeps `dateRange: true` and its From/To inputs.
- The bar already loads `loadPeriodsAction`; widen the row type to include
  `start_date`, `end_date`, `processed_at`. `processedPeriods` = rows with a
  non-empty `period_name` and non-null `processed_at`, each date sliced to 10
  characters (`start_date.slice(0, 10)`), sorted by `start_date` descending as
  strings.
- Range for a selection: `from` = the smallest `start_date`, `to` = the largest
  `end_date` among the selected periods (string comparison).
- Default: an effect — when `cfg.periods`, `attendancePeriods.length === 0` and
  `processedPeriods.length > 0`, call `setAttendancePeriods([newest.period_name], rangeOf([newest]))`.
- Render, when `cfg.periods`: label `Periods` and
  `<PeriodMultiSelect periods={processedPeriods} selected={attendancePeriods} onChange={names => setAttendancePeriods(names, names.length ? rangeOf(names) : null)} />`,
  then the divider, in the place the date range used to be. Selecting nothing
  leaves the previous dates in place.
- `hasAny`-driven *Clear filters* still appears for employee/role/manager/period.

## Verify

- `/attendance` shows `Periods [Q1-Sep-2026 ▾]` and no 30d/60d/90d or date
  inputs; the List and KPIs cover that period's dates.
- Ticking a second period widens the window; the table changes accordingly.
  `/attendance/reports` follows the same selection.
- `/process` still shows From/To. `/payroll-master` still shows the single
  Period select.
- `grep -rn "{ params:" src/app` returns nothing. Every file under 15 KB.
- Only the three files changed/created. Confirm every identifier used is imported.
