# 05b — Attendance → List: hand the panel the employee id so Day By Day fills

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

## Files that may change

- `src/app/pages/Attendance.tsx` — the one edit below, nothing else

No other file may be touched.

## What is wrong

On the List tab the panel opens with `<AttendancePanel stats={panelStats} onClose={…} />` (around
line 145). `AttendancePanel` filters the activity days by its `employeeId` prop, which List never
passes, so the new Day By Day section always says "No activity data for this range." (Today and
Activity pass it and work.)

## The edit

`loadAttendanceEmployees` already returns `e.id` on every row (the `EmpInfo` type in
`attendanceStats.ts` just doesn't declare it). In `Attendance.tsx`, resolve the id from the
already-loaded `emps` list and pass it:

- `const panelEmpId = panelEmail ? Number((empMap.get(panelEmail) as { id?: number } | undefined)?.id) : NaN;`
- `<AttendancePanel stats={panelStats} employeeId={Number.isFinite(panelEmpId) ? panelEmpId : undefined} onClose={() => setPanelEmail(null)} />`

Do not edit `attendanceStats.ts` or the action. Nothing else in the file changes.

## Acceptance (check on /dev)

1. Only `Attendance.tsx` changed.
2. Attendance → List, Q1-Sep-2026, click "Alanis Chena": the panel's Day By Day section lists her
   days (Date · First – Last · Active · Why · Source) instead of "No activity data for this range."
