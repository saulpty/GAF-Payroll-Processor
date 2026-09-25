# Action Required revamp: plan (2026-09-25)

Saul's notes from the Tim payroll run, plus the page audit. Uses the design system landed in
prompts 00–02 (`src/DESIGN.md`, Warm tokens, `ds/Combobox`, `ds/Toast`, `ds/BulkBar`,
`fmtTime`/`fmtShift`, strict `TimeInput`). `ActionRequired.tsx` is on the payroll do-not-touch
list; Saul asked for this explicitly. **The pay rules do not change**: `classificationEngine.ts`
and `punchMinutes.ts` are only imported, never edited.

## Root causes found

| Note | Cause (file:line in `src/app/pages/ActionRequired.tsx` unless named) |
|---|---|
| Screen flashes on commit, scroll resets | `reload()` flips `loading`; lines 352/366 swap the whole table for "Loading entries…" |
| "Doesn't change but does change" | `markSaved` (243) drops edits at once; rows show old values until the reload lands |
| Bulk bar on one row | `someSelected` (305) = 1+ rows, not 2+ |
| Impact with no Event: no feedback | nothing checks it; commit writes a row that stays not-ready |
| 55:00 PM accepted | parser fixed in DS-01; page still computes minutes from it and would commit it |
| Red/yellow counts wrong until toggling filter | `loadActionRequiredCounts` in `FilterBar.tsx` (92) only refetches when the period changes, never after a commit or revert (likely; reproduce first) |
| No Mon–Fri | `loadActionRequired` never selects the schedule's `work_days` |
| Can't filter by Event | only name/date search (290) |
| Dropdowns | native `<select>` with "— none —" / "— pick —" (76–107) |
| Dates `2026-06-05`, times `9:00 AM–5:00 PM` | raw strings (480, 492) |
| File is 39 KB | limit is 15 KB |

## Prompts (one at a time, full change loop after each)

**AR-1: split, no visible change.** Move into `src/app/pages/action-required/`: `arTypes.ts`,
`arLogic.ts` (pure: filter, sort, selection helpers), `ArRow.tsx`, `ArCommitted.tsx`,
`ArConfirm.tsx`, `useArSave.ts`. `ActionRequired.tsx` becomes a thin shell. Check: page
identical before/after (screenshots), every file under 15 KB, tests green.

**AR-2: no flash, no stale rows, toast.** The spinner shows only on the first load; later
reloads are silent. On commit, committed rows leave the table immediately and the reload runs
quietly; scroll, filters and the remaining selection stay. Toast `Committed 3 Rows · Undo`
(Undo = the existing revert, for those rows). Counts in the filter bar and the nav badge
refresh after every commit/revert (a version number in `GlobalFilterContext`, same pattern as
`periodsVersion`).

**AR-3: guards.** A row cannot be committed with an impossible time or an impact without an
event. Picking an impact first flashes the Event box red with `Pick an event first`. Refused
rows are listed in the confirm dialog instead of a browser alert. The bulk bar (`ds/BulkBar`)
shows only for 2+ selected rows; a single row gets its own small `Commit` button.

**AR-4: the Warm look.** Title Case headers; `ds/Combobox` for Event, Impact and Doc; dates via
`fmtDay` (`Wed Sep 16`); a Shift column via `fmtShift` (`Mon–Fri · 9AM–5PM`; the loader adds
the schedule's `work_days`, keeping its current filters); a **Discount** column computed live
from the row's current event/impact (`14 min` / `Paid`); status pill; fixed column widths
per DESIGN.md; selected row `bg-warm-tint` with the orange bar.

**AR-5: filters.** Chips `Red · Yellow · Needs an Event` with counts from the current filters;
an Event filter; sort by Event, Impact and Status.

**AR-6: committed section.** Same look and dates; revert unchanged.

Separate, small, any time: shorter display names (`Gisselle Ramos`, `Maria Urriola`) with
their full names kept as aliases (a migration).

## Tests written first (in `tests/`)
`arLogic` pure functions: refusal reasons (bad time, impact without event), discount display,
filter and sort, 2+ rule for the bulk bar. Static guards: no `window.alert` in the page,
spinner only when there are no rows yet, bulk bar threshold 2.

## Verification per prompt
Export, sync, `git status` shows only the allowed files, all tests pass, then on `/dev` after a
hard refresh: screenshot the page and exercise the change on a real row **without committing**
(discard afterwards). Commit and push.

## Order and release
AR-1 → AR-6 in order. Each is a draft until Saul clicks Release; release after AR-3 (all fixes,
old look) or after AR-6 (everything), Saul's call.
