# Contracts & milestones — one page, no new tables

Sub-project **D** of the roadmap in `BACKLOG.md`. Nothing blocks it: the Employee
Onboarding board has been mirrored since 2026-08-18, 45 items, all matched.

---

## Why

Tenure milestones and contract end dates live only on a Monday board nobody
opens daily. Two things follow from that:

- **A contract end arrives without warning.** Saul's ask, verbatim: *"warn me
  before it arrives."*
- **Nobody can see, at a glance, how long anyone has been here.** GAF's new
  policy is a company-wide annual review each January, so tenure is context for
  that conversation rather than a trigger for it.

---

## What the owner said

> "New company policy is that in January everyone gets an annual review for a
> potential raise. Regardless of whether they hit a year or not. Usually they
> will but it's ok. **This is just a list of milestones and tracking their
> tenure.**"

> "Contracts usually end only at 6 months. Ulla's case is different because she
> has several 6-month contracts, that's not common but can happen."

> "New page next to Attendance called Contracts. Remember that in the end the
> goal is to see everything separately but then we will have that thing called
> Employee 360 so a manager can see all their employees' info at a glance."

---

## Decisions taken

1. **No raise flag.** `BACKLOG.md` item D says "raise flag". That wording is
   superseded: the January review is company-wide and unconditional, so a
   per-employee raise trigger would be noise. Milestones are tenure tracking
   only. Recorded here so it is not re-implemented from the old backlog line.
2. **A contract end in the past is normal, not a warning.** The board's contract
   end is usually the end of a first 6-month contract, after which the employee
   moves to an indefinite contract and the board is not updated. A passed date
   renders muted — `ended 03-12-2026` — with no chip. Only upcoming dates get
   colour. A **blank** contract end is likewise expected.
3. **Nothing new is stored.** No migration, no new table, no write path. The
   page is a read of `employees` joined to the existing `monday_contracts`
   mirror. Refreshing the data is the existing *Sync now* on
   Admin → Employees → Monday.
4. **Milestones are computed, not read from the board.** The Onboarding board
   has only two of the five (`monday_col_onboarding_3_months`, and
   `monday_col_onboarding_1_year`, which is a *formula* column), and
   `syncContracts.ts` pulls neither. Computing all five from the start date is
   simpler, complete, and testable.
5. **Built so Employee 360 reuses it as-is** — the tenure maths is a pure
   module, and the load action takes optional `employeeId` and `manager` filters
   from day one.

---

## 1. Data — what already exists, and the one thing we do not know

`monday_contracts` (migration `1781803500`) already holds everything the page
needs, populated by `src/app/pages/admin/employees/syncContracts.ts`:

| Column | Source column on the Onboarding board |
|---|---|
| `position` | `monday_col_onboarding_position` |
| `state` | `monday_col_onboarding_state` |
| `manager_raw` | `monday_col_onboarding_manager` |
| `start_date` | `monday_col_onboarding_start_date` |
| `contract_end_date` | `monday_col_onboarding_contract_end` ("6 Contract End Date") |
| `employee_id` | resolved at sync time by **name only** — the board has no email column |
| `deleted_on_monday` | item gone from the board |

**The one honest unknown:** how many of the 45 board rows actually have a
contract end date filled in. It cannot be seen from the repo.

> **Task 1 of the build is a read-only query** — no UI, no prompt to UIB — that
> answers: how many active employees have a `monday_contracts` row; how many of
> those have a non-null `contract_end_date`; how many of those are in the
> future. If the answer is "almost none in the future", the contract-end half of
> this page is decoration and we say so before building it.

### Who counts as an employee

`WHERE e.active = true`. That column is not a free-text status —
`syncDirectory.ts:150` writes it from
`item.group?.id === dk.monday_group_directory_current`, i.e. membership of the
**Current Employees** group on the Directory board. It is therefore already the
correct test from `CLAUDE.md` bug #2, and no second filter is needed. Do not add
one keyed on a Status column.

### Rehires

One employee can have two board rows. `DISTINCT ON (employee_id) … ORDER BY
employee_id, start_date DESC NULLS LAST` — the row with the **latest start date
wins**. Rows with `deleted_on_monday = true` are excluded.

### The action — `src/actions/loadContractMilestones.ts`

One action, one file, named `load*` per `CLAUDE.md`. Returns one row per active
employee:

```
employee_id, display_name, role, manager,
roster_start        -- employees.start_date::text
board_start         -- monday_contracts.start_date::text, may be NULL
position, state, contract_end   -- ::text, may be NULL
has_board_row       -- boolean
```

Rules it must obey, each one a bug this repo has already paid for:

