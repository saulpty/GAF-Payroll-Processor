# 11b — Needs A Look: the 7-day window collapses to one day (bug from prompt 11)

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

## Files that may change

- `src/app/pages/attendance/activity/ActivityNeedsLook.tsx` — the fix below, nothing else

No other file may be touched.

## What is wrong

With the range Sep 4 → Sep 18 the card reads "Worst 10, Fri Sep 18 – Fri Sep 18" and "Nothing To
Look At In The Last 7 Days", although 154 days are flagged. Prompt 11 told you to walk back with
`addDays` from `@/app/lib/activityDays` — but that helper only moves **forward**
(`Math.max(0, n)`), so `addDays(rangeEnd, -6)` returns `rangeEnd` and the window is one day. My
error, not yours.

## The fix

Do not subtract days. A date `d` is inside the last 7 days of the range exactly when
`d <= rangeEnd && addDays(d, 6) >= rangeEnd` (plain `YYYY-MM-DD` string comparison, forward
`addDays` only). Use that predicate to pick the flagged days, and for the heading compute the window
start as the smallest date that satisfies it among the 7 candidates — simplest: build the seven
dates by testing each `day.date` present in `days`, or derive the start with a tiny local helper
that steps a `YYYY-MM-DD` string back one day at a time using the same month-length arithmetic
`addDays` uses (no `new Date(str)`, no `toISOString`). Everything else from prompt 11 stays: worst
first by `activeMin`, top 10, the 5-column table, the "N flagged days in the whole range" note.

## Acceptance (check on /dev)

1. Only `ActivityNeedsLook.tsx` changed.
2. Range Sep 4 → Sep 18: the heading reads `Worst 10, Sat Sep 12 – Fri Sep 18` and the table shows
   up to 10 rows dated within that week, lowest Active first.
