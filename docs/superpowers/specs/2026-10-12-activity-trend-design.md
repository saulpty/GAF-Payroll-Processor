# Design — Activity trend: has this person improved?

Design agreed with Saul in chat 2026-10-12. Awaiting his review of this file.

Branch: `claude/employee-improvement-tracking-3cd3a0`.
Mockup (clickable, invented numbers): `docs/superpowers/specs/mockups/2026-10-12-activity-trend-layouts.html`,
layout **2 · Summary and chart**. The mockup is the reference for layout and wording.

## Context

Saul spoke with Luis Abad on Sep 23 about very low activity. On Oct 12 he wanted to know
whether it worked. He had to remember the date, set the Activity date range twice, and
compare two averages in his head.

The Activity tab already computes everything needed per person per day (active time,
entry, exit, breaks, Needs a Look, reasons for days away). It shows one date range at a
time and has no before/after view.

## Goal

On Attendance → Activity, for whatever dates are selected, show for every employee whether
they improved, got worse or stayed the same compared with the period right before, and let
Saul open one person to see the evidence.

Success: Saul sets the dates to Sep 24 – Oct 12, finds Luis, and reads the answer without
changing the dates again or doing arithmetic.

## Decisions made in the session

| Question | Decision |
|---|---|
| What is compared | The selected date range against the same number of calendar days ending the day before it starts. Follows the date bar. Always on, no switch. |
| What is measured | Average active time, average entry time, low-activity days, days missed. |
| Where | Activity tab, By Employee view. By Day view, the Needs a Look box and the side panel do not change. |
| Detail layout | Mockup layout 2: Before / After / Change table on the left, day-by-day bar chart on the right, a full-width button that opens every day side by side. |
| Low-activity marker | A ⚠️ beside the Active time replaces the "Needs A Look" pill in day lists. The main column is headed "⚠️ Days". |
| Not in this design | Logging conversations; a "since this date" shortcut; a weekly trends tab; export; a sentence verdict; sample-size hints; grey slots for away days in the chart. |

## What the user sees

### Top cards

The four existing cards keep their value and label. Each gains one line underneath
comparing with the previous period, for the employees currently on screen:

- Avg Active Time: `↑ 14m vs Sep 5 – Sep 23`
- Days With Work: `498 in Sep 5 – Sep 23` (neutral, never coloured)
- Needs a Look: `↓ 9 vs Sep 5 – Sep 23`
- Late Arrivals: `↑ 7 vs Sep 5 – Sep 23`

Green when the change is for the better, red when for the worse, grey `Same as …` when
equal. These lines show the raw difference; the minimums below apply only to per-employee
verdicts.

### By Employee table

Columns: Employee, **Trend**, Days With Work, Avg Active, Avg Entry, Avg Exit, **⚠️ Days**,
**Days Missed**, Away Days.

- **Trend** is a pill: Improved (green), Worse (red), Mixed (yellow), Steady (grey),
  Not enough data (outline). Sorting by it orders Worse, Mixed, Steady, Improved,
  Not enough data.
- **Trend tooltip** (the ⓘ in the header), with real dates filled in:
  "Compares Sep 24 – Oct 12 with the 19 days right before it, Sep 5 – Sep 23. Days off,
  PTO, sick days and holidays are left out of both. Change the dates above to compare a
  different period."
- A small arrow sits beside Avg Active, Avg Entry, ⚠️ Days and Days Missed **only when that
  measure moved past its minimum**. The arrow points the way the number went; its colour
  says whether that is good (green) or bad (red). No arrow means no meaningful change.
- **⚠️ Days** reads `2 of 13`: low-activity days out of days with work.
- **Days Missed** reads `1 of 13`: missed days out of scheduled days that count.

### Opened row (click the arrow beside a name)

Replaces today's single day list.

1. **Before and After** panel: the Trend pill, then a table with rows Avg Active, Avg Entry,
   ⚠️ Days, Days Missed and columns Before (with its dates), After (with its dates), Change.
   Change reads `+1h 11m`, `12m earlier`, `5 fewer`, or `About the same` when under the
   minimum.
2. **Hours Active Each Day** panel: one sentence of explanation, then two boxes side by
   side, Before and After, each headed with its dates and "5h 37m a day on average".
   One bar per scheduled day that counts. Navy bar = normal day, yellow = under the
   minimum, pink column with a red ✕ = missed. Scale 0h–8h on the left. A solid black
   line at the period's average, a dashed yellow-ink line at the low-activity minimum. Day
   letter and date under each bar. Legend underneath. Hovering a bar shows the date and
   the exact active time.