- `::text` on every date, so Postgres timestamps never reach the client.
- `{{params.manager}}` and `{{params.employeeId}}` appear **bare**, never inside
  a quoted string — same shape as `loadPtoBalancesInputs.ts`:
  `AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})`.
- The page calls it with **flat** params —
  `useLoadAction(action, [], { manager, employeeId })` — never wrapped in
  `{ params: {…} }`. That wrapper is `CLAUDE.md` bug #1 and it fails silently.

A second tiny action, `src/actions/loadContractsExpiringCount.ts`, returns a
single `count` of active employees whose contract end falls within the next 30
days, for the nav badge. Same shape as `loadUnresolvedCount.ts`.

**Start date, source of truth:** `employees.start_date` — the roster value, the
same one the PTO Tracker accrues from, so the two pages can never disagree. The
board's start date is shown only as a discrepancy warning.

---

## 2. The page — `/contracts`

### 2.1 Layout

`PageHeader` (title *Contracts*, subtitle *Tenure milestones and contract end
dates — one row per employee*), then one table, one row per active employee:

| Employee | Position | State | Start | Tenure | 1 m | 3 m | 6 m | 1 y | 2 y | Contract end |
|---|---|---|---|---|---|---|---|---|---|---|
| Ulla Hees | Nurse | Active | 03-12-2025 | 1y 5m | ✔ | ✔ | ✔ | ✔ | 03-12-2027 · in 192 d | 09-12-2026 · in 11 d |

- **Position / State** — straight from the Onboarding board.
- **Start** — the roster date, `fmtDate`'d. A ⚠ next to it when the board's
  start date differs, tooltip naming both.
- **Milestones** — a passed one shows a muted ✔ with the date on hover; the
  **next** one is highlighted with `in N days`; later ones show the date, muted.
- **Contract end** — see 2.2.
- Sorted by soonest upcoming event (milestone or contract end), then name.

Header line, when the count is non-zero:

> *N employees not on the Onboarding board* → links to
> `/admin/employees?tab=monday`.

This is the direction the existing tooling does **not** cover:
`loadMondayUnmatched.ts` finds *board rows with no employee*; this finds
*employees with no board row*. Both are fixed in the same place — an alias —
which is why the link goes there.

### 2.2 The rules behind the numbers

- A **milestone** is start + 1 / 3 / 6 / 12 / 24 calendar months. If that day
  does not exist — 31 Jan + 1 month — it clamps to the **last day of that
  month**.
- **Tenure** is whole years and months from start to today, same calendar logic:
  `1y 5m`. Under a month reads `new`.
- **Days until** is plain calendar days.
- **Contract end**:
  - in the future ≤ 30 days → **red** chip, `MM-DD-YYYY · in N d`
  - in the future ≤ 60 days → **amber** chip
  - further out → plain date, no chip
  - **in the past → muted `ended MM-DD-YYYY`, no chip.** This is the normal
    state for most people; treating it as a warning would bury the real ones.
  - **blank → `—`, muted, no chip.** Also normal.
- Everything is `YYYY-MM-DD` string arithmetic. **No `new Date(str)`.** "Today"
  is `toLocalYMD(new Date())` from `classificationEngine`. Day counts use the
  `Date.UTC(y, m-1, d) / 86400000` idiom already proven in `ptoAccrual.ts`.

### 2.3 Filters and export

- **Global filter bar** — add
  `'/contracts': { employee: true, role: true, manager: true }` to `ROUTE_CONFIG`
  in `FilterBar.tsx`. That is the whole change; the bar already renders those
  three.
- **A "due within" toggle** in the page header — `30 / 60 / 90 days`, same
  three-button styling as the attendance day presets. Selecting one shows only
  employees with a milestone **or** a contract end falling inside that window.
  Clicking the active one clears it. Page-local state, not global.
- **Export** — `xlsx`, one sheet, the same columns as the table, filename
  `contracts-<today>.xlsx`. Copied from `PtoTracker.tsx`'s `handleExport`.

### 2.4 Nav

A new top-level section in `TopNav.tsx`, **between Attendance and PTO Tracker**,
`id: 'contracts'`, `home: '/contracts'`, `paths: ['/contracts']`, `links: []` —
the same shape as the PTO section. Icon `FileSignature` from lucide.

**One extension is needed.** Today `badge: true` is only honoured on *sub*-links,
and Contracts has none. The section button needs to render the same red pill when
a section-level count is non-zero — a `badge` flag on the section, fed by
`loadContractsExpiringCount`. Keep the existing Action Required badge working
unchanged.

Route in `app.tsx`: `<Route path="/contracts" element={<Contracts />} />`.

---

## 3. The tenure module

`src/app/lib/tenure.ts` — pure functions, no I/O, no React, modelled on
`ptoAccrual.ts`:

