# Handoff 2026-10-13 (later): phone rows on every manager page; two Attendance fixes

`main` = see `git log -1`. Tests **897/897**. Earlier today: `HANDOFF-2026-10-13-mobile.md` (stage 1,
released by Saul around midday). Prompts: `superpowers/prompts/2026-10-13-mobile-rows/` and
`superpowers/prompts/2026-10-13-list-range/`. Screenshots: `docs/assets/2026-10-13-mobile-rows/`.

## On /dev, NOT released (waiting on Saul)

| What | Prompts |
|---|---|
| **Attendance → List counted 30 days under a 3-day period** when reached from another page. Fixed. | list-range 01 |
| **Back in Periods mode the period's own dates apply again** (Dates → Periods, or Activity → List). | list-range 02 |
| Attendance → Today: one row per person on a phone; counts on one line; the header scrolls away | 08 |
| Employee panel: a full-screen sheet on a phone, day rows, no charts | 09 |
| PTO Tracker: rows; a manager's row opens in place, a super user's opens a sheet with Record / Edit / Withdraw | 10a, 10b, 10c, 10d |
| Contracts: rows with the Contract End pill and the next milestone; opens to all five | 11a, 11b, 11c, 11d |
| Disciplinary: rows (no story text on the list), case file as a sheet, an action opens in place | 12a, 12b |
| One disciplinary action: 44 px buttons, one-column edit form | 13 |
| Attendance → List: rows with a Sort By box; the ordering rule is one shared function | 14a, 14b |
| Attendance → Activity: By Employee, By Day and Needs a Look as rows | 15a, 15b |
| Attendance → Reports: tiles two across; tap a day for its details | 16 |

Every export was compared with its prompt applied by script: all files byte-identical. No
do-not-touch file changed. Each page was re-checked at computer width after its prompt.

## The List bug, in plain words

On arrival the page asked the database twice within a few milliseconds: once for "the last 30 days"
(nothing chosen yet) and once for the period the filter bar picks. Measured on /dev: the 30-day
answer came back 218 ms after the 3-day one, and the later answer won. The page now keeps only the
days inside the range it is showing. Before: `526 of 854 Expected` under `10-11 → 10-13`. After:
`62 of 76`, the same as loading the page directly. Reports was never affected (it only reads the
days in its range).

## What went wrong on the way, and the rule that came out of it

- **Prompt 10 (PTO, 28 KB, three new files) came back rewritten in UI Bakery's own words.** Caught by
  the byte comparison (5 of 6 files differed, 8 tests failed). Reverted in UIB with "Revert to this
  checkpoint" on the previous message; the export after the revert matched git exactly. Resent as
  three prompts of 9–13 KB: all byte-identical.
- **Rule: keep a prompt under about 14 KB, and order the parts so the app compiles after each one.**
  11, 12, 14 and 15 were split the same way before sending; none was rewritten. 08 (24.6 KB) and
  03 (27 KB) had come back exact, so size alone is not the whole story, but small has never failed.
- **A line that slides sideways can be squeezed to nothing** when it sits in a fixed-height column
  next to a list that does not shrink. Seen on PTO (12 px of 23) and Contracts (24 px of 36);
  fixed with `phone:shrink-0` (10d, 11d). Check every new sliding line for this.
- Tests that pin a file's hash (`MD1`, `mobileDialogs.test.ts`) had to be re-pinned when a later
  prompt added code to the same file. `scratchpad/md1.mjs` did it; the newer tests pin more tightly.
- Screenshots timed out late in the session (the Chrome window was not in front). Reading the page
  with a script still worked and was used for the last checks.

## Known and accepted (each is written into its prompt)

- On a phone, Activity has no Before and After, day chart or side-by-side days, and no sort box.
- Reports on a phone shows the tile view only: no table view, no verdict filter chips.
- Column-heading explanations are not written out on a phone; per-value ones are.
- Pills reused from the computer are 11 px (the phone rule says 12).
- By Day on Activity can be long on a phone (474 rows for two weeks).
- Console: one React "unique key" warning from the computer's `CaseFile.tsx` (a keyless fragment in
  its row map). It predates this work.

## Before releasing

1. Saul's phone: Today, an employee, PTO, Contracts, Disciplinary, List, Activity, Reports.
   Upright and sideways. One PDF download from a disciplinary action.
2. A manager's view on a phone (View As was checked for PTO: 13 rows, no buttons).
3. Saul's go-ahead.

## Not done

- Payroll and Admin are still computer-sized pages that slide on a phone (by design).
- `CaseFile.tsx`'s key warning; `StatusChip` at 12 px on a phone; a sort box for Activity.
