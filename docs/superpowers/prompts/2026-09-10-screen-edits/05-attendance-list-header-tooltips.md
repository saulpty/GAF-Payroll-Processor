# 05 — Attendance List: a tooltip on every column header

## Files you may change

- `src/app/pages/attendance/AttendanceTable.tsx`

**No other file may be touched. No calculation changes** — every number on the
page is identical before and after.

## Change

Import `InfoTip` from `@/app/components/InfoTip`. In the local `Th` component,
after the label and before the sort icon, render `{tooltip && <InfoTip text={tooltip} />}`
(keep `title={tooltip}` on the `<th>` too). The non-sortable Status header gets
the same `<InfoTip text={STATUS_TOOLTIP} />` after its label.

Give every header a `tooltip`. Keep the four existing strings; add these:

- Employee — "Name from the roster. Click a row to open the viewer."
- Role — "Role from the Employee Directory."
- Manager — "Manager from the Employee Directory."
- Schedule — "The shift assigned in Admin → Schedules; lateness is measured against its start time."
- On Time — "Days clocked in at or before the scheduled start."
- Total Late — "Days clocked in after the scheduled start (Reported + Unreported)."
- Reported — "Late days that had a GAF Attendance form on file."
- Unreported — "Late days with no GAF Attendance form."
- Absent — "Scheduled days with no clock-in and no time off or permission."
- % On-Time — "On Time ÷ Expected. Green 90%+, amber 75–89%, red below 75%."
- 1–10m — "Late days where the delay was 1 to 10 minutes."
- 11–30m — "Late days where the delay was 11 to 30 minutes."
- 31+m — "Late days where the delay was more than 30 minutes."

## Verify

- Hovering any List header shows its ⓘ tooltip. Sorting still works on every
  sortable column. The file stays under 15 KB.
- Only this file changed. Confirm every identifier used is imported.
