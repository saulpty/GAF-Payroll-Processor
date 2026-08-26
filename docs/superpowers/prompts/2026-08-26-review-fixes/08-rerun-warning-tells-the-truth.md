# The re-run warning must say what re-running actually does

**`src/app/pages/ProcessPayroll.tsx` is a protected file.** This is a copy change
only — no logic, no behaviour, no styling beyond the words.

## The defect

Two places tell the operator that re-running replaces everything:

- **Line ~310**, inside the `isRerun` guard:
  `` `"${periodName}" already has data. Re-running will replace ALL entries for this period. Continue?` ``
- **Line ~543**, the inline amber hint under the Period Name field:
  `This period already exists — re-run will overwrite all entries.`

**Neither is true.** `upsertPayrollEntries` is `INSERT … ON CONFLICT DO UPDATE`
and **never deletes**. Re-running regenerates the days the engine still considers
workdays and updates those rows. Any row the engine no longer generates — an
off-day row left behind after a schedule change, for example — is simply not
touched, and survives with its discount intact.

This wording caused a real incident, recorded in `HANDOFF-2026-08-25.md` §5. Tim
re-processed after the weekend-schedule fix, read this message, and reasonably
concluded the stale rows were gone. They were not. It took migration
`1781900200` to remove 18 of them, worth 126 hours of discount.

## The change

Replace the wording in **both** places so it describes what actually happens.
Keep each one's existing structure, styling, icon and control flow exactly.

1. **The confirm at line ~310.** Keep `window.confirm` and the `if (!ok)` handling
   as they are. Change only the message string in the **non**-single-employee
   branch to say, in plain words, that entries for the period will be
   **regenerated and updated**, that already-resolved work will be overwritten,
   and that **rows the engine no longer generates are left in place rather than
   removed**. Keep it to two or three short sentences and keep the period name in
   it.

   Leave the single-employee message (the `empName` branch) alone — *"their
   entries will be overwritten. Everyone else's work is preserved."* is accurate.

2. **The inline hint at line ~543.** Change the sentence to match — that
   re-running updates this period's entries and overwrites resolved work, without
   claiming it replaces or removes everything. Keep it to one line; it sits in a
   narrow amber strip with an `AlertTriangle`.

Say "regenerated and updated", or similar plain wording. Do not say "replace ALL
entries", "overwrite all entries", "wipe", or "delete".

## Do not touch

- Do not change `window.confirm` into a modal. That is a separate change.
- Do not change any logic, condition, state, styling, icon or class name.
- Do not change `upsertPayrollEntries` or its behaviour. The code is doing the
  right thing; only the wording is wrong.
- Do not change any other file. **Only `src/app/pages/ProcessPayroll.tsx`.**

The diff should be two string literals and nothing else.

## Acceptance criteria

- The Process page still loads and behaves identically.
- Typing the name of an existing period still shows the amber hint under the
  Period Name field, with its new wording.
- Neither message claims that re-running replaces or removes all entries.
- Do not run a payroll to test this. Loading the page and typing an existing
  period name is sufficient.

Then confirm every identifier used in the file is imported.
