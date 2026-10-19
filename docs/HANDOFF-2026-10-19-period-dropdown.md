# Handoff 2026-10-19: Period dropdown fix, released

## RELEASED to prod 2026-10-19 12:00 (v8.28.3, Saul's go-ahead)

Staging first: 8.28.2 at 11:57. Then prod: 8.28.3, the same draft (UIB numbers each release
separately). The only change since 8.28.0: `FilterBar.tsx` (prompt
`docs/superpowers/prompts/2026-10-19-period-dropdown/01-period-list-retry.md`).

## What was wrong

Saul saw the Payroll Master Period dropdown with only "Choose A Period" and "All Periods".
FilterBar ignored a failed `loadPeriods` and never retried, so one connection-pressure blip left
the list empty until a full reload. Full diagnosis: `docs/findings/2026-10-19-period-dropdown-empty.md`.

## What changed

The period list now retries up to 3 times, 2 s apart. While the list is empty it says
"Loading periods…" or "Couldn't load periods, retrying…".

## Checked

- Tests 954/955. The one failure is L2 (`loadEmployeeCalendar.ts`, the unused Outlook action),
  which was already failing before this change. MR3's effect count was updated 5 → 6 for the new retry.
- /dev: full period list (16 options), no console errors.
- Staging, full cold reloads: 4 of 4 loads that finished drawing had all 16 options. The 5th was
  read before the page had drawn (slow load, not an empty list). Attendance period picker fine.
  No console errors.
- Prod: 2 full reloads, 16 options each, no console errors.
- **Not checked live:** the retry path itself. A failure could not be injected in time from the
  browser, so the "retrying" text and the recovery have not been seen in action.

## Open

- L2 test fails on `loadEmployeeCalendar.ts` (`{{params.x}}` inside quotes). That action is unused, but
  the guard stays red until it is fixed or exempted.
- Q2-Oct-2026 appears in the Payroll Master dropdown only after it is processed (by design).
