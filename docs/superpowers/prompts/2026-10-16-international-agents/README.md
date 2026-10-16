# International agents — prompt set

Design: `docs/superpowers/specs/2026-10-16-international-agents-design.md` (v2: own Monday board,
Attendance only). Tests: `tests/internationalAgents.test.ts` (IA1–IA12, fail until the exports).

Gates (all done 2026-10-16):
1. ✅ Teramind check: all 16 are on Teramind, emails match the list. `00-teramind-check.sql` kept for re-checks.
2. ✅ Saul's go-ahead.
3. ✅ Other UIB session done; branch merged with main (ca51c32).
4. ✅ Monday board **🌍 International Employee Directory** created in Saul - Management → HR
   (board `18435831051`, Current `group_mm86g7pv`, Past `group_mm86fp50`). 16 rows in Current,
   Role Intake 1, Manager Marcela Gordon, Manager 2 Yankel Raskin, Country blank (= International).
   Screenshot `docs/assets/2026-10-16-international/01-monday-board.jpg`.

**Order matters: 01 → 02 → 03 → 04 → 05.** One export + sync + `git status` + tests per prompt.
02 (the payroll filter) must be live **before** 03 adds anyone.

| # | File | Touches |
|---|---|---|
| 01 | `01-country-column.md` | 1 new migration (country + config keys with the real board ids) |
| 02 | `02-payroll-pto-contracts-panama-only.md` | `loadEmployees`, `loadPtoBalancesInputs`, `loadPtoUpcoming`, `loadContractMilestones` |
| 03 | `03-seed-international-agents.md` | 1 data migration (the 16) |
| 04 | `04-international-directory-sync.md` | new `lib/intlDirectoryPlan.ts`, new `syncIntlDirectory.ts`; `MondayAutoSync.tsx`, `updateEmployeeRoleManager`, `upsertEmployee`, `loadAllEmployees` |
| 05 | `05-access-from-international-board.md` | `syncAccessFromMonday.ts` |

Checks on /dev:
- After 02: Process Payroll (last processed period), PTO and Contracts show the same counts as before.
- After 03: Admin → Employees → Teramind → **Sync Teramind Roster** once (links the 16 by email).
- After 05: View As Marcela and View As Yankel → Attendance → Today / Activity show the 16;
  Process Payroll, PTO, Contracts show none of them.
- Follow-up prompt: Punctuality and Reports for non-Panama staff (they read payroll rows).
