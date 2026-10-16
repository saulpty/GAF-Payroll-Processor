# International Intake 1 agents — design v2 (2026-10-16)

**Status: proposed, not built.** Nothing in UIB has changed. Prompts are drafted in
`docs/superpowers/prompts/2026-10-16-international-agents/` and wait for the gates in that folder's
README (Teramind check first).

Requested by Marcela Gordon and Yankel: their 16 Intake 1 agents who work outside Panama.

**v2 changes after Saul's answers:**
- The agents go on **their own Monday board**, not the Panama Employee Directory (too much is
  attached to that board).
- They get **only the Attendance tab**: no payroll, PTO, contracts or disciplinary.
- They work **9–5 US Eastern, Monday to Friday**. That is the existing "Standard" schedule.
- None are in the app today. Yankel is already an app user.

---

## The answer in plain language

1. **Every employee gets a Country.** Everyone in the app today is Panama.
2. **Payroll, PTO and Contracts only look at Panama.** Anyone else is invisible to those screens.
   The filter sits in the loaders, so the payroll files themselves are not touched.
3. **The international agents live on a new Monday board, the International Employee Directory.**
   The app reads it every few minutes, the same way it reads the Panama board:
   - who is in Current Employees (active),
   - their role,
   - their country,
   - their manager.
4. **Their manager on that board decides who sees them**, exactly like Panama. The access sync
   learns to read both boards. Without that it would delete Marcela's and Yankel's new groups,
   because today it removes any group the Panama board didn't produce.
5. **The first 16 are added once by a data migration.** The automatic sync refuses more than 3 new
   people at a time on purpose. After that first load, the board keeps them up to date.

Two safety rails in the new sync:
- It matches people **by email only, never by name**, so it can never grab a Panama employee.
- It **refuses to touch anyone whose country is Panama.**

## What Marcela and Yankel will see

| Screen | International agents | Why |
|---|---|---|
| Attendance → Today | ✅ | Reads Teramind directly |
| Attendance → Activity, Needs a Look, trend | ✅ | Reads Teramind directly |
| Attendance → List, Reports | ⚠️ **check on /dev** | Parts of these read payroll classification rows, which international agents won't have. If they show empty or zero rows, a small follow-up prompt makes them Teramind-only for non-Panama staff |
| Payroll (all pages), PTO, Contracts | ❌ by design | Country filter |
| Disciplinary | ❌ | Not on the Panama board, so the filing app never lists them; the viewer has no cases for them |

"Leave rules" (your question 4): the app has a **PTO Tracker tab** that calculates vacation
balances with Panama's rule (about 30 days a year). If the agents appeared there they would show
a made-up Panama balance. They simply won't appear on that tab. For them the app is only what
Teramind shows, which is what you described.

Holidays: the holiday list is Panama's. On a Panama holiday the Today board may say "Holiday" for
them too, and on their own country's holiday Activity may flag a missed day. Minor; fixable later
with per-country holidays if it bothers Marcela.

## The build — 5 prompts, order matters

| # | What | Risk |
|---|---|---|
| 01 | Migration: `employees.country` (default Panama) and the config keys for the new board (empty = off) | None: nothing reads them yet |
| 02 | Payroll, PTO, Contracts loaders filter to `payroll_country` | Low. With everyone Panama, the counts must stay identical (checked on /dev) |
| 03 | New `syncIntlDirectory.ts`, run inside the existing automatic Monday sync | Off until the board's config is filled |
| 04 | Access sync also reads the new board's Manager Email column | Off until configured |
| 05 | Data migration: the 16 agents, Teramind emails, Standard schedule, country International | Only after 02 is live |

No prompt touches `ProcessPayroll.tsx`, `classificationEngine.ts`, `syncDirectory.ts`,
`MondayTab.tsx` (at its 15 KB limit) or any other untouchable file.

## Saul's Monday and app steps (between prompts 04 and 05)

1. **Monday:** create the board **International Employee Directory** with two groups (Current
   Employees, Past Employees) and these columns:
   - Email: the email they use in **Teramind**
   - Role
   - Country
   - Manager (name)
   - Manager Email: Marcela's or Yankel's app email
2. Add the 16 rows to Current Employees.
3. **App → Admin → Rules & Config:** paste these ids into the matching `monday_…intl…` keys:
   - the board id
   - the Current Employees group id
   - the five column ids

   I can read the ids off Monday for you.
4. After prompt 05: **Admin → Employees → Teramind**. Check that each of the 16 is linked to their
   Teramind agent.
5. **View As Marcela** and **View As Yankel** → Attendance. Then **Process Payroll** on a past
   period: none of the 16 may appear.

Seats: the agents never log in, so they cost no UI Bakery seats. Yankel already has access.

## Tests to write with the prompts (`tests/`)

- `loadEmployees`, both PTO loaders and `loadContractMilestones` contain the `payroll_country` line
  (payroll guard, most important).
- `syncIntlDirectory`:
  - matches by email only
  - skips payroll-country employees
  - brake above 3 new people
  - blank country becomes International
  - no-op while the board key is empty
- `syncAccessFromMonday` appends international Current rows when configured, and is unchanged
  when not.
- Diff check: `ProcessPayroll.tsx`, `classificationEngine.ts`, `syncDirectory.ts` untouched.
- Baseline 752 plus the new ones.

## Later, only if wanted

- Per-country holidays.
- A Teramind-only Attendance List and Reports for non-Panama staff, if the /dev check shows gaps.
- A manual "Sync now" for the international board in Admin. The Monday tab has no room left,
  so it would need splitting first.
