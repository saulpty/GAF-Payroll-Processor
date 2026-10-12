# Handoff 2026-10-12 (later): Activity trend — has this person improved?

Branch `claude/employee-improvement-tracking-3cd3a0`. Tests **744/744**.
Spec `docs/superpowers/specs/2026-10-12-activity-trend-design.md`, plan
`docs/superpowers/plans/2026-10-12-activity-trend.md`, prompts
`docs/superpowers/prompts/2026-10-12-activity-trend/01–04` (03 was split into 03 and 03b for size).
Earlier today: `HANDOFF-2026-10-12.md` (5-minute refresh, also still unreleased).

## On /dev, NOT released (waiting on Saul's go-ahead)
| What | Prompt |
|---|---|
| Attendance → Activity compares the selected dates with the same number of days right before them. New **Trend** column (Improved / Worse / Mixed / Steady / Not enough data), arrows beside numbers that moved, **⚠️ Days** and **Days Missed** columns. | 02, 03, 03b |
| Each of the four cards has a line such as `↓ 19m vs Sep 5 – Sep 23`. | 03b |
| Opening a row shows **Before and After**, the **Hours Active Each Day** chart, and **Show All N Days** (both periods side by side). | 03, 03b |
| Thresholds dialog: four **Trend Minimums** fields. | 04 |

## Already live (database, no release needed)
- Migration `1782017000_activity_trend_minimums`: `activity_trend_min_active_minutes` 30,
  `_entry_minutes` 10, `_days` 2, `_worked_days` 5 (category `teramind`). Prod ignores them until
  the release.

## Checked on /dev
- **Existing numbers did not move.** Sep 24 – Oct 9, snapshot before any change vs after, with the
  comparison on: the four card values and every existing column for all 43 employees identical.
- **Luis Abad, Sep 24 – Oct 12: Improved.** Avg active 4h 51m → 5h 36m (+45m), low days 9 of 13 →
  5 of 12, entry 9:03 → 9:01 (about the same), missed 0 → 0. His Before figures equal his row
  when the dates are set to Sep 5 – Sep 23.
- Trend sort (Worse first), tooltip dates, Show All / Hide, one-day range (all Not enough data),
  future end date, 90-day range, Thresholds save (120 removed all 19 Avg Active arrows, 30 brought
  them back), no console errors.
- View As: used the test manager account, which has no employees. Scoping and the empty state
  hold; a manager with real people was not looked at.

## Behaviour changes to know
- A scheduled day with no work and no approved reason is now a **missed day**, separate from a
  low-activity day. The top card and the amber box still count both as Needs a Look.
- **Today is left out of the comparison.** The existing Avg Active / Avg Entry / Days With Work
  cells still include it, so on a range ending today the row and the Before and After table can
  differ by a few minutes.
- **Days before an employee's start date do not count.** Found on Alberto Cornejo: the old column
  showed 9 Needs a Look, 8 of them before he started. The top card still includes such days
  (existing behaviour, untouched).
- The low-activity minimum on /dev is **5h 30m** (`activity_min_active_minutes` = 330), not the
  seeded 6h 30m.

## Watch
- One-day range: the card line reads `vs Oct 7 – Oct 7` and the tooltip says "the 1 days".
- 90-day range: 64 bars per box, the day labels under them collide. The two averages still read.
- Window narrower than about 1280px: the opened row scrolls sideways with the table, and the
  Before and After panel stacks above the chart.
- `SourceBadge.tsx` is no longer imported by anything.
- Every Activity load reads twice the date span. The side panel does not (it calls the hook
  without `compare`).
- UIB's assistant dropped the connection once mid-prompt ("Having trouble connecting"); its own
  Try again finished the job. The result was diffed byte-for-byte against the planned files.
- Design-system gaps left alone: Activity's `9:04 AM` / `45m` formats, left-aligned numbers and a
  sort icon on every header in the By Employee table.
