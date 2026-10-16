# International agents — prompt set (DRAFT, not sent)

Design: `docs/superpowers/specs/2026-10-16-international-agents-design.md` (v2: own Monday board,
Attendance only).

**Do not send yet.** Gates, in order:

1. **Teramind check** (Saul asked for it before anything): run `00-teramind-check.sql` (read-only) in UIB → Database once the other session is done. Are the 16 on Teramind, and under
   which emails? Their Teramind email becomes `teramind_email` in prompt 05.
2. Saul has reviewed the design and the committee pitch.
3. The other UIB session has finished, exported and committed. Rebase this branch on `main` and
   re-check every "before" snippet against the fresh `src/` (drafts written against `ec86696`).
4. Tests from the design doc written first (they fail until the export).

**Order matters: 01 → 02 → 03 → 04 → 05.** One export + sync + `git status` + tests per prompt
(CHANGE-LOOP). 02 (the payroll filter) must be live **before** 05 adds anyone, or the agents
would land in the next payroll run.

| # | File | Touches |
|---|---|---|
| 01 | `01-country-column.md` | 1 new migration (country + config keys) |
| 02 | `02-payroll-pto-contracts-panama-only.md` | `loadEmployees`, `loadPtoBalancesInputs`, `loadPtoUpcoming`, `loadContractMilestones` |
| 03 | `03-international-directory-sync.md` | new `syncIntlDirectory.ts`; `MondayAutoSync.tsx`, `updateEmployeeRoleManager`, `upsertEmployee`, `loadAllEmployees` |
| 04 | `04-access-from-international-board.md` | `syncAccessFromMonday.ts` |
| 05 | `05-seed-international-agents.md` | 1 data migration (the 16, Teramind emails) |

Saul's Monday step goes between 04 and 05: create the board and paste its ids into Admin → Rules &
Config (see the design doc).

Checks on /dev after 02 (before any agent exists): Process Payroll on the last processed period
shows the same employee count as before; the PTO and Contracts row counts are unchanged.
After 05: View As Marcela and View As Yankel → Attendance → Today / Activity show their agents;
Process Payroll, PTO, Contracts show none of them.
