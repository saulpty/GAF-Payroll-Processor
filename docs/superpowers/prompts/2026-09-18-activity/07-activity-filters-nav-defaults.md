# 07 — Activity: filters must filter, Attendance starts on Today, Dates by default

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`. Never create a
top-level folder named `src`.**

## Files that may change

- `src/app/pages/attendance/activity/useActivityData.ts` — edit 1
- `src/app/pages/attendance/activity/AttendanceActivity.tsx` — edits 1 and 2
- `src/app/TopNav.tsx` — edit 3 (link order only)
- `src/app/pages/Attendance.tsx` — edit 3 (tab order, and `/attendance` opens Today)
- `src/app/FilterBar.tsx` — edits 4 and 5

No other file may be touched. Every file stays under 15 KB.

## Edit 1 — the Employee / Manager / Role filters do nothing on the Activity tab (bug)

Choosing a manager (e.g. Mendel Silverman) or typing an employee (e.g. Maria Urriola) leaves all
44 rows on screen. Fix it at the source so every number on the tab agrees: in `useActivityData.ts`,
read `employee`, `manager` and `role` from `useGlobalFilters()` (the same values the List tab
reads — see `src/app/pages/Attendance.tsx` lines 78–90 for the exact matching:
`matchesManager(e, manager)` from `@/app/lib/managerFilter`, `role` equality, and the employee
text matched case-insensitively against name or email) and filter the **employees array before it
is passed to `buildActivityDays`**. Then `days`, `byEmployee`, `totals` (KPI tiles) and the Needs A
Look list all follow automatically. Do not filter in the components.

Three details that decide whether this works:

- Filter `employees` at the top of the `useMemo` (the `(rawEmps as ReportEmployee[])` line), before
  both `buildAttendanceReport` and the `activityEmployees` map. `ReportEmployee` has `email`;
  `ActivityEmployee` does not, so the employee-text match is only possible at that point.
- **Add `employee`, `manager` and `role` to that `useMemo`'s dependency array.** It is written out
  by hand and ends `..., rawConfig, safeFrom, safeTo]`. Leave them out and the memo never
  recomputes — the filters go on doing nothing, which is the bug being fixed.
- Keep `useActivityData`'s signature `{ dateFrom, dateTo }`; it reads the filters itself. Do not add
  parameters, because `AttendancePanel.tsx` also calls this hook and is not in the file list.

## Edit 2 — Activity starts on Dates · Last 14 Days, never on an empty period

In `AttendanceActivity.tsx`: when the page mounts and `attendanceMode` is not `'dates'`, or
`dateFrom`/`dateTo` are empty, set `attendanceMode` to `'dates'` and the range to the last 14 days
ending today (use the same setters `AttendanceRangeControls` uses; today via `toLocalYMD(new Date())`
is already imported). The user can still switch to Periods afterwards. Remove the silent
`daysAgo(7)` fallback so the range on screen is always the range being shown.

Run this **once per mount**, guarded by a `useRef` that you set on the first run, with an empty
dependency array. An effect that depends on `attendanceMode` would snap the user straight back to
Dates the moment they choose Periods. The `isOneDay` default for the By Day / By Employee switch
now reads `dateFrom === dateTo` on whatever the range currently is; leave it as a `useState`
initialiser, do not turn it into an effect.

## Edit 3 — tab order and landing page

Order everywhere is **Today · Activity · List · Reports**: the links in `TopNav.tsx` (the
`/attendance` group) and the tab bar in `Attendance.tsx`. Visiting `/attendance` (the group's
`home`) must open **Today**: in `Attendance.tsx`, when the path is exactly `/attendance`, navigate
(replace) to `/attendance/today`. `List` keeps its route `/attendance` for its own content only when
reached via the List link — simplest: give List the explicit route `/attendance/list` and make
`/attendance` redirect to Today; update the List link and `tabFromPath` accordingly, and keep the
`isAttDash` logic in TopNav consistent with the new List path.

How to do it without breaking anything:

- In `Attendance.tsx` the redirect is the **first thing in the component**, before the
  `if (tab === 'today') …` early returns: `if (pathname === '/attendance') return <Navigate
  to="/attendance/today" replace />;`. Do not add a `useEffect` after those returns — that is a
  conditional hook and React will throw.
- `tabFromPath` already falls through to `'list'`, so `/attendance/list` needs no new branch, but
  add `if (pathname.includes('/list')) return 'list';` for readability. `app.tsx` keeps its
  `/attendance/*` splat unchanged — it already matches `/attendance/list`.
- In `TopNav.tsx` change only the List link's `to` to `/attendance/list` and the link order. The
  section's `home: '/attendance'` and `paths: ['/attendance']` stay as they are (the redirect
  handles the section button). The `isAttDash` special case and the `l.to !== '/attendance'`
  exclusion on the line above it are then dead — delete both and let the ordinary `isLinkActive`
  decide.
- **Do not touch the `'/attendance'` key in `FilterBar`'s `ROUTE_CONFIG`.** `getConfig` falls back
  on `pathname.startsWith(key + '/')`, so `/attendance/list` inherits that entry and keeps its
  filters; `/attendance/today` has its own exact key and is unaffected. Renaming the key to
  `/attendance/list` would leave the List page with no config at all.

## Edit 4 — the Manager filter is for super users only

In `FilterBar.tsx`, render the Manager select only when the viewer is a super user (`isSuper` from
`useViewer()`, already used elsewhere in the app). Managers only ever see their own people, so the
control is noise for them. `FilterBar` already calls `useViewer()` for `viewAs` — add `isSuper` to
that same destructuring, do not add a second call. Nothing else in the bar changes.

## Edit 5 — the Periods/Dates default picks the wrong route (bug, blocks edit 2)

In `FilterBar.tsx`, `ATTENDANCE_SWITCH_ROUTES` is matched with
`Object.keys(...).find(k => pathname === k || pathname.startsWith(k + '/'))`. `'/attendance'` is the
first key, so `/attendance/activity` matches it and the tab is forced into **Periods** mode —
`'/attendance/activity': 'dates'` has never once been used. Make the match pick the **longest**
matching key instead (sort the candidate keys by length, descending, and take the first). Edit 2
then sets the range on a tab that is already in Dates mode, instead of racing the Periods
auto-select that fills `dateFrom`/`dateTo` from the newest processed period.

## Acceptance (check on /dev)

1. Only the five files changed; all under 15 KB.
2. Activity, Manager = Mendel Silverman: only his people in By Employee, the KPI tiles and Needs A
   Look shrink to match. Employee = "maria urriola": one row.
3. Opening `/attendance` lands on Today; tabs read Today · Activity · List · Reports. `/attendance/list`
   shows the List page with its full filter bar (Periods/Dates switch, Employee, Role), and the List
   tab is the highlighted one.
4. A fresh visit to Activity shows Dates mode with the last 14 days and data, no "Choose…" state.
5. View As a manager: no Manager select on any Attendance tab.
