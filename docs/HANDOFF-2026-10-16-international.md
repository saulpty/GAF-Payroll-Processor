# Handoff 2026-10-16: international Intake 1 agents (Marcela Gordon, Yankel Raskin)

Prompts: `superpowers/prompts/2026-10-16-international-agents/01–05, 04b`. Design:
`superpowers/specs/2026-10-16-international-agents-design.md`. Tests: `tests/internationalAgents.test.ts`
(IA1–IA12). Suite **943/944** (the one failure is the known L2, `loadEmployeeCalendar.ts`, from the
punctuality handoff). Screenshots: `assets/2026-10-16-international/`.
Committee pitch draft (HR only, no payroll): `committee/2026-10-16-company-wide-hr-hub.md`. Not sent.

## ⚠️ NOT RELEASED: read before anyone runs payroll on prod
The **migrations ran on the shared database**: `employees.country`, the config keys, and the 16 rows.
The **code that filters by country is only on /dev.** Until Saul presses Release:
- **Prod Process Payroll would include the 16** (prod `loadEmployees` has no country filter), and every
  day of theirs would come out RED. **Do not run Process Payroll on prod before the release.** The
  next run (Q2-Oct, Oct 11–25) is due around Oct 26.
- Prod PTO and Contracts list the 16 (no harm, just noise).
- The prod access sync (old code, Panama board only) may drop the 16 from Marcela's group, and the /dev
  sync puts them back. Their access flickers on prod until the release. Panama access is unaffected.

## What's live on /dev
| What | How |
|---|---|
| Monday board **🌍 International Employee Directory** (Saul - Management → HR), id `18435831051` | Made through the API playground. Current `group_mm86g7pv`, Past `group_mm86fp50`, columns Email, Role, Country, Manager, Manager Email, Manager 2, Manager 2 Email. 16 rows: Intake 1, Marcela Gordon / Yankel Raskin, Country blank (= International). An empty "Group Title" group may remain; the app ignores it. |
| `employees.country` (default Panama) + 10 config keys with the real ids | 01 (migration, byte-identical) |
| Payroll (`loadEmployees`), PTO (2 loaders), Contracts load only `payroll_country` | 02, exactly 5 lines. PTO 44 and Contracts 44 before and after the 16 were added |
| The 16 added (list names, list emails = Teramind emails, Standard 9–5 ET schedule) | 03 (migration, byte-identical) |
| International sync: pure `lib/intlDirectoryPlan.ts` + `syncIntlDirectory.ts`, run inside the Monday auto-sync; matches **by email only**, never touches a payroll-country employee, holds more than 3 new people for review | 04 (both new files byte-identical). **04b** fixed `upsertEmployee` using `EXCLUDED.country`, which a Roster save would have turned into Panama |
| Access sync also reads the new board (Manager = rank 1, Manager 2 = rank 2) | 05, exact. 19 groups, 60 placed, 0 unassigned |

Teramind: all 16 were already on the account (checked against the app's unlinked-agent list). **Sync
Teramind Roster** linked them, and Sophia Prieto too, by email. October 1–16 records pulled by hand
(9,620 saved).

## Checked on /dev
- End to end: setting Lee Ndlvu's Country on Monday to "Sync Test" made the app's `employees.country`
  read "Sync Test" after a sync. Reverted on Monday; the next sync sets it back to International.
- **View As Marcela** and **View As Yankel**: Attendance → Today lists all 16 (24 scheduled) with live
  Teramind times. Activity lists all 16, 10 days each (trend "Not Enough Data": no history before Oct 1).
  Punctuality and Reports work for the **open** period. No Payroll or Admin tabs.

## Later the same day: Punctuality and Reports in processed periods (prompts 06a, 06b)
Before, in a payroll-processed period (Q1-Oct), every day of the 16 read "Not Run Yet · No punches"
(screenshot 05). Now employees outside payroll (`in_payroll = false` from `loadAttendanceEmployees`)
get every date from Teramind (the "wide" window, `liveWindow([], from, to, today)`). Payroll
employees are computed exactly as before: `liveReportWithOutside` and `liveListRowsWithOutside` run
the old code unchanged and only replace the outside employees' rows. Screenshot 06.
- 06a (helpers, loader, type) and 06b (wiring): both byte-exact. Tests OP0–OP7
  (`tests/liveOutsidePayroll.test.ts`). LR1, LR2, LP2 and LP6 were updated, and MR4's undo list gained
  06b's edits; undoing them restores the 2026-10-13 hash. Suite **951/952** (L2 known).
- **Checked against snapshots taken before 06a:** Panama rows identical on Punctuality Q2-Oct
  (44/44) and Reports Q2-Oct (216/216) and Q1-Oct (468/468, before and after the September pull).
- Teramind September pulled by hand (17,023 saved). Q1-Oct for the 16: 90 on time, 65 late, 21 absent.
- **Company KPIs now include the 16** when a super user looks at everyone (Q1-Oct absent days 0 → 21).
  That's by design; filter by Manager to see Panama-only teams.

## Countries (Saul, 2026-10-16)
Filled on the Monday board, and copied to `employees.country` by the international sync:
- **South Africa** (10): Anna, Lee, Sam, Lisa, Pumi, Stacey, Angela, Canicia, Riley, Malcolm.
- **United States** (6), with a new **State** column `text_mm86rek0` that the app doesn't read yet:
  - Saeed GA
  - Reesie FL
  - Shmuli GA
  - Caitlin IN
  - Bekki AL
  - Dee AL

## Open
1. **Start dates are missing for the 16.** Days before someone joined count as absences: Caitlin Fry
   is absent Sep 25 – Oct 2 and Shmuli Lavner Sep 28 – Oct 5. Fix: add a Start Date column to the
   international board and have the international sync write it (the Panama sync takes start dates
   from the Onboarding board), or set them in Admin → Roster.
2. **"Not Reported" on every late day** for the 16: they don't file GAF Attendance forms on Monday.
   Ask Marcela whether they should, or whether that column should be hidden for them.
3. **Holidays**: they follow Panama's list. Ask Marcela.
4. Optional: **Backfill All Periods** on the Teramind tab, so Activity has a comparison period for the 16.
5. Release (Saul).

## Traps seen today
- The Teramind card and the Punctuality page each showed all zeros once ("Teramind could not be
  loaded"). A hard refresh fixed both: connection pressure, as before.
- Refresh skips a board synced in the last minute. The builder tab's preview also runs the auto-syncs
  as Saul, so a sync can happen there instead of in the /dev tab. Verify sync results in the data, not
  in a console.
- UIB compacted its context during 04 and still wrote both new files exactly. The one deviation was a
  "helpful" rewrite of an UPDATE line, caught by IA4.
