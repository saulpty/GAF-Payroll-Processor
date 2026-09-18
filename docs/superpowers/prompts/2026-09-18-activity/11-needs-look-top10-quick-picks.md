# 11 — Needs A Look: the 10 worst of the last week, as a real table; quick picks 30 / 90 days

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`. Never create a
top-level folder named `src`.**

## Files that may change

- `src/app/pages/attendance/activity/ActivityNeedsLook.tsx` — edit 1
- `src/app/pages/attendance/activity/AttendanceActivity.tsx` — edit 1 (only what is needed to pass
  the range end and the threshold settings to the list)
- `src/app/components/AttendanceRangeControls.tsx` — edit 2

No other file may be touched. Every file stays under 15 KB.

## Edit 1 — Needs A Look

Today the box lists every flagged day in the range as loose text (first 10 + Show All). The owner
wants a short, readable "who should I look at" list instead:

- **Scope:** only flagged days (`d.needsLook`) whose date falls in the **last 7 calendar days of the
  selected range** (the 7 days ending on the range's end date; compare `YYYY-MM-DD` strings — use
  `addDays` from `@/app/lib/activityDays` to walk back, never `new Date(str)`).
- **Order and size:** worst first, **top 10 only**, no Show All. "Worst" = lowest `activeMin`
  (a day with no records is 0 and therefore first); ties → newest date first, then name.
- **Layout:** a compact table inside the existing amber card, with a header row:
  **Employee · Date · Active · Short By · Why**.
  - Date as `Wed Sep 17` (`fmtDayShort`), Active via `fmtDuration` (`No Records` when
    `d.records === 0`).
  - Short By = the employee's threshold for that day minus `activeMin`, via `fmtDuration`
    (threshold = `Math.round(d.shiftMinutes * (settings.minActiveMinutes / 480))`, the same formula
    the lib uses; `settings` is already returned by `useActivityData` after prompt 08 — pass it in).
  - Why = the day's reason chip (`WhyChipBadge`), usually `No Reports Yet` or `—`.
- **Heading:** `Needs A Look — Worst 10, <Thu Sep 11> – <Wed Sep 17>` and, at the right, a muted
  `N flagged days in the whole range` so the big number is still visible.
- Clicking a row keeps whatever prompt 08 wired (open that employee expanded); if nothing was
  wired, rows are not clickable.
- When there are no flagged days in those 7 days, show one muted line "Nothing To Look At In The
  Last 7 Days" inside the card. The KPI tile `Needs A Look` keeps counting the whole range.

## Edit 2 — quick picks

In `AttendanceRangeControls.tsx` remove the quick picks **This Period So Far** and **Last Period**
(and any helper code only they used). Add **Last 30 Days** and **Last 90 Days**, built exactly like
`Last 14 Days` (range ends today). Final order:
`Today · This Week · Last 14 Days · Last 30 Days · Last 90 Days`.

## Acceptance (check on /dev)

1. Only the three files changed; all under 15 KB.
2. Activity, Last 14 Days: the amber card shows a 5-column table with at most 10 rows, all dated
   within the last 7 days of the range, lowest Active first; the heading names that week.
3. The quick-pick row reads Today · This Week · Last 14 Days · Last 30 Days · Last 90 Days; Last 90
   Days loads and the By Employee table fills.
