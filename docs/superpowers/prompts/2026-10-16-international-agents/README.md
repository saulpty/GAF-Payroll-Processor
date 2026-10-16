# International agents — prompt set (DRAFT, not sent)

Design: `docs/superpowers/specs/2026-10-16-international-agents-design.md`.

**Do not send yet.** Another session is editing UIB right now. Before sending:

1. Wait for that session to finish, export and commit. Then `git pull` / rebase this branch on `main`.
2. Re-check every "before" snippet below against the fresh `src/`: these drafts were written against
   commit `ec86696`. If a snippet no longer matches, fix the prompt first. Don't let UIB guess.
3. Get Saul's answers to the questions in the design doc (Q4 changes prompt 03, Q6 adds a prompt).
4. Write the tests listed in the design doc first (they fail until the export).

Order: **01 → 02 → 03 → 04**, one export + sync + `git status` + tests per prompt (CHANGE-LOOP).
All four are safe to release before any agent is added on Monday: with no Country filled in,
everyone is Panama and nothing behaves differently.

| # | File | Touches |
|---|---|---|
| 01 | `01-country-column.md` | 1 new migration |
| 02 | `02-country-from-monday.md` | `syncDirectory.ts`, `updateEmployeeRoleManager.ts`, `upsertEmployee.ts`, `loadAllEmployees.ts` |
| 03 | `03-payroll-pto-panama-only.md` | `loadEmployees.ts`, `loadPtoBalancesInputs.ts`, `loadPtoUpcoming.ts` |
| 04 | `04-roster-country-badge.md` | `RosterTab.tsx` |

Checks on /dev after 03 (before any agent exists): Process Payroll on the last processed period
shows the same employee count as before; PTO page row count unchanged.
