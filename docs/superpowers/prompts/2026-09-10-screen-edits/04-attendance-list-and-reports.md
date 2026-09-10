# 04 — Attendance: two tabs, List and Reports; delete Dashboard and Trends

## Files you may change

- `src/app/pages/Attendance.tsx`
- `src/app/TopNav.tsx`
- `src/app/FilterBar.tsx`
- `src/app/lib/attendanceStats.ts` — remove `computeTrends` only
- `src/AGENTS.md` — the `/attendance/*` row of the routes table only
- **Delete:** `src/app/pages/attendance/AttendanceDonuts.tsx`,
  `src/app/pages/attendance/AttendanceTrends.tsx`

**No other file may be touched.** `AttendanceTable.tsx`, `AttendancePanel.tsx`,
`AttendanceKpis.tsx` and everything under Reports stay byte-identical.

## Attendance.tsx

- `type Tab = 'list' | 'reports'`.
- `tabFromPath`: `/reports` → `'reports'`, everything else → `'list'` (so the
  old `/attendance/employees` URL still works).
- Remove the `AttendanceDonuts` and `AttendanceTrends` imports and their two
  render branches. The `tab === 'employees'` block becomes the `'list'` branch,
  otherwise unchanged (KPI tiles above, "Employee Directory" header, the table,
  the panel).
- `AttendanceInner` prop type follows: `tab: 'list'`.

## TopNav.tsx

The `attendance` section's `links` become exactly:
```ts
{ to: '/attendance',         label: 'List',    icon: Users },
{ to: '/attendance/reports', label: 'Reports', icon: FileText },
```
Remove the `TrendingUp` import if nothing else uses it. `Activity` stays (the
section icon). The existing `/attendance` exact-match special case in the
sub-link loop keeps working for List.

## FilterBar.tsx

In `ROUTE_CONFIG`, delete the `'/attendance/employees'` and `'/attendance/trends'`
rows. `'/attendance'` and `'/attendance/reports'` stay as they are.

## attendanceStats.ts

Delete `computeTrends` and any type used only by it. Everything else in the
file is untouched. The file must keep having zero imports.

## AGENTS.md

`/attendance/*` row: "two tabs driven by URL (List, Reports)".

## Verify

- Clicking Attendance opens the List (the table) with the KPI tiles above it.
  Sub-nav reads List · Reports, in that order.
- `/attendance/reports` unchanged. `/attendance/trends` now shows the List.
- Only the listed files changed or were deleted. Confirm every identifier used
  in each edited file is still imported.
