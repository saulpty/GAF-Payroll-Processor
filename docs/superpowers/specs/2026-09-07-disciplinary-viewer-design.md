# Disciplinary actions viewer — one page, one new column set

Sub-project **H** — new scope, not on the original A–G roadmap. It is the last
feature before **C, Employee 360**, and is shaped so its case-file component
drops into 360 unchanged.

---

## Why

Managers file disciplinary actions through a **separate UI Bakery app**, "GAF
Disciplinary Actions Form". That app writes one row per action into a
`disciplinary_actions` table in **its own Postgres database**, connected to the
Hub on 2026-09-07 as `SAUL Disciplinary Action Forms DB`.

Two consequences, and they are the whole reason for this page:

- **Nobody can see those records from the Hub.** To learn whether an employee
  has a history you must open the other app, pick their name, and read the
  prior-actions panel — one employee at a time, and only while filing a new
  action against them.
- **Nothing records that a case was closed.** Saul, verbatim: *"in that case the
  employee improved and followup was written on email for record of case closed,
  i could later just ask managers to fill that case closed on the hub once they
  do have the access i plan to give to them."* An email is not a queryable
  record, so an improved employee and a forgotten one look identical.

---

## What the owner said

> "the idea is that we should be able of seeing every employee that has a
> disciplinary action with their info."

> "i believe this should be the last feature we add before creating the
> employee 360."

> On closure: *"shouldnt you save it into the disciplinary action database?"*

---

## Decisions taken

1. **Read the form's database live.** No copy, no mirror table, no sync job.
   `disciplinary_actions` is small (single digits today) and the form app is the
   only writer. A `monday_*`-style mirror would buy nothing and add a staleness
   failure mode.
2. **Everyone with a record appears, active or not.** A resigned employee's
   history does not vanish. Inactive employees render muted, the same visual
   grammar Contracts uses for an ended contract.
3. **No PDFs in the Hub.** Saul chose text detail. The two `pdf_*_base64`
   columns are never selected — the Eduardo Herrera row alone is ~250 KB of
   base64, and `SELECT *` on this table would put a megabyte through the wire
   for seven rows.
4. **Closure is stored in the form's own table**, via three new columns added by
   a migration **in the form app** (it owns the table and has the migrations
   folder). The Hub writes them. Rejected: a parallel closure table in
   `GAF Planilla DB`, which would split one fact across two databases and leave
   the form app unable to ever show "Closed".
5. **Read-only except closure.** No create, no edit of an action's narrative.
   The form app stays the only place an action is authored.
6. **One row per employee, not per action.** Mockups were built for all three
   shapes and Saul chose the per-employee row with the case file inside it. That
   is also the unit Employee 360 needs, so `CaseFile.tsx` composes into C for
   free — the same argument the backlog credits sub-project D with.

---

## 1. Data

### The table today

Created by the form app's migration `1751050706`, extended by `1751215850`:

