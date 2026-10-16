# GAF HR Hub for the whole company — proposal to the Committee (draft, 2026-10-16)

*Prepared for Saul Fallembaum. Draft: the pricing numbers marked ❓ need a written answer from UI Bakery
before this goes to the Committee.*

---

## 1. What exists today

The **GAF Panama HR Hub** runs Panama HR and payroll for ~45 employees in one place:

- **Payroll:** pulls Teramind punches and Monday forms, classifies every employee-day, builds the
  quincena, exports to the payroll provider (HRK).
- **Attendance:** a live Today board, Activity and trends from Teramind, a Needs a Look list,
  attendance reports.
- **PTO, Contracts and tenure milestones, Disciplinary actions** (with a separate filing app for
  managers, PDF letters and emails).
- **Manager access:** each manager signs in and sees only their own people. Their access is built
  automatically from the Monday Directory.
- Works on phones (manager screens).

It is built on **UI Bakery** (self-hosted), **Monday.com** and **Teramind**, with 800+ automated checks
guarding the payroll rules.

## 2. The ask

Use what was built for Panama across the company: other countries and brands (Passion to Care,
Momba Ohio / Michigan / Arizona, Avondale…), starting with the 16 international Intake 1 agents that
Marcela and Yankel have asked for.

## 3. What carries over and what doesn't

Most of the app is **not** Panama-specific. The parts that are Panama-specific are exactly the parts
where every country differs by law anyway.

| Module | Works company-wide? | Why |
|---|---|---|
| Employee directory sync from Monday | ✅ with config | Board and column ids already live in settings, not code |
| Manager access (each manager sees only their people) | ✅ as is | Built from Monday's Manager columns |
| Attendance: Today, Activity, Needs a Look, trends | ✅ if on Teramind | Thresholds already configurable |
| Contracts and tenure milestones | ✅ as is | Generic milestones |
| Disciplinary viewer and filing app | 🟡 small work | Letterhead says "GAF Healthcare Services Panama"; the filing app has Panama board ids in code |
| Phone views | ✅ as is | |
| **PTO accrual** | 🔴 rebuild per country | Panama's rule (1 day per 11, about 30 days/yr) is written into the code |
| **Payroll engine, Action Required, HRK export** | 🔴 rebuild per country | Panama labour terms (Tardanza, Ausencia, Incapacidad…), discount minutes, the provider's export format |
| Holidays | 🟡 small work | One holiday list for everyone today |

**In short: about 70% of the screens carry over with configuration. Payroll and PTO need rebuilding
for each country.** That matches how HR works: every country has its own payroll provider and labour
law, and a shared tool should not pretend otherwise.

## 4. Three ways to do it

### A. Duplicate the app per country or brand
Copy the Hub and rewire each copy to that country's Monday boards.
- ➕ Panama is never at risk; each country can differ freely.
- ➖ Every fix and feature must be made N times. The copies drift apart within months.
- ➖ UI Bakery's docs do not confirm that AI-built ("vibe") projects can be duplicated. Export and
  import carries the app's model but **not the database or its migration history**. ❓
- ➖ N databases, so there is no company-wide view.

### B. One app, everything shared, including payroll
- ➕ One system and one roster.
- ➖ Rewriting the payroll engine so it handles several countries is the riskiest change possible
  to the part that pays people. It is large, and it would put Panama payroll at risk.

### C. ✅ Recommended: one Hub that knows each employee's country, with payroll per country
- One app, one database and one roster, with a **Country** on every employee.
- **Shared modules** serve everyone: Directory, Access, Attendance and Activity, Contracts and
  Disciplinary.
- **Country modules** are switched on per country: Panama keeps its Payroll and PTO untouched.
  Another country gets its own payroll or leave module only if it wants one; otherwise it keeps
  its current provider and uses the Hub for everything else.
- Each country keeps **its own Monday Directory board**, registered in settings with its country.
  That country's HR keeps ownership of its data.
- ➕ Fix once, everyone benefits. There is one company-wide view for leadership, and Panama payroll
  is never touched.
- ➖ Needs a short design phase for the multi-board Directory and per-country holidays and letterheads.

**The first brick of option C is already designed and costs about one working session:** the 16
Intake 1 agents. It adds a Country to every employee and keeps non-Panama people out of Panama
payroll. That makes it a low-risk pilot that proves the model.

## 5. Roadmap for option C

| Phase | What | Who benefits | Size |
|---|---|---|---|
| 0. Pilot | Country on employees; the 16 international Intake 1 agents go live for Marcela and Yankel | Intake team | ~1 session (designed) |
| 1. Company directory | Several Monday Directory boards (one per country/brand), per-country holidays, a country filter, letterhead per entity, filing app reads settings | All managers | ~1–2 weeks |
| 2. Company attendance | Teramind for every country on the Teramind account; Activity and Needs a Look for all managers | Operations | Depends on Teramind coverage |
| 3. Leave per country | Leave rules per country (or a "tracked elsewhere" mode) | Country HR | ~1 week per country |
| 4. Payroll per country (optional) | Only for countries that want it, built as that country's own module | Country payroll | ~3–6 weeks per country |

## 6. What it needs from the company

1. **UI Bakery licence.** Published pricing caps every plan below Enterprise at **50 viewers**
   (people who use the app without building it). Employees themselves never log in; only managers
   and HR do. Today that is about 25 people. Company-wide managers will very likely pass 50, which
   means an **Enterprise quote**. ❓ Ask UI Bakery:
   - the price on self-hosted Enterprise
   - whether SSO is included
   - whether sign-in can be limited to company email domains
   - whether vibe projects can be duplicated
2. **One owner per country** for that country's Monday Directory board and settings.
3. **Teramind coverage** if a country wants Attendance and Activity.
4. **Time.** Today the app is built and maintained by one person (Saul) with AI assistance, through a
   strict change process: every change is written down, checked against 800+ automated tests and
   verified on screen. Company scale means either protected time for this, or a second person
   trained on the process.

## 7. Risks and how they're handled

| Risk | Mitigation |
|---|---|
| Panama payroll breaks | Payroll files are locked by rule; the country filter sits outside the engine; automated guards fail the build if the filter is removed |
| A manager sees employees who aren't theirs | Every employee query is scoped to the signed-in manager, enforced by tests |
| Data quality on Monday (blank country, duplicates) | Blank country is treated as Panama on purpose, so nothing leaks *out* of Panama. The sync refuses to add more than 3 new people at once without review |
| UI Bakery cost or lock-in | The full code is exported and backed up to GitHub after every change, so the app is never trapped |

## 8. The decision we're asking for

1. Approve the **pilot** (phase 0) now: no cost, about one session.
2. Approve **option C** as the direction, subject to the UI Bakery Enterprise quote.
3. Name an **owner per country** for phase 1.