3. **Full-width button**: `▼ Show All 26 Days · entry, exit, active and breaks for each day`. Opens two day lists side by side, Before on the left and After on the
   right, newest first, each topped with its four figures. Columns: Date, Entry, Exit,
   Active (with ⚠️ when low), Breaks (with the existing Long Break chip when it applies).
   A missed day is one red line "No work and no approved reason". An away day is one line
   with its existing reason chip (PTO, Sick, Holiday, Permission…) in place of the times.
   The button then reads `▲ Hide the 26 Days`.

When there is not enough data, the opened row shows one line saying so and the current
period's day list only.

## Design system

Follows `docs/DESIGN-SYSTEM.md` (Warm variant) and `src/DESIGN.md`. The points that apply here:

- **Tokens, never raw hex.** Verdict pills use the Excel status tokens: Improved =
  green tint + green ink, Worse = red tint + red ink, Mixed = yellow tint + yellow ink;
  Steady and Not enough data are neutral slate. Good/bad arrows use green ink and red ink.
  Chart: normal bar `--primary` (navy), low-activity bar yellow fill with a yellow-ink
  outline, missed day red tint with a red-ink ✕, minimum line yellow ink. The Show All
  Days button is a secondary (outline) button, 36px high, not a pill.
- **Case.** Title Case for panel titles, column headers, row labels and buttons
  (`Before and After`, `Hours Active Each Day`, `Days Missed`, `Show All 26 Days`).
  Sentence case for the tooltip, the chart's explanation line, the legend and the
  not-enough-data line. Never ALL CAPS: the period tags read `Before` and `After`.
- **Formats.** Dates through the tab's existing `fmtDayShort` (`Wed Sep 16`), times through
  `fmtClock`, durations through `fmtDuration`. Nothing hand-formatted.
- **Type and shape.** 13px cells, 12px/600 headers, 11px only for chart axis labels; tabular
  figures on every number. Cards 1px border, 8px radius, `shadow-card`. Pills only for
  status chips. Spacing from the 4px scale.
- **Tables.** Numeric columns right-aligned in the new Before and After table and the day
  lists. No zebra striping; a low-activity day row uses the yellow tint, a missed day row
  the red tint. Sticky headers as today.
- **Accessibility.** Colour is never the only signal: every arrow has a direction and a
  text equivalent (`title` / `aria-label` such as "12m earlier, better"), chart bars carry
  a text label for screen readers, the ⚠️ has an accessible name, buttons are real
  `<button>`s with the global focus ring.

**Known gaps, left alone on purpose** (the design system says to flag, not silently fix):
the existing By Employee table left-aligns its numbers and shows a sort icon on every
header, and the Activity tab formats times as `9:04 AM` and short durations as `45m` where
the design system says `9:04AM` and `45 min`. This work keeps the tab consistent with
itself and does not restyle the existing columns.

## Rules

1. **Previous period.** `N` = calendar days in the selected range, inclusive. Previous
   period = the `N` days ending the day before the range starts.
2. **Days that count.** A scheduled day, before today, with no approved reason (the tab's
   existing "excused" test: PTO, sick, holiday, permission, day off). Today is left out of
   every comparison figure because it is a partial day. Unscheduled days with work are
   left out too.