```
id BIGINT identity PK,  ref TEXT,              -- 'GAF-DA-2026-6384'
manager_name TEXT,      manager_email TEXT,
employee_name TEXT,     employee_role TEXT,    employee_branch TEXT,
document_date DATE,     revaluation_date DATE,
warning_level TEXT,     final_outcome TEXT,    scenario TEXT,
q_expected TEXT,        q_happened TEXT,       q_when TEXT,   q_impact TEXT,
evidence_types TEXT[],  evidence_description TEXT,
prior_warnings TEXT,    expectations TEXT,     consequences TEXT,
signature_drawn BOOLEAN,
pdf_en_base64 TEXT,     pdf_es_base64 TEXT,    -- never selected
submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Value sets, read from the form app's `src/app/utils/disciplinaryFormData.ts`:

| Field | Values |
|---|---|
| `warning_level` | Verbal Warning → First Written Warning → Second Written Warning → Final Written Warning |
| `final_outcome` | `''` (usual) · Suspension · Termination |
| `scenario` | Operational Instructions · Calls / Lead Follow-up · Attendance / Tardiness · Inappropriate Conduct · Misuse of Systems / Tools |
| `evidence_types` | Call Report · Monday.com · Attendance Record · Email / Chat · Witnesses · Other |

**These are the form's current option lists, not a database constraint.** Nothing
in the schema enforces them, so every consumer treats an unknown value as data
to display, never as a branch that can fall through to `undefined`.

### The seven rows known from the export

Read out of the form app's seed migrations, after its two cleanup migrations:

| ref | employee | level | scenario | document | re-eval |
|---|---|---|---|---|---|
| GAF-DA-2026-9345 | Eduardo Herrera | Verbal | Operational Instructions | 2026-06-30 | 2026-07-30 |
| GAF-DA-2026-6384 | Osvaldo Medina | **First Written** | Attendance / Tardiness | 2026-06-24 | 2026-07-08 |
| GAF-DA-2026-7873 | Aleka Papatsoris | Verbal | Inappropriate Conduct | 2026-06-24 | 2026-07-08 |
| GAF-DA-2026-9827 | Juan Molina | **First Written** | Calls / Lead Follow-up | 2026-06-23 | 2026-07-07 |
| GAF-DA-2026-2645 | Juan Molina | Verbal | Calls / Lead Follow-up | 2026-06-16 | 2026-06-19 |
| GAF-DA-2026-3947 | Juan Molina | Verbal | Attendance / Tardiness | 2026-06-16 | 2026-06-23 |
| GAF-DA-2026-1674 | Navvad Owusu | Verbal | Operational Instructions | 2026-06-04 | 2026-07-10 |

Five employees, seven actions, two managers (Arelis Acosta, Marcela Gordon).
**Every re-evaluation date is in the past**, so on the day this ships every open
case is overdue — the acceptance criteria below depend on that.

These are the unit-test fixtures. **The probe (§6) counts the live table**; if it
disagrees, the live number wins for acceptance and the fixtures stay as they are.
They test pure functions, so they do not need to be exhaustive.

### The two hard facts that shape the build

**1. It is a different Postgres instance.** A UIB SQL action names exactly one
`datasourceName`. `disciplinary_actions` therefore **cannot be joined to
`employees` in SQL.** The join happens in React.

**2. `employee_name` is free text**, chosen in the form from a hardcoded list
that was itself copied from the Monday directory. There is no employee id, and
no email. This is the same situation as the Employee Onboarding board
(`src/AGENTS.md`), which is name-only matched and needed eight legal-name
aliases before it resolved cleanly.

### The migration — in the form app, not this repo

`src/migrations/<timestamp>_add_closure_columns_disciplinary_actions.sql`:

```sql
ALTER TABLE disciplinary_actions
  ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by    TEXT,
  ADD COLUMN IF NOT EXISTS closure_note TEXT;
```

Additive, idempotent, and invisible to the form app's own queries — its
`getPriorActions` selects an explicit column list and keeps listing closed
actions as prior ones, which is correct: a closed warning is still history.

`NULL closed_at` is the open state. There is no boolean, so there is no way to
have `closed = true` with no date.

---

## 2. The rules — `src/app/lib/disciplinary.ts`

Pure. No imports, no React, no clock: `asOf` is always a parameter. Modelled on
`ptoAccrual.ts` and `tenure.ts`, and loadable by Node's test runner.

```ts
levelRank(level: string): number
  // 0 Verbal, 1 First Written, 2 Second Written, 3 Final Written, -1 unknown

caseState(row, asOf): 'closed' | 'outcome' | 'overdue' | 'open'
  // closed_at set                             -> 'closed'   (wins over everything)
  // final_outcome Suspension|Termination      -> 'outcome'
  // revaluation_date null                     -> 'open'
  // revaluation_date < asOf                   -> 'overdue'
  // otherwise                                 -> 'open'

daysBetween(from: string, to: string): number     // Date.UTC / 86400000

groupByEmployee(rows, asOf): EmployeeCase[]
  // per employee_name: actions newest first, highestRank, openCount,
  // nextReval (soonest open re-evaluation >= asOf), latest, worstState
  //
  // "Newest first" is document_date DESC, then **id DESC**. The tiebreak is
  // load-bearing, not cosmetic: Juan Molina has two actions dated 2026-06-16
  // and the SQL ORDER BY cannot separate them (their submitted_at is identical
  // too), so without it his file renders in whatever order Postgres returns.
  // The later insert is the newer action.

sortEmployeeCases(cases): EmployeeCase[]
  // overdue first, then outcome, then open, then all-closed;
  // within a bucket: highestRank desc, latest document_date desc, name asc

