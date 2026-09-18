# 10 — Attendance → Today: tooltips

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

## Files that may change

- `src/app/pages/attendance/AttendanceToday.tsx` — column headers
- `src/app/pages/attendance/TodayRow.tsx` — status chip titles
- NEW `src/app/pages/attendance/TodayTiles.tsx` — the tile row and its tooltip texts

No other file may be touched. Every file stays under 15 KB. `AttendanceToday.tsx` is already 13.0 KB,
and sixteen tooltip sentences add roughly 2 KB, so **do the split first**: move `SummaryTile` (line
28) and the tile row (lines 244-251) into `TodayTiles.tsx`, passing the counts it needs as props,
then add the tips. Do not skip the split and hope it fits.

## The edit

Use the house `InfoTip` (default export from `@/app/components/InfoTip`, prop `text`) next to each
tile label and each column header, exactly as `AttendanceTable.tsx` does (line 139). The table has
**ten** headers (line 303-312) and the tile row **eight** tiles, and `Scheduled` is the name of both
a tile and a column — they mean different things and get different sentences. Texts (Title Case
labels, plain sentences):

**Tiles**

- Scheduled: "People whose work days include today. Day-off and not-yet-hired people are not counted."
- Working: "Teramind saw activity in the last 20 minutes."
- Away: "Started today but no activity for 20 minutes or more."
- Not In Yet: "No activity yet and still within the grace period after the scheduled start."
- On Leave: "A PTO, permission, sick form, other form or holiday covers today."
- No Records: "Scheduled, past the grace period, no Teramind activity and no report on file."
- Finished: "Last activity was more than an hour ago and after the scheduled end."
- Late Arrivals: "First activity after the scheduled start plus grace."

**Column headers**

- Employee: "Name and role. Click a row to open the full employee panel."
- Status: "What the Hub thinks the person is doing right now, from the last Teramind record."
- Scheduled: "This person's scheduled start and end for today."
- Why: "The reason the Hub knows for a missing or short day: PTO, permission, sick or other form, holiday, WFH, day off. 'No Reports Yet' means nothing is on file."
- Entry: "First Teramind activity today, US Eastern."
- Late: "Minutes after the scheduled start. Green when inside the grace period."
- Last Activity: "Most recent Teramind record."
- Idle: "Minutes since the last activity."
- Active Time: "Sum of Teramind activity today, cut to the minute."
- Records: "Number of Teramind time records today."

In `TodayRow.tsx`, give each status chip a `title` attribute (native tooltip) carrying the same
sentence as its tile: Working, Away, Not In Yet, On Leave, No Records, Finished.

Also add one InfoTip next to the green `Live` label (`AttendanceToday.tsx` line 183): "Unofficial, live view from the Teramind copy. Payroll is
the official record. Data updates every 15 minutes."

## Acceptance (check on /dev)

1. Only the listed files changed; all three under 15 KB.
2. Hovering the ⓘ next to "No Records" shows its sentence; all eight tiles and all ten column
   headers have one, and the tile and the column both named Scheduled say different things.
