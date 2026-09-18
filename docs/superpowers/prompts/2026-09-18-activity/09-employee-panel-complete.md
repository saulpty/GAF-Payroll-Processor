# 09 — Employee panel: one complete panel from every entry point

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`. Never create a
top-level folder named `src`.**

## Files that may change

- `src/app/pages/attendance/AttendancePanel.tsx` — the frame (edits 1, 2, 3)
- `src/app/pages/attendance/AttendancePanelBody.tsx` — unchanged unless a prop is needed
- `src/app/pages/attendance/AttendancePanelDays.tsx` — nothing (already handled by prompt 08)
- NEW `src/app/pages/attendance/AttendancePanelKpis.tsx` — edit 2
- NEW `src/app/pages/attendance/useEmployeeStats.ts` — edit 1

No other file may be touched. Every file under 15 KB.

## What is wrong

Opened from the List tab, the panel shows the attendance KPIs, the arrival chart, recent activity,
the donuts and then Day By Day. Opened from Today or Activity it shows only the name and Day By Day
— the caller passes `stats={null}` and the body is skipped. The owner's expectation (mock-up of
2026-09-18): **the same full panel from every entry point**, with the activity numbers added.

## Edit 1 — the panel computes its own attendance stats when none are passed

New hook `useEmployeeStats({ email, employeeId, dateFrom, dateTo })`: loads
`loadAttendanceEmployees` with `{ viewAs }` and `loadAttendanceDaily` with
`{ dateFrom, dateTo, email: resolvedEmail, viewAs }` (flat params; `viewAs` from `useViewer()`),
builds the same `empMap` / `matchEmails` the List tab
builds (see `src/app/pages/Attendance.tsx` lines 72-95) restricted to that one email, and returns
`computeEmployeeStats(rows, empMap, matchEmails)[0] ?? null`.

Two things the hook has to get right:

- **`resolvedEmail` is derived inside the hook, not passed in.** From Activity and Today the caller
  knows only `employeeId`, and the id-to-email mapping lives in the `loadAttendanceEmployees` result
  the hook itself loads — passing the email in is circular. So
  `resolvedEmail = email || emps.find(e => Number(e.id) === employeeId)?.email || ''`. The daily
  load runs once with `''` and re-runs when the email resolves; that is fine, but return `null`
  while `resolvedEmail` is empty instead of computing, or the panel briefly shows whole-company
  numbers.
- **`EmpInfo` in `src/app/lib/attendanceStats.ts` has no `id` field**, although the SQL returns one.
  Cast at the call site the way `Attendance.tsx` line 105 already does: `(e as { id?: number }).id`.
  Do not add `id` to `EmpInfo` — `attendanceStats.ts` is not in the file list.

In `AttendancePanel.tsx`: call the hook unconditionally and **above** the existing
`if (!stats && resolvedId === null) return null;` guard on line 36, then
`const stats = propStats ?? hookStats`. The body (`AttendancePanelBody`) renders whenever `stats`
is not null and keeps its single `stats: EmpStats` prop — it needs nothing else.

## Edit 2 — header and activity KPIs (the mock-up)

Header: a round avatar with the initials, the name, then one muted line
`<role> · <schedule start–end> · Manager <manager>` (use what `stats` / the employee row provide;
omit missing parts). Under it a muted line `<Wed Sep 4> – <Wed Sep 18> (follows the page filter)`
using `fmtDayShort` from `@/app/lib/activityDays`.

`stats.schedule` is already the string `"08:00 – 17:00"` (built in `computeEmployeeStats`), so the
muted line is `${role} · ${stats.schedule} · Manager ${manager}` with the missing parts dropped.

New `AttendancePanelKpis.tsx`: four tiles in one row, taking the `ActivityDay[]` the panel already
computes as `panelDays` (`propDays ?? hookDays.filter(...)`, `AttendancePanel.tsx` lines 33-34) for
the range — **Avg Active** (days worked only, from `activeMin`), **Avg Entry** (mean of `shownFirstMin`
through `fmtClock`), **On Time**, **Needs A Look** (count of `needsLook`).
Same tile style as the Today page tiles. Rendered above the attendance body.

**On Time takes its number from `stats.pctOnTime`**, not from the activity days: `ActivityDay` has
no scheduled-start field (`startMin` is computed and thrown away inside `buildActivityDays`, line
270), and `src/app/lib/activityDays.ts` is not in the file list. `computeEmployeeStats` already
produces `pctOnTime` and it is the same number the List tab's table shows, so the app keeps one
definition of On Time. Show `—` when `stats.days === 0`.

## Edit 3 — order inside the panel

Header → activity KPI tiles → existing attendance body (its KPIs, arrival chart, recent activity,
donuts — unchanged) → Day By Day. Title Case for every label. The close button and the slide-in
behaviour stay as they are.

## Acceptance (check on /dev)

1. Only the listed files changed; all under 15 KB.
2. From Activity, click Alanis Chena: header with initials and role line, four activity tiles, the
   arrival chart and donuts, then Day By Day. From List and Today the panel looks identical.
3. View As a manager: the panel opens only for their own people (the loaders are already scoped).
