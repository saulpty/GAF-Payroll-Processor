# 14 — Attendance → Today: stale data must not read as "everyone is Away"

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

## Files that may change

- `src/app/pages/attendance/AttendanceToday.tsx` — the edit below, nothing else

No other file may be touched (in particular not `src/app/lib/teramindToday.ts`). The file stays
under 15 KB.

## What is wrong (seen on prod 2026-09-18, 3:41 PM Eastern)

The board showed **0 Working · 38 Away**, every row idle "21m", "Data As Of 3:21 PM". Nobody had
left: the Teramind copy was simply 21 minutes old (the keep-fresh sync only runs while a super
user has the Hub in a visible tab), and the page judges Working / Away / idle against the wall
clock (`nowMin = easternMinutes(Date.now())`). Anything older than 20 minutes turns the whole
company Away.

## The edit

1. Next to the existing `dataAsOf` memo (the newest `synced_at`), also keep the same instant as a
   number: `dataAsOfMin: number | null` = `easternMinutes(ms)` (null when there is no data).
2. The clock handed to `buildToday` is the **data's clock when the data is behind**:
   `const statusNowMin = isToday && dataAsOfMin !== null && nowMin - dataAsOfMin > 2 ? dataAsOfMin : nowMin;`
   Pass `nowMin: statusNowMin` to `buildToday` (and add `dataAsOfMin` to that memo's dependency
   array). Statuses, idle minutes and late logic then mean "as of the last update", which is all the
   Hub can honestly know.
3. When `isToday && dataAsOfMin !== null && nowMin - dataAsOfMin > 25`, show one amber single-line
   notice under the header line:
   "Data Is {N} Minutes Old — Statuses Are As Of {h:mm AM/PM}. It Refreshes While A Super User Has
   The Hub Open." (`N = nowMin - dataAsOfMin`, time via `fmtClock(dataAsOfMin)`). No notice when the
   data is fresh, and never for a past day.

Nothing else changes: same loaders, timers, tiles, columns, tooltips and Why logic.

## Acceptance (check on /dev)

1. Only `AttendanceToday.tsx` changed; under 15 KB.
2. With data a few minutes old the board looks exactly as before.
3. Reason it through in your summary: with data 30 minutes old, a person whose last record ended
   at the data time shows **Working**, not Away, and the amber notice appears.
