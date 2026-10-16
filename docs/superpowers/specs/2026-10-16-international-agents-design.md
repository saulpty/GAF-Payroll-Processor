# International Intake 1 agents — design (2026-10-16)

**Status: proposed, not built.** Nothing in UIB has changed. The prompts that build it are drafted in
`docs/superpowers/prompts/2026-10-16-international-agents/` and wait for (a) the other UIB session to
finish and be exported, and (b) Saul's answers to the questions at the bottom.

Requested by Marcela Gordon and Yankel: add their 16 Intake 1 agents who work outside Panama.

---

## The answer in plain language

**Give every employee a Country, read from Monday, and let the app treat "Panama" as one country
among others.** Payroll and PTO keep working only for Panama. Everything else (Attendance, Activity,
Disciplinary, Contracts, access for managers) works for everyone, scoped to their managers as usual.

How the agents get in: **they go on the same Monday Panama Employee Directory board, in the
Current Employees group, with a new "Country" column filled in and Marcela or Yankel in the Manager
Email column.** From there the existing automation does the rest: the employee row, Marcela's and
Yankel's access, the Disciplinary form's employee list, the Contracts start dates.

Why this is the long-term way and not a shortcut:

| Option | What happens | Verdict |
|---|---|---|
| **A. Add them as normal employees** (no change) | They land in Panama payroll: every day with no Teramind punch becomes RED, 420 min docked, Action Required floods. Panama PTO balances get invented for them. | ❌ Breaks payroll |
| **B. Add them with "Excluded from payroll" ticked** | Out of payroll, but that same tick also hides them from Attendance, Activity and the Today board — the very screens Marcela wants. | ❌ Hides them from their managers |
| **C. Separate manual group in Admin → Access** | The access sync rebuilds groups from Monday every ~15 minutes and **deletes any group Monday didn't produce**. A hand-made group would vanish. | ❌ Gets wiped |
| **D. A second app for them** | Copies everything, doubles every future fix, needs its own Monday wiring. For 16 people. | ❌ Too heavy |
| **E. Country column (recommended)** | One new field. Payroll and PTO filter to Panama; everything else shows everyone. Monday stays the single source of truth, so it stays automatic. | ✅ Also the foundation for the company-wide pitch |

Option E is the same first step the committee pitch needs. If the company later grows into the app,
"country" is already there; if the committee picks duplication instead, nothing is wasted.

---

## What each screen will do for an international agent

