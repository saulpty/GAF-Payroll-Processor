# GAF HR Hub for the whole company — proposal to the Committee (draft v2, 2026-10-16)

*Prepared for Saul Fallembaum. **Draft for Saul's review.** Items marked ❓ need a written answer
from UI Bakery before this goes to the Committee.*

**Scope: HR, not accounting.** This proposal does **not** include payroll. US payroll and other
countries' payroll work differently from Panama's and stay with their current providers and
processes. Panama's payroll module stays exactly as it is, Panama-only.

---

## 1. What exists today

The **GAF Panama HR Hub** is one place where Panama HR runs day to day for about 45 employees:

- **Attendance**:
  - a live **Today** board: who is in, who is late, active time
  - **Activity** and trends from Teramind
  - a **Needs a Look** list of days to check
  - attendance reports
- **Employee directory** synced automatically from Monday.
- **Manager access**: each manager signs in and sees only their own people. That access is built
  automatically from the Monday directory's Manager column.
- **Contracts and tenure milestones**: 1 month, 3 months, 6 months, 1 year, contract end dates.
- **Disciplinary actions**: a filing form for managers, PDF letters, email notices and a case
  history.
- **PTO tracking.**
- **Phone views** for managers.
- *(Panama only: payroll. Out of scope for this proposal.)*

It runs on **UI Bakery** (self-hosted), **Monday.com** and **Teramind**, the tools the company
already uses. More than 800 automated checks guard it.

## 2. The ask

Make the HR side of the Hub available to the rest of the company: other countries and the US brands
(Passion to Care, Momba Ohio / Michigan / Arizona, Avondale…).

**First step, already requested:** Marcela and Yankel want their **16 international Intake 1
agents** on the Attendance tab. That step is designed and costs about one working session. It also
builds exactly what everything after it needs.

## 3. What carries over company-wide

| HR module | Ready for the company? | What it takes |
|---|---|---|
| Attendance: Today, Activity, Needs a Look, trends | ✅ for anyone on Teramind | Nothing but the employee on Teramind and on a Monday directory |
| Manager access (each manager sees only their people) | ✅ | Comes from each Monday directory's Manager column |
| Employee directory from Monday | ✅ | One Monday directory board per country or brand, registered in settings |
| Contracts and tenure milestones | 🟡 | Milestones are generic; needs each team's start dates on Monday |
| Disciplinary actions | 🟡 | Letterhead per company entity (today it says "GAF Healthcare Services Panama"); the filing form needs to read more than the Panama board |
| PTO tracking | 🔴 per country | Today it calculates balances with Panama's accrual rule. Other teams either get their own rule, or a "tracked elsewhere" mode with requests only |
| Holidays | 🟡 | One list today (Panama's); needs a list per country |
| Payroll | ⛔ out of scope | Stays Panama-only |

**In short: the core HR screens (Attendance, Directory, Access) work company-wide almost as they
are. Disciplinary, Contracts and Holidays need small changes. PTO needs a decision per country.**

## 4. Two ways to do it

### A. Duplicate the app for each country or brand
- ➕ Each copy can differ, and Panama is never affected.
- ➖ Every improvement must be made once per copy, and copies drift apart within months.
- ➖ UI Bakery's documentation does not confirm that AI-built ("vibe") apps can be duplicated.
  Export and import carries the app's design but **not its database**. ❓
- ➖ There's no company-wide view: N separate rosters.

### B. ✅ Recommended: one HR Hub for the whole company
- One app, one roster, and a **Country** on every employee.
- **Each country or brand keeps its own Monday directory board**, so its HR keeps ownership of
  its people. The Hub reads all the boards.
- **Every manager sees only their own people**, whichever board they're on. This already works
  today.
- **Panama payroll stays switched on for Panama only** and is never touched by company-wide work.
- ➕ Fix once, everyone benefits. Leadership gets one view of attendance across the company.
- ➖ It needs a few changes so the app understands multiple boards and countries (below). The pilot
  makes the first two.

## 5. Roadmap

| Phase | What | Who benefits | Size |
|---|---|---|---|
| **0. Pilot** | A Country on every employee; a second Monday directory board; the 16 international Intake 1 agents on Attendance for Marcela and Yankel | Intake team | ~1 session (designed) |
| **1. Any team, Attendance** | More directory boards added through settings only; a Country filter on Attendance; holidays per country | All managers whose teams use Teramind | ~1 week |
| **2. Disciplinary for everyone** | Letterhead per entity; the filing form reads every directory board | All managers | ~1 week |
| **3. Leave per country** | Each country's rule, or requests-only tracking | Country HR | ~1 week per country |

## 6. What it needs from the company

1. **UI Bakery licence.** Published pricing caps every plan below Enterprise at **50 viewers**.
   Viewers are the people who use the app without building it. Employees themselves never log in;
   only managers and HR do, about 25 people today. Company-wide managers will likely pass 50, which
   means an **Enterprise quote**.
   ❓ Questions for UI Bakery:
   - What does self-hosted Enterprise cost?
   - Is SSO included?
   - Can sign-in be limited to company email domains?
   - Can vibe apps be duplicated?
2. **One HR owner per country or brand** to keep its Monday directory board accurate. The board is
   the source of truth.
3. **Teramind coverage** for any team that wants Attendance.
4. **Time.** One person (Saul) builds and maintains the Hub today, with AI assistance and a strict
   change process: every change is written down first, checked by more than 800 automated tests,
   and verified on screen. A company rollout needs protected time, or a second person trained on
   the process.

## 7. Risks

| Risk | How it's handled |
|---|---|
| Company-wide changes break Panama payroll | Payroll is out of scope; its files are locked by rule; payroll only loads Panama employees, and an automated check fails if that filter is removed |
| A manager sees someone else's employees | Every employee query is scoped to the signed-in manager, enforced by tests |
| A wrong or messy Monday board | The sync matches the new boards by email only, refuses to touch Panama employees, and won't add more than 3 new people at once without review |
| Cost or lock-in with UI Bakery | The full app is exported and backed up after every change; it is never trapped |

## 8. The decision we're asking for

1. Approve the **pilot** (phase 0) now: no new cost, about one session.
2. Approve **one company-wide HR Hub, HR only and no payroll**, as the direction, subject to the
   UI Bakery quote.
3. Name **one HR owner per country or brand** for phase 1.