3. **Day with work.** A day that counts and has activity (the tab's existing test).
4. **Low-activity day.** A day with work whose active time is under the existing
   threshold for that person's shift.
5. **Missed day.** A day that counts with no activity at all.
6. **Avg active / Avg entry.** Averages over days with work, in the comparison only.
7. **Minimums.** A measure counts as changed only when it moves by at least:
   30 minutes of average active time; 10 minutes of average entry time; 2 low-activity
   days; 2 missed days. Day counts are compared as plain counts.
8. **Better or worse.** More active time is better. Earlier entry is better. Fewer
   low-activity days is better. Fewer missed days is better.
9. **Verdict.** Improved = at least one measure better, none worse. Worse = at least one
   worse, none better. Mixed = both. Steady = none moved past its minimum.
10. **Not enough data.** Fewer than 5 days with work in either period. No arrows, no
    verdict.

### Two behaviours to confirm when reviewing

- **Low-activity and missed are now separate.** Today a scheduled day with no activity and
  no reason is counted as "Needs a Look". Here it becomes a missed day, and ⚠️ Days counts
  only days that had some work. The two add up to today's Needs a Look number, so the top
  card and the amber Needs a Look box do not change. The By Employee column does: it shows
  `2 of 13` where it showed a single count.
- **Today is excluded from the comparison, not from the existing columns.** The Avg Active
  and Avg Entry cells in the main table keep today's behaviour (today included). The
  Before / After table excludes today. On a range ending today the two can differ by a few
  minutes.

## How it is built

Nothing near payroll. No new database table. No new loader.

**Data.** `useActivityData` fetches the five range loaders once for the combined span
(start of the previous period to the end of the selected range) instead of the selected
range only, then builds the existing per-day result twice, once per period, from the same
rows. `buildActivityDays` already walks a date range and looks each day up, so it needs no
change for this. The plan must confirm `buildAttendanceReport` behaves the same way when
handed rows from a wider span; if it does not, fall back to building the report once for
the combined span and filtering its rows per period.

**Calculation.** A new pure file `src/app/lib/activityTrend.ts` (no React, no `Date`
maths; dates stay `YYYY-MM-DD` strings and use the existing `addDays`):

- `previousRange(dateFrom, dateTo)` → `{ from, to, days }`
- `summarisePeriod(days)` → `{ scheduled, worked, avgActiveMin, avgEntryMin, lowDays, missedDays }`
- `compareEmployee(before, after, minimums)` → per-measure change and tone, plus the verdict
- `compareTotals(before, after)` for the top cards

It reads the `ActivityDay` rows the tab already produces. `activityDays.ts` is 13.5 KB and
stays untouched.

**Settings.** Four new `classification_config` rows, category `teramind`, added by an
insert-only migration (`ON CONFLICT DO NOTHING`, with a rollback comment), read with the
same fallback-and-notice pattern as the existing three:

| Key | Default |
|---|---|
| `activity_trend_min_active_minutes` | 30 |
| `activity_trend_min_entry_minutes` | 10 |
| `activity_trend_min_days` | 2 |
| `activity_trend_min_worked_days` | 5 |

Super users edit them in the existing Thresholds dialog on the Activity tab.

**Screens.** New files under `src/app/pages/attendance/activity/`, each under 15 KB:

| File | Job |
|---|---|
| `TrendPill.tsx` | The verdict pill and the change arrow. |
| `ActivityCompare.tsx` | The Before / After / Change panel. |
| `ActivityDayChart.tsx` | The two-box bar chart. Plain markup, no chart library. |
| `ActivityDaysSideBySide.tsx` | The two day lists behind the button. |

Changed: `AttendanceActivity.tsx` (card lines), `ActivityByEmployee.tsx` (columns, opened
row; the existing expanded day table moves into `ActivityDaysSideBySide.tsx`),
`useActivityData.ts` (combined span, second build, new settings),
`ActivityThresholds.tsx` (four more fields), `activityTypes.ts` (new types).

**Access.** No new loader, so scoping is unchanged: managers see the trend for their own
people through the existing scoped loaders.

**Failure.** Unchanged: if any loader fails, the tab shows its existing error box and no
partial tables.

**Cost.** Every Activity load now reads twice the date span. The default view goes from 15
days to 30.

## Testing

- `tests/activityTrend.test.ts`, written before the prompts: previous-range arithmetic
  across a month end and a year end; each rule above; each verdict; the exact-minimum
  boundaries (29 vs 30 minutes, 1 vs 2 days, 4 vs 5 worked days); today excluded; excused
  days excluded; a missed day not counted as low-activity; an employee with no rows in the
  earlier period.
- Existing suite stays green (baseline 718).
- In the browser on `/dev` after a hard refresh: set Sep 24 – Oct 12, check Luis Abad's
  Before / After figures against the two ranges viewed separately in the released app;
  check the tooltip dates; sort by Trend; open and close the day lists; confirm By Day,
  the Needs a Look box and the side panel are unchanged; check as a manager through View
  As.

## Delivery

Through the change loop, as separate UIB prompts so each diff stays small: migration and
settings; data and calculation; table columns and top cards; opened row (compare panel and
chart); day lists and button. Release only on Saul's go-ahead.