| Screen | After the change | Notes |
|---|---|---|
| Process Payroll, Action Required, Payroll Master, HRK | **Not included.** | Filter is in `loadEmployees` (an action), so `ProcessPayroll.tsx` is not touched. |
| PTO Tracker | **Not included** (draft default). | Panama accrual (DAYS360/11) would show a made-up balance. Saul to confirm — see Q4. |
| Attendance → Today | Included, if they are on our Teramind. | Reads Teramind sessions directly. |
| Attendance → Activity / Needs a Look | Included, if on our Teramind. | Their public holidays (not Panama's) will look like missed days until per-country holidays exist (phase 2). |
| Attendance → List, Reports | **Probably empty for them.** | Both read payroll classification rows, which won't exist. Check on /dev after rollout. |
| Disciplinary viewer + Form app | Included. | Form reads the same Monday board, Current group — no change needed. **But the PDF letterhead says "GAF Healthcare Services Panama"** — see Q6. |
| Contracts | Included. | Start dates from the Onboarding board, if they're on it. |
| Manager access | Automatic. | The access sync builds Marcela's/Yankel's groups from the Manager Email columns. |

---

## The build (4 prompts, ~1 session)

| # | What | Files |
|---|---|---|
| 01 | Migration: `employees.country` (text, default `'Panama'`, never null) + 2 config keys: `monday_col_directory_country` (empty until Saul adds the column) and `payroll_country` = `Panama`. | 1 new migration |
| 02 | The Directory sync reads the Country column and writes it (blank = Panama). New employees created by the sync get it too. | `syncDirectory.ts`, `updateEmployeeRoleManager.ts`, `upsertEmployee.ts`, `loadAllEmployees.ts` |
| 03 | Payroll and PTO only load employees whose country = `payroll_country`. | `loadEmployees.ts`, `loadPtoBalancesInputs.ts`, `loadPtoUpcoming.ts` |
| 04 | Roster shows a small Country badge for anyone not in Panama (read-only; Monday owns it). | `RosterTab.tsx` |

Nothing touches `ProcessPayroll.tsx`, `classificationEngine.ts` or any other untouchable file.
`MondayTab.tsx` (14.9 KB, at the limit) and `MondayAutoSync.tsx` are **not** edited: they hand the
action functions straight to `syncDirectory`, so an action that accepts one more field needs no
change in them.

Safety property: **until someone types a country on Monday, the app behaves exactly as today.**
Everyone defaults to Panama.

---

## Saul's non-code steps (in this order, after the 4 prompts are exported and checked)

1. **Monday:** add a column "Country" (Status or Dropdown) to the Panama Employee Directory board.
   Copy its column id into Admin → Rules & Config → `monday_col_directory_country`.
2. **Monday:** add the 16 rows in the **Current Employees** group with Name, Email, Role = Intake 1,
   Country = e.g. South Africa, Manager Email = Marcela's or Yankel's.
   ⚠️ Fill Country *before* moving a row into Current Employees — a row there with a blank Country
   counts as Panama and would enter the next payroll run.
3. **App:** Admin → Employees → Monday → **Sync now**, tick the 16. (The automatic sync refuses
   more than 3 new people at once on purpose — that's the brake, not a bug.)
4. **App:** Admin → Schedules — create their schedule (US Eastern pairs; South Africa has no DST, so
   summer and winter times differ) and assign it in Roster. New people otherwise get the most common
   Panama schedule.
5. **App:** Admin → Employees → Teramind — check each one is linked to a Teramind agent.
6. **UIB:** invite Yankel to the workspace (Users & Permissions) — one more seat. The access sync
   creates his app user automatically once his email is in a Manager column.
7. Check on /dev with **View As Marcela** and **View As Yankel**, then run Process Payroll on a past
   period and confirm none of the 16 appear.

The agents themselves never log in, so **they cost no UIB seats.** Only Yankel does.

---

## Questions for Saul (answers change the prompts)

1. **Teramind:** are these 16 on *our* Teramind account? If not, Attendance and Activity will be
   empty for them and the main value becomes Disciplinary + Contracts + a roster.
2. **What do Marcela and Yankel want to see?** Attendance/Activity? Disciplinary? Leave?
3. **Yankel's email**, and does he already have a UIB login?
4. **Leave/PTO:** whose rules apply to them? Draft default: hide them from PTO.
5. **Hours:** do they work US Eastern hours (like Panama) or local hours?
6. **Disciplinary PDF:** is "GAF Healthcare Services Panama" wrong on their letters? Which entity
   employs them? (Separate small prompt if so.)
7. **Same board or their own board?** Recommended: the same Directory board (everything is
   automatic today). A separate board per country is cleaner on Monday but needs the sync, the
   access sync and the form app taught to read several boards — that's the company-wide step, not
   this one.
8. Some of these emails share domains with Panama staff (`passiontocarehc.com`, `mombaoh.com`), so
   the domain can't tell countries apart — which is why it has to be an explicit Country column.
   Is any of the 16 already in the app? (Check Admin → Roster by email before step 2.)

---

## Phase 2 (only if needed)

- **Per-country holidays** (`holidays.country`), so a South African holiday stops looking like a
  missed day in Activity.
- **Country filter** on Attendance pages for super users.
- **Letterhead per entity** on the disciplinary PDF.

## Tests to add with the prompts (hand-written, `tests/`)

- `loadEmployees` SQL contains the `payroll_country` filter (payroll guard — the most important one).
- Both PTO loaders contain it.
- `syncDirectory` passes `country` to both `updateRoleManager` and `upsertEmp`; blank → `Panama`.
- `ProcessPayroll.tsx` and `classificationEngine.ts` unchanged by the four prompts (diff check).
- Baseline stays 752 + the new ones.
