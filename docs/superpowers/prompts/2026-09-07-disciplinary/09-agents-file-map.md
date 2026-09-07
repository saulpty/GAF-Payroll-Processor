# Update `src/AGENTS.md` — the file map is two features behind

**Modify exactly one file: `src/AGENTS.md`.**

**No other file may be created, modified or deleted.** Do not touch any page, any
action, any component, any lib module, `app.tsx`, `TopNav.tsx`, `FilterBar.tsx`,
or any migration. This is a documentation-only change. **Do not "helpfully" fix
any code you notice while reading.**

## Why

`AGENTS.md` is read before every change made in this project, so a stale file map
means every future prompt starts with less context than it should have. It is
currently missing **two whole features**: Contracts, built 2026-09-01, and the
Disciplinary actions viewer, built today.

## 1. Routes table — add two rows

In **File map → Routes — `src/app/app.tsx`**, add these two rows in the order
they appear in the nav, after `/attendance/*` and before `/admin/*`:

| Route | Component | Owns |
|---|---|---|
| `/contracts` | `Contracts.tsx` | tenure milestones and contract end dates, one row per active employee; read-only |
| `/disciplinary` | `Disciplinary.tsx` | disciplinary actions filed in the separate GAF Disciplinary Actions Form app, one row per employee; read-only except closing a case |

Leave every existing row untouched.

## 2. `src/app/lib/` — add two modules

In **File map → `src/app/lib/` — the shared logic**, add two bullets in the same
style as `ptoAccrual.ts`:

- **`tenure.ts`** — pure date maths for the Contracts page, no I/O and no clock:
  `addMonths` (clamps to the last day of the month), `milestones`,
  `tenureLabel`, `daysUntil`, `nextMilestone`, `contractEndState`. `asOf` is
  always a parameter.
- **`disciplinary.ts`** — pure rules for the Disciplinary page, no imports, no
  clock: `levelRank`, `caseState`, `daysBetween`, `groupByEmployee`,
  `sortEmployeeCases`, `dueSoon`. `asOf` is always a parameter. The only use of
  `Date` is `Date.UTC(...)`.

## 3. A new subsection on the second database

Add this as a new subsection of the **File map**, after the `src/app/lib/` list.
It is the single most surprising fact about this app's data and it is written
down nowhere:

> ### The disciplinary database is a second Postgres instance
>
> `disciplinary_actions` lives in **`SAUL Disciplinary Action Forms DB`**, not in
> `GAF Planilla DB`. It is written by a **separate UI Bakery app**, "GAF
> Disciplinary Actions Form" (app id `PC3PsXDDa9`), which is where managers file
> warnings. This app only reads it, plus three columns it writes for closure.
>
> Two consequences, both load-bearing:
>
> - **A SQL action names exactly one datasource, so `disciplinary_actions` can
>   never be joined to `employees` in SQL.** The join happens in React, in
>   `DisciplinaryTable.tsx`, using `buildResolver` from `mondayResolve.ts`.
> - **The rows carry no employee id and no email** — only a free-text
>   `employee_name`. This is the same name-only situation as the Onboarding
>   board. An unmatched name is displayed with a *"not on roster"* chip, never
>   dropped.
>
> `closed_at` / `closed_by` / `closure_note` were added to that table by a
> migration in the **form app**, which owns it. `closed_at IS NULL` means the
> case is open. Never select `pdf_en_base64` or `pdf_es_base64` — one row is
> roughly 250 KB of base64.
>
> The datasource string that works is the **connections-screen display name**,
> `'SAUL Disciplinary Action Forms DB'`. Note that the exported
> `datasources.yml` calls the same connection `GA Offer Letter DB v2`; that
> string does **not** work in an action, and the file is not authoritative for
> code.

## 4. Page component lists

Wherever the file map lists page components under `src/app/pages/`, add:

- `contracts/` — `ContractsTable.tsx`, `ContractRow.tsx`
- `disciplinary/` — `DisciplinaryTable.tsx` (loads, resolves names, groups,
  filters, sorts), `DisciplinaryRow.tsx` (one row plus the escalation ladder),
  `CaseFile.tsx` (**prop-driven, no `useLoadAction` — Employee 360 will reuse it
  unchanged**), `CloseCaseDialog.tsx`

If no such list exists, add these under the routes table instead.

## What not to change

- Do not rewrite, reorder, condense or "improve" any existing section.
- Do not touch **Non-negotiables**, **Schema**, **Timezone rules**,
  **Classification model**, **Monday.com integration** or **Hard constraints**.
  A test asserts those headings still exist.
- Do not update byte counts on other files.
- Do not add anything about Employee 360 — it does not exist yet.

## Acceptance

1. `src/AGENTS.md` is the only file that changed.
2. The headings `Schema`, `Timezone`, `Classification`, `File map` and
   `Hard constraints` all still exist, spelled as they are now.
3. The routes table gains exactly two rows; no existing row is altered.
4. The new subsection states plainly that a SQL action cannot join the two
   databases.
5. Nothing under `src/actions/`, `src/app/pages/` or `src/app/lib/` changed.
