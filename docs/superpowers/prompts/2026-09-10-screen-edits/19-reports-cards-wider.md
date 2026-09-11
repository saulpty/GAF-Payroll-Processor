# 19 - Reports cards: 170 px wide so "Late - Reported After Shift" fits

## Files you may change

- `src/app/pages/attendance/AttendanceReportStrips.tsx` - one class

**No other file may be touched.**

## Change

In `DayTile`, the card's `w-[150px]` becomes `w-[170px]`. Nothing else.

## Verify

- On `/attendance/reports` (Cards) the status line "Late - Reported After Shift" is fully visible on one line.
- Only this file changed, by one class name.