dueSoon(rows, asOf, withinDays = 30): number
  // closed_at null AND revaluation_date <= asOf + withinDays.
  // Deliberately includes already-overdue rows, so a forgotten case keeps
  // showing rather than ageing out of the badge.
```

**Timezone invariant, restated because this repo has ~10 migrations that are all
successive fixes to the same bug.** Dates are `YYYY-MM-DD` strings and are
compared as strings. Day counts use `Date.UTC(y, m-1, d) / 86400000`. No
function constructs a `Date` from a date string, and none reads the clock.
Postgres hands back full timestamps, so every consumer slices to 10 characters —
`closed_at` is a `TIMESTAMPTZ` and needs it most.

`'closed'` winning over `'outcome'` is deliberate: a termination that has been
closed out is finished business and should not sit at the top of the page
forever.

### Tests — `tests/disciplinary.test.ts`

Hand-written here, committed **red**, before any UIB prompt. Lettered `D1…D9`.

| # | Case |
|---|---|
| D1 | `levelRank` orders the four levels; an unseen string is `-1` and never throws |
| D2 | `caseState` returns `closed` for a row with `closed_at`, even when `final_outcome` is Termination and the re-evaluation is overdue |
| D3 | `caseState` returns `overdue` for Juan's 2026-06-19 re-evaluation as of 2026-09-07, and `open` as of 2026-06-18 |
| D4 | `caseState` on a null `revaluation_date` is `open`, never `overdue` |
| D5 | `daysBetween` is exact across a month boundary, a year boundary and a DST change |
| D6 | `groupByEmployee` puts Juan Molina's three actions in one group, newest first with the id tiebreak, `highestRank` = 1 (First Written) |
| D7 | `sortEmployeeCases` puts Osvaldo (First Written, overdue) above Aleka (Verbal, overdue), and an all-closed employee last |
| D8 | `dueSoon` counts the seven fixtures as 7 on 2026-09-07 and 6 once one is closed |
| D9 | Source assertion: the module's own text contains no `new Date(` applied to a string and no `Date.now()` |

---

## 3. The page — `/disciplinary`

Structurally a copy of the Contracts feature: shell → table → row, plus a case
file and a dialog. Every file well under 15 KB.

### 3.1 Header

`PageHeader`, title **Disciplinary actions**, subtitle *One row per employee with
a record. Expand a row to read the file.* Actions, right-aligned:

- Count summary, muted: `5 employees · 7 actions · 7 open`.
- A segmented toggle **All / Open / Overdue / Closed**, page-local state, the
  same styling as the Contracts 30/60/90 buttons. Clicking the active one
  returns to All.
- **Export** — `xlsx`, one row per **action** (not per employee, so the sheet is
  a register), columns: Employee, Role, Branch, Manager, Date, Level, Outcome,
  Scenario, Re-evaluation, Status, Closed on, Closed by, Ref. No narrative
  columns — the write-ups run to several hundred words and destroy a spreadsheet.
  Filename `disciplinary-<today>.xlsx`.

### 3.2 The table — one row per employee

`DataTable`, columns:

| Employee | Manager | Actions | Highest level | Escalation | Latest | Status | |
|---|---|---|---|---|---|---|---|
| Juan Molina<br><small>Intake 1 · Vitasya</small> | Marcela Gordon | 3 | `First Written` | ●●○○ | 06-23-2026 · Calls / Lead Follow-up | `review overdue 76 d` | ⌄ |

- **Employee** — the roster's `display_name` when the name resolves, otherwise
  the form's `employee_name` plus a `StatusChip tone="slate"` reading
  **not on roster**. Role and branch on a second muted line: the roster's `role`
  when resolved, the form's `employee_role` / `employee_branch` otherwise.
  An inactive employee's name renders muted with an `inactive` slate chip.
- **Highest level** — `StatusChip`: Verbal `slate`, First Written `amber`,
  Second Written `amber`, Final Written `red`. A `final_outcome` of Suspension or
  Termination shows as its own `red` chip beside the level.
- **Escalation** — four dots, filled to `highestRank`. It answers "how far has
  this gone" without reading the level text, and makes a jump from Verbal
  straight to Final visible at a glance.
- **Status** — worst state across their open actions: `red` **review overdue N d**,
  `amber` **re-eval MM-DD-YYYY**, `green` **all closed**, or `slate` **no
  re-evaluation set**.
- Sorted by `sortEmployeeCases`. Sortable by the usual `DataTable` headers.

### 3.3 The expanded row — the case file

Full width, and **this is the component Employee 360 will reuse**, so it takes
its rows as a prop and knows nothing about the page around it.

A header strip: Actions · Highest level · Next re-evaluation · Last action, plus
the large escalation ladder. Then the actions **oldest first**, so the
escalation reads in the order it happened, each a card:

- Header: level chip, outcome chip if any, scenario, `ref` right-aligned in mono.
- Six labelled facts: **What was expected** (`q_expected`), **What happened**
  (`q_happened`), **When** (`q_when`), **Impact** (`q_impact`), **Expectations
  set** (`expectations`), **Consequences** (`consequences`). Any empty one is
  omitted, not rendered as an empty heading.
- Meta line: evidence types and description, prior warnings, re-evaluation date,
  signed yes/no, manager name and email, `document_date`, `submitted_at`.
- Footer: either **Closed MM-DD-YYYY by NAME — note** with a small **Reopen**
  link, or a **Close case** button.

Long narrative text wraps and is never clipped or truncated in the file view;
the table's Latest column is the only place text is shortened.

### 3.4 Closing a case

`CloseCaseDialog.tsx`, same shape as `pto/RecordApprovalDialog.tsx`:

- **Closed by** — text, prefilled with the action's `manager_name`.
- **Note** — textarea, placeholder *e.g. Employee improved; follow-up sent by
  email 07-10-2026.* Optional but strongly implied by Saul's actual practice.
- **Close case** writes via `useMutateAction`, then reloads the table.

`updateDisciplinaryActionClosed` sets `closed_at = NOW()` and carries
`AND closed_at IS NULL`, so a double-click cannot overwrite an earlier closure's
author and note.

**Reopen** clears all three columns. It exists because closure is the one write
this page performs and a misclick must not be permanent. No confirmation dialog:
the action is itself the undo.

### 3.5 Filters and nav

- `FilterBar.tsx` `ROUTE_CONFIG`: `'/disciplinary': { employee: true, role: true, manager: true }`.
- **Manager goes to SQL** as `{{params.manager}}`, matched against
  `manager_name` — the disciplinary DB has no roster manager, only the manager
  who filed. Employee and role filter client-side against the resolved values,
  so filtering by role works for matched employees and falls back to the form's
  `employee_role` for unmatched ones.
- **Nav** — a new top-level section in `TopNav.tsx` between Contracts and PTO
  Tracker: `id: 'disciplinary'`, `home: '/disciplinary'`,
  `paths: ['/disciplinary']`, `links: []`, icon `ShieldAlert`, `badge: true`.
  Wired exactly like the Contracts badge at `TopNav.tsx:126,185`, fed by
  `loadDisciplinaryDueCount`.
- Route in `app.tsx`: `<Route path="/disciplinary" element={<Disciplinary />} />`.

---

## 4. Matching a name to an employee

The whole join, and the one place this feature can silently lose data.

Use **`buildResolver`** from `src/app/lib/mondayResolve.ts` with `normalizeName`
from `classificationEngine`, fed by `loadAllEmployees` and `loadNameAliases`.
`src/AGENTS.md` is explicit: *"Do not write another name-matcher."* It resolves
email → `name_aliases` → normalised `display_name`, and the disciplinary rows
have no email, so this is the name-only path — exactly the Onboarding board's
situation.

**An unmatched row is displayed, never dropped.** It keeps the form's own name,
role and branch and carries a slate **not on roster** chip. Dropping it would
hide a real disciplinary action because of a spelling difference, which is the
worst failure this page could have. Unmatched names are also the signal that an
alias is needed, and the fix is the same one Contracts points at:
`/admin/employees?tab=aliases`.

Both employee-side loads already exist and are used elsewhere, so this adds no
new action against `GAF Planilla DB`.

---

## 5. Files

**Hand-written in this repo** (`tests/`, `docs/` only):

- `tests/disciplinary.test.ts` — committed red first
- `tests/hardcoding.test.ts` — H4 file list gains
  `walkTs('src/app/pages/disciplinary')`, `'src/app/pages/Disciplinary.tsx'`,
  and `|Disciplinary` in the actions regex. **Also add
  `walkTs('src/app/pages/contracts')`** — an existing gap: the Contracts page
  was never enrolled in H4.
- this spec, and `docs/superpowers/prompts/2026-09-07-disciplinary/NN-*.md`

**Produced by UI Bakery — the form app** (one prompt, one file):

- `src/migrations/<ts>_add_closure_columns_disciplinary_actions.sql`

**Produced by UI Bakery — the Hub:**

| File | Holds |
|---|---|
| `src/app/lib/disciplinary.ts` | the pure rules of §2 |
| `src/actions/loadDisciplinaryActions.ts` | every column except the two `pdf_*` |
| `src/actions/loadDisciplinaryDueCount.ts` | one `count` for the nav badge |
| `src/actions/updateDisciplinaryActionClosed.ts` | the closure write |
| `src/actions/updateDisciplinaryActionReopened.ts` | clears the three columns |
| `src/app/pages/Disciplinary.tsx` | header, toggle, export |
| `src/app/pages/disciplinary/DisciplinaryTable.tsx` | load, resolve, group, filter, sort |
| `src/app/pages/disciplinary/DisciplinaryRow.tsx` | one row, chips, ladder |
| `src/app/pages/disciplinary/CaseFile.tsx` | the expanded file — 360 reuses this |
| `src/app/pages/disciplinary/CloseCaseDialog.tsx` | close and reopen |

**Modified:** `src/app/app.tsx` (one route), `src/app/TopNav.tsx` (one section
plus badge wiring), `src/app/FilterBar.tsx` (one `ROUTE_CONFIG` line).

**Named in every prompt as untouchable:** everything under
`src/app/pages/admin/`, `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `mondayResolve.ts`,
`teramindParser.ts`, `src/components/ui/`, every Hub migration, and every
`Contracts*` / `Pto*` file.

### The action, in the shape this repo requires

```ts
return action('loadDisciplinaryActions', 'SQL', {
  datasourceName: 'SAUL Disciplinary Action Forms DB',
  query: `
    SELECT id, ref, manager_name, manager_email,
           employee_name, employee_role, employee_branch,
           document_date::text     AS document_date,
           revaluation_date::text  AS revaluation_date,
           warning_level, final_outcome, scenario,
           q_expected, q_happened, q_when, q_impact,
           evidence_types, evidence_description,
           prior_warnings, expectations, consequences, signature_drawn,
           closed_at::text AS closed_at, closed_by, closure_note,
           submitted_at::text AS submitted_at
    FROM disciplinary_actions
    WHERE ({{params.manager}} IS NULL OR {{params.manager}} = '' OR manager_name = {{params.manager}})
      AND ({{params.employeeName}} IS NULL OR {{params.employeeName}} = '' OR employee_name = {{params.employeeName}})
    ORDER BY employee_name, document_date DESC, submitted_at DESC;
  `,
});
```

Three rules, each one a bug this repo has already paid for:

- **No `SELECT *`** — it would drag both base64 PDF columns through every load.
- **`{{params.x}}` bare, never inside a quoted string.** Guarded by test L2, and
  the reason Directory Sync returned zero employees on 2026-08-11.
- **The page calls it with flat params** — `useLoadAction(action, [], { manager,
  employeeName })`, never `{ params: {…} }`. That wrapper fails silently and has
  now been found three times in this codebase.

`employeeName` rather than `employeeId` because that database has no id. It is
the parameter Employee 360 will pass.

---

## 6. The probe — before any UI work

Read-only, run through the AI panel, results written into
`docs/superpowers/prompts/2026-09-07-disciplinary/01-probe.md` and committed.
**There is no SQL console in UIB** (`UIB-GUIDE-FOR-CLAUDE.md`), so this runs as
a query the AI executes, read structurally out of the result table.

1. The datasource's exact name as UIB reports it — the connection screenshot
   says `SAUL Disciplinary Action Forms DB`, the form app's actions say
   `SAUL GA Offer Letter DB`. Confirm which string an action must use.
2. `SELECT count(*)` and `count(DISTINCT employee_name)`.
3. Every distinct `employee_name`, and how many resolve against `employees` and
   `name_aliases`. **The gate: any unmatched name is named in the probe file
   before the page is built**, so its chip is expected rather than a surprise.
4. Distinct `warning_level`, `final_outcome`, `scenario`, and the distinct
   values inside `evidence_types` — confirming the form's option lists are what
   the data actually contains.
5. Rows with `revaluation_date IS NULL`, and the min/max `document_date`.
6. That `closed_at`, `closed_by`, `closure_note` exist after the migration —
   read from `uib_migrations`, not `applied.txt`, which this project has already
   proved unreliable.

Export straight after the probe: `added: 0, changed: 0, deleted: 0` proves it
wrote nothing. If it reports 0/0/0, **check Downloads for a new zip first** —
that reading also appears when the export click merely closed the menu.

---

## 7. Acceptance

1. The probe is answered and committed before any UI prompt.
2. `node --test "tests/*.test.ts"` — 121 existing plus the new `D1…D9`, all
   passing, no existing test modified.
3. `/disciplinary` loads on `/dev/` with real data, screenshotted.
   **10 rows, 16 actions** — the counts the 2026-09-07 probe measured, not the
   7-across-5 this spec originally assumed from the exported seed files.
4. **Timothy Moore is the live example.** 4 actions, ladder filled 3 of 4 to
   **Second Written Warning**, and — the part that matters — his **Latest**
   column reads `07-09-2026 · Operational Instructions`, a *Verbal* Warning.
   Highest and latest deliberately disagree; a page keyed on the most recent
   warning would hide that he is two rungs up. Expanding him shows four cards
   oldest first: 07-01 Verbal, 07-01 First Written, 07-01 Second Written, then
   07-09 Verbal. **Three of those share a document_date**, so if they appear in
   any other order the `id DESC` tiebreak is not wired.
5. **The two inactive employees render muted** with an `inactive` chip —
   Juan Molina and Osvaldo Medina — and both still show a role, taken from the
   disciplinary record because their roster `role` is NULL.
6. **Every one of the 16 actions is overdue**, so the page opens entirely red
   and **the nav badge reads `16`**. That is a true statement about the data:
   nobody has recorded a closure because until now there was nowhere to record
   one. Do not soften the overdue rule to make the page look calmer.
7. Closing one case: the chip turns green, the badge drops by one, the row
   re-sorts downward, and the footer names who closed it and when. **Confirmed
   in the form's database, not only on screen.**
8. **Reopen** on that same case restores it exactly — badge back up, chip red.
9. Manager filter set to *Marcela Gordon* leaves Juan Molina alone.
10. Export opens in Excel with one row per action and no narrative columns.
11. `git status --short` shows only the files listed in §5.
12. Grep the new files: no `{ params:`, no `pdf_`, no file over 15 KB.

**Proved by unit test rather than on screen**, having zero live instances after
the 2026-09-07 probe: a closed case, a Suspension or Termination outcome, a
**Final** Written warning, a null `revaluation_date`, an unrecognised
`warning_level`, and an unresolvable employee name. Each must render without
throwing.

A Second Written Warning **does** have a live instance — Timothy Moore — so it
is checked on screen rather than only in a test.

---

## 8. Out of scope

- **Creating or editing an action.** The form app owns authorship.
- **PDFs.** Decided against; the columns are never selected.
- **Email or Slack alerts.** The badge is the mechanism, as it is for Contracts.
- **Manager-scoped visibility** — sub-project G. The action takes `manager` from
  day one so the wiring is free later, but nothing restricts what a viewer sees.
- **Employee 360** — sub-project C. `CaseFile.tsx` and the `employeeName`
  parameter are shaped for it; building it is a separate spec.
- **Backfilling closures** for cases already closed by email. Saul will have
  managers record them once they have access.

---

## 9. How it gets built

Through `CHANGE-LOOP.md` unchanged: every change is a committed prompt, pasted
into UI Bakery, exported, synced with `tools/sync-export.mjs`, diff-checked
against §5, tested, loaded in the browser, then committed.

Order: **spec and tests (red) → form-app migration → probe → `disciplinary.ts` →
the four actions → table and row → case file and dialog → page shell → nav,
route and filter bar → export → H4 and docs.**

Two operating notes, both from `UIB-GUIDE-FOR-CLAUDE.md`:

- **The form app is a second UIB app** with its own app id and URLs, which are
  not recorded anywhere. Find them, write them into the guide, and keep the
  one-builder-tab rule across both apps — a second editor session silently eats
  a round.
- The migration round is the only one that touches another app's data. Verify it
  through `uib_migrations` before building anything on top of it.
