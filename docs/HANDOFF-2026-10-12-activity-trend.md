# Handoff 2026-10-12 (later): Activity trend — has this person improved?

Branch `claude/employee-improvement-tracking-3cd3a0`. Tests **746/746**.
Spec `docs/superpowers/specs/2026-10-12-activity-trend-design.md`, plan
`docs/superpowers/plans/2026-10-12-activity-trend.md`, prompts
`docs/superpowers/prompts/2026-10-12-activity-trend/01–05b` (03 was split into 03 and 03b for size;
05 and 05b are the review fixes).
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

## Independent review (fresh reviewer, whole branch) and what was fixed
No Critical findings. Three Important, all fixed in prompts 05 + 05b, each with a test that failed first:
1. **A range ending today or later was compared against a full earlier period**, so the later
   period always had fewer counted days and looked better on low and missed days. The comparison
   now stops at yesterday and the earlier period is the same number of days before that
   (`comparisonRanges`, tests T21/T22). Sep 24 – Oct 12 now reads "Sep 24 – Oct 11 with the 18 days
   right before it, Sep 6 – Sep 23"; picking Oct 1 – Oct 31 compares Oct 1 – 11 with Sep 20 – 30.
2. **The Avg Entry arrow used the official punch while the cell beside it uses Teramind.** Both use
   Teramind now (T13).
3. **The data hook's memo did not list `compare` / the period end as dependencies** (TW2).
Re-checked on /dev after the fixes: existing numbers still identical for all 43 employees on
Sep 24 – Oct 9; Luis Abad unchanged (Improved, 4h 51m → 5h 36m, 9 of 13 → 5 of 12); a today-only
range shows Not enough data with no card lines; no console errors.

Prompt 05 is a lesson: UIB's assistant compacted its context mid-task and **reworded** two blocks
instead of copying them (its version put a wrong end date on a range starting today). The guard
test caught it; 05b restored the exact text.

Reviewer's minor points, not acted on: tooltip does not mention permission days; the Thresholds
dialog's "scaled proportionally" line now sits above fields it does not apply to, and 2.5 days
rounds to 3; the ▼/▲ on the Show All button are read aloud by screen readers; the side panel
still computes trends it does not show; `previousRange` caps at 1000 days silently;
`useActivityData.ts` is 13.9 KB (cap 15) and needs a split before its next edit.

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
- One-day range in the past: the card line reads `vs Oct 7 – Oct 7` and the tooltip says "the 1 days".
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