```ts
addMonths(start: string, months: number): string   // clamps to last day of month
milestones(start: string): { key: '1m'|'3m'|'6m'|'1y'|'2y'; date: string }[]
tenureLabel(start: string, asOf: string): string   // '1y 5m' | '4m' | 'new'
daysUntil(from: string, to: string): number        // negative when past
nextMilestone(start: string, asOf: string): { key: string; date: string; days: number } | null
contractEndState(end: string | null, asOf: string):
  { kind: 'none' | 'ended' | 'future'; days: number | null }
```

`tests/tenure.test.ts`, hand-written in this repo, **before** any UIB prompt:

| # | Case |
|---|---|
| T1 | `addMonths('2026-01-31', 1)` → `2026-02-28`; leap year → `2028-02-29` |
| T2 | `addMonths('2025-03-12', 24)` → `2027-03-12` |
| T3 | milestones of `2025-03-12` are 04-12, 06-12, 09-12, 2026-03-12, 2027-03-12 |
| T4 | `tenureLabel` → `1y 5m`; a same-month start → `new`; exactly 12 months → `1y` |
| T5 | `daysUntil` across a DST boundary and across a year boundary is exact |
| T6 | `contractEndState(null)` → `none`; a past date → `ended`; a future one → `future` with the right day count |
| T7 | No function constructs a `Date` from a date string (source assertion, same shape as the timezone guard) |

---

## 4. Files

**New, hand-written in this repo (tests and prompts only):**

- `tests/tenure.test.ts`
- `docs/superpowers/prompts/2026-09-01-contracts/NN-*.md`

**New, produced by UI Bakery:**

- `src/app/lib/tenure.ts`
- `src/actions/loadContractMilestones.ts`
- `src/actions/loadContractsExpiringCount.ts`
- `src/app/pages/Contracts.tsx` — header, toggle, export
- `src/app/pages/contracts/ContractsTable.tsx` — load, filter, sort
- `src/app/pages/contracts/ContractRow.tsx` — one row, the chips

Three page files rather than one, so none approaches the 15 KB ceiling.

**Modified:**

- `src/app/app.tsx` — one route
- `src/app/TopNav.tsx` — one section, plus the section-level badge
- `src/app/FilterBar.tsx` — one `ROUTE_CONFIG` line

**Untouched, and named here so a prompt can forbid them:** everything under
`src/app/pages/admin/`, `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `syncContracts.ts`,
`src/components/ui/`, and every migration.

---

## 5. Acceptance — what "done" means

1. The read-only probe from §1 is answered and written into the prompt folder
   **before** any UI work starts.
2. `node --test "tests/*.test.ts"` — the 104 existing tests plus the new tenure
   tests, all passing. No existing test modified.
3. `/contracts` loads in the browser with real data, screenshotted.
4. **Ulla Hees is the worked example.** Her row shows her real position and
   state, a tenure consistent with her roster start date, all five milestones,
   and her contract end. Her several 6-month contracts mean she is the one person
   whose contract end may legitimately be in the future.
5. **The control:** at least one employee whose contract end is in the past
   renders muted as `ended …` with **no** chip, and at least one with a blank
   contract end renders `—` with no chip and no console error.
6. An employee with no Onboarding row shows `—` for position, state and contract
   end plus a *Not on Onboarding board* chip, and is counted in the header line.
7. An employee with a null `start_date` shows `—` and a warning chip, and the
   page does not throw.
8. Setting the global Manager filter narrows the table; the numbers for anyone
   still visible do not change.
9. `30 / 60 / 90` narrows the table and clears cleanly.
10. The nav badge equals the number of contract ends inside 30 days — checked
    against the query, not assumed. If that number is 0, the badge is absent.
11. Export opens in Excel with the same rows as the screen.
12. `git status --short` shows only the files listed in §4.

---

## 6. Out of scope

- **Editing** anything. The board stays the source of truth; corrections go
  through Monday and a re-sync.
- Email or Slack alerts. The badge is the warning mechanism for now.
- Employee 360 (sub-project C). This page's module and action are shaped for it;
  building it is a separate spec.
- The `1 Year` and `3 Months` board columns. Not pulled, not read — see
  decision 4.
- Backfilling contract end dates that are blank on the board.

---

## 7. How it gets built

Through the loop in `CHANGE-LOOP.md`, unchanged: every change is a committed
prompt under `docs/superpowers/prompts/2026-09-01-contracts/`, pasted into UI
Bakery, exported, synced with `tools/sync-export.mjs`, diff-checked against the
file list in §4, tested, loaded in the browser, then committed. `src/` is never
hand-edited.

Order: probe → tests (red) → `tenure.ts` → actions → table → page shell → nav
and filter bar → export.
