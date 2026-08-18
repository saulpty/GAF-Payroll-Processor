# Monday mirror, PTO tracker, and the consolidated Employees admin — design

**Date:** 2026-08-18
**Status:** approved in conversation, awaiting written review
**Sub-projects covered:** A (Monday mirror), B (PTO & leave tracker),
F (Employees admin consolidation, incl. BACKLOG #3 phase 2). This is
sub-project 1 of the feature roadmap recorded in `docs/BACKLOG.md`.

---

## 1. Why

GAF HR Hub today is payroll + attendance. The owner wants it to become the
place where HR sees everything: PTO balances under Panama's accrual rules, every
Monday.com request and approval, contract milestones, per-employee history, and
eventually a manager-scoped view. Today the PTO ledger lives in
`PTO TRACKING GAF NEW.xlsx`, updated by hand every two weeks from Monday
exports; the requests themselves live on the Monday *Permissions & Requests*
board; the app knows about none of it except a lossy per-period pull during a
payroll run.

`docs/BACKLOG.md` lists *"a feature backlog blocked by fear of regression"*.
This spec is the first feature carried through the change loop
(`docs/CHANGE-LOOP.md`), and it is deliberately **additive**: new tables, new
actions, new pages. The only existing pages it touches are the three admin
pages it consolidates, and those are replaced by new files, not edited.

## 2. Decisions already taken

| # | Decision | Chosen | Why |
|---|---|---|---|
| 1 | Where the Monday sync runs | Browser-side, operator-triggered ("Sync now"), same pattern as today's Directory Sync | Proven pattern; no unknown platform capability; a scheduled upgrade later changes nothing below the UI |
| 2 | What the PTO ledger is | `pto_approvals` is the ledger; Monday submissions are *pending suggestions* until Tim records them | Employees often take different days than requested; GAF-only fields (comments, paid PTO) need a home Monday never overwrites |
| 3 | PTO tables | Revive and extend `pto_employees` / `pto_approvals` / `pto_floating_holidays` (migration `1781402200`) | Their columns already match the sheet; `src/AGENTS.md` "Dead" section is rewritten in this sub-project |
| 4 | Manager-scoped access | Separate later track (roadmap G) | Depends on UIB user roles, outside this codebase; every new `load*` accepts an optional `manager` filter now |
| 5 | Admin pages | Employees, Directory Sync, Name Aliases merge into **one** Employees admin with tabs; the old three are deleted last | Owner request; strangler pattern so nothing breaks mid-way |
| 6 | Historical Excel | Loaded once by a data migration generated from the sheet, not by an import screen | Used once; reviewable; no throwaway UI |
| 7 | Balances math | Pure TypeScript module in the browser, tested with node; SQL stores facts only | Same principle as the classification engine |

Total days on a ledger row defaults to `return_on − leave_on` in calendar days,
which is what every row in the sheet is; Tim can override.

## 3. Data model

All new columns and tables are additive. Timestamps `TIMESTAMPTZ`; dates `DATE`.
No time-of-day conversion anywhere — Monday's date columns arrive as ISO strings
and are stored as-is (see `src/AGENTS.md`, Timezone rules).

### 3.1 Mirror tables (sub-project A)

Common shape, one table per board:

- `monday_item_id BIGINT UNIQUE NOT NULL` — the join key across syncs.
- `employee_id BIGINT NULL REFERENCES employees(id)` — resolved at sync time
  (§4.3). `NULL` = unmatched; the row is kept, never dropped.
- `employee_name_raw TEXT`, `employee_email_raw TEXT` — what the board said.
- `board_group TEXT` — the Monday group title the item sits in.
- `raw JSONB NOT NULL` — the whole item (`id`, `name`, `group`, every
  `column_values` entry) so a column we did not type can be read later
  without re-syncing.
- `deleted_on_monday BOOLEAN NOT NULL DEFAULT false` — set when a sync
  completes without seeing this item.
- `synced_at TIMESTAMPTZ NOT NULL`.

**`monday_requests`** — *Permissions & Requests* board. Typed columns:
`manager_email_raw`, `request_type` (PTO / Vacation · Time Off / Permission ·
Floating Holiday · Birthday Day Off · Work From Home · …), `permission_type`
(e.g. Time for Time), `start_date`, `end_date`, `return_date`,
`start_datetime`, `end_datetime` (TFT), `total_days_requested NUMERIC`,
`hours_approved NUMERIC`, `reason`, `details`, `submitted_at`.
Indexes: `(employee_id)`, `(request_type, start_date)`.

**`monday_attendance_forms`** — *GAF Attendance* board. Typed:
`form_type` (Absence / Tardiness), `reason`, `details`, `eta`,
`form_date DATE`, `submitted_at`. Index `(employee_id, form_date)`.

**`monday_contracts`** — *Employee Onboarding* board (Contract Tracking view).
Typed: `position`, `state`, `manager_raw`, `start_date`,
`contract_end_date`. Milestones (1 m / 3 m / 6 m / 1 y / 2 y) are computed
from `start_date` by a later sub-project, not stored.

**`monday_sync_log`** — one row per board: `board_key TEXT PRIMARY KEY`
(`directory` · `requests` · `attendance_forms` · `contracts`),
`last_synced_at`, `item_count`, `matched_count`, `unmatched_count`,
`last_error TEXT NULL`.

### 3.2 PTO tables (sub-project B) — revived and extended

`pto_approvals` (existing: `employee_id`, `leave_on`, `return_on`,
`total_days`, `status`, `gaf_comments`, `submitted_by`) gains:
- `monday_item_id BIGINT NULL UNIQUE REFERENCES monday_requests(monday_item_id)`
- `source TEXT NOT NULL DEFAULT 'manual'` — `monday` · `excel_import` · `manual`
- `recorded_by TEXT NULL`, `recorded_at TIMESTAMPTZ NULL`
- `status` values become exactly `pending` · `recorded` · `withdrawn`
  (`CHECK`); the old default `'approved'` becomes `'recorded'`.
- `total_days` becomes `NUMERIC(5,2)` (half days exist in practice).

`pto_employees` (existing: `employee_id` unique, `paid_pto_cap`, `notes`)
changes: `paid_pto_cap` → renamed **`paid_pto_days`** (manual; 15 or 30; the
CSS advance actually paid); adds `pto_start_date_override DATE NULL` for the
few people whose accrual start differs from `employees.start_date`.

`pto_floating_holidays` unchanged (`employee_id`, `calendar_year`,
`fh_allocated` default 2, `fh_used`, `notes`; unique per employee-year).

### 3.3 Config keys (`classification_config`)

New, seeded by migration with the values the owner confirms from the boards
(never guessed):
- `monday_board_onboarding` (category `monday_boards`).
- `monday_col_requests_*` for every Permissions column read in §3.1 (name,
  email, manager_email, request_type, permission_type, date_range,
  return_date, start_datetime, end_datetime, total_days, hours_approved,
  reason, details, submission_date).
- `monday_col_attendance_*` already has email/date/type/reason; add `details`,
  `eta`, `name`.
- `monday_col_onboarding_*`: position, state, manager, start_date,
  contract_end_date.

The four existing keys `monday_board_permissions`, `monday_board_attendance`,
`monday_board_directory`, `monday_col_directory_*` are reused as-is.

## 4. Sync (sub-project A)

### 4.1 Where it lives
Tab **Monday** of the new Employees admin (§6). One card per board —
Directory, Requests, Attendance forms, Contracts — showing **Sync now**, last
synced, item / matched / unmatched counts, last error.

### 4.2 What Sync now does
1. Reads the board ID and every column ID from `classification_config`
   through the existing `cfgGet(key, fallback)` idiom — but with **no
   fallback**: a missing or empty key shows a red banner naming the key and
   the sync does not start.
2. Builds the GraphQL query string in the page and calls the generic
   `pullMondayBoard` action with `{ query }` — the whole query as one param
   (`body: \`{ query: {{params.query}} }\``). Never interpolate
   `{{params.…}}` inside a string literal (BACKLOG #3, the known-good fix).
3. Paginates with `items_page(limit: 500, cursor: …)` / `next_items_page`
   until the cursor is null. Today's Directory Sync does not paginate; this
   one must, because the Requests board already exceeds one page.
4. Resolves each item to an employee (§4.3).
5. Upserts in batches of 100 via one SQL action per board
   (`upsertMondayRequests`, `upsertMondayAttendanceForms`,
   `upsertMondayContracts`), `ON CONFLICT (monday_item_id) DO UPDATE`.
   Then `updateMondayDeleted` marks rows not seen in this run
   (`deleted_on_monday = true`); nothing is ever deleted.
6. Writes `monday_sync_log` via `upsertMondaySyncLog`.

The Directory card re-implements today's `AdminEmployeeSync` behaviour
(update `employees.role`, `manager`, `active`, and email) config-driven,
using `monday_col_directory_role|manager|active|email` — this closes BACKLOG #3
phase 2. Its results also feed the reconciliation table (§6).

### 4.3 Resolving a board row to an employee
Same order the engine uses in `rowMatchesEmp`: **email** (case-insensitive,
against `employees.teramind_email`) → **`name_aliases.alias_text`** →
**normalized `display_name`** (`normalizeName`: strip accents, lowercase,
collapse whitespace). No match → `employee_id NULL`, counted as unmatched,
listed under the card with the raw name/email and an inline **Add alias**
control that inserts the `name_aliases` row and re-resolves that item without
a full re-sync.

This resolver is extracted into `src/app/lib/mondayResolve.ts` (pure, tested)
so all four cards, and later sub-projects, share one implementation.

### 4.4 Guarantees
- **Idempotent** — a second sync with no board changes writes identical rows
  and identical counts.
- **All-or-nothing per board** — an API or upsert error stops that board's
  sync, records `last_error`, and leaves prior rows untouched.
- **Payroll unaffected** — `ProcessPayroll.tsx`'s own per-period pull is not
  changed and does not read the mirror in this sub-project.

## 5. PTO rules and math (sub-project B)

Module `src/app/lib/ptoAccrual.ts`, pure functions, no I/O:

- `days360(start: string, end: string): number` — Excel **US (NASD)**
  30/360 method, to the letter, because the sheet uses it and the numbers must
  match. Inputs are `YYYY-MM-DD` strings; no `Date` timezone arithmetic.
- `accruedPto(start, asOf) = days360(start, asOf) / 11`.
- `takenPto(rows) = Σ total_days where status = 'recorded'`.
- `availablePto = accrued − taken`.
- `defaultTotalDays(leaveOn, returnOn) = calendar days between` (matches
  every row in the sheet).
- `fhEligibleDate(start) = start + 90 calendar days`;
  `fhRemaining(allocated, used) = max(0, allocated − used)`.
- Accrual `start` = `pto_employees.pto_start_date_override ?? employees.start_date`.
  Missing both → the row shows "—" and a warning, never `NaN`.

Paid PTO (`paid_pto_days`) is manual and never computed. A hint marks
employees ≥ 6 months tenure with `paid_pto_days = 0` (the CSS-advance
trigger).

Floating holidays: per calendar year, allocated 2, non-stacking; a year's row
is created on first view with `fh_used = 0`. `fh_used` is manual.

Request-type counts per employee come straight from `monday_requests` (no
ledger): WFH days, Birthday Day Off taken this year, Time-for-Time hours
approved. Read-only.

## 6. Pages and navigation

### 6.1 Navigation
`TopNav.tsx` gains a fourth section **People** with one sub-link now,
**PTO Tracker** (`/pto`); later sub-projects add Employee 360, Contracts and
Calendar there. `app.tsx` gets the route. `FilterBar.tsx` `ROUTE_CONFIG`
gets `'/pto': { employee: true, role: true, manager: true }`.

### 6.2 `/pto` — PTO Tracker (`src/app/pages/PtoTracker.tsx` + one component
per tab under `src/app/pages/pto/`)

Three tabs, mirroring the sheet:
1. **Balances** — one row per active employee: Employee · Title · Start ·
   Accrued · Taken · **Available** · Paid PTO (inline edit) · FH remaining ·
   WFH days · Birthday off · TFT hours · ⏳ pending badge. "As of" date
   picker (default today). Sort, filter, **Export to Excel** (SheetJS,
   already a dependency).
2. **Approvals log** — top panel **Pending from Monday**: every
   `monday_requests` row with `request_type = 'PTO / Vacation'` and no linked
   `pto_approvals` row; each has **Record** → dialog prefilled (employee,
   leave/return, total days editable, comments) → saves `status = recorded`,
   `source = monday`, `monday_item_id` set. Also **Dismiss** (creates a
   `withdrawn` row so it stops appearing). Below: the ledger table, filter by
   employee/status, inline **Edit** and **Withdraw**, source chip
   (Monday / Excel / Manual), **Add manually**.
3. **Floating Holidays** — per employee for a selected year: eligible date,
   ✔ / ⏳, allocated, used (inline edit), remaining.

Every table shows the four states used elsewhere in the app: loading, empty,
error, data. Writes are save → reload → show (no optimistic UI).

### 6.3 `/admin/employees` — the consolidated Employees admin
(`src/app/pages/admin/AdminEmployeesHub.tsx` + one component per tab under
`src/app/pages/admin/employees/`, each well under 15 KB)

- **Roster** — today's `AdminEmployees.tsx` grid, moved as-is (same actions,
  same behaviour).
- **Monday** — the four sync cards (§4.1); a **reconciliation table**: every
  employee with ✅ / ⚠️ per field (name, email, manager, role, active)
  comparing `employees` with the Directory mirror; and the **Unmatched** list
  with inline Add alias.
- **Aliases** — today's `AdminAliases.tsx` list, moved as-is.

**Strangler sequence:** new files and route first, under a temporary nav
label "Employees (new)"; old pages untouched and still routed; verify in the
browser (Directory sync produces the same rows, roster saves, aliases resolve);
then one deletion-only prompt removes `AdminEmployees.tsx`,
`AdminEmployeeSync.tsx`, `AdminAliases.tsx`, their routes and nav links, and
renames the label to "Employees".

## 7. Actions (one file each, `src/actions/`)

SQL, datasource `GAF Planilla DB`:
`upsertMondayRequests`, `upsertMondayAttendanceForms`,
`upsertMondayContracts`, `updateMondayDeleted`, `upsertMondaySyncLog`,
`loadMondaySyncLog`, `loadMondayUnmatched`, `loadDirectoryReconciliation`,
`loadMondayRequests` (filters: employee, type, date range, manager),
`loadPtoBalancesInputs` (employees + pto_employees + recorded sums + request
counts, one round trip), `loadPtoApprovals`, `upsertPtoApproval`,
`updatePtoApprovalStatus`, `upsertPtoEmployee`, `loadFloatingHolidays`,
`upsertFloatingHoliday`, `loadPendingPtoRequests`.

HTTP: none new — the existing `pullMondayBoard` (datasource `Monday.com API`)
is reused for every board. Every `load*` accepts an optional `manager` param.

## 8. Migrations (additive, one file each, applied in UIB, recorded in
`src/migrations/applied.txt`)

1. `create_monday_mirror_tables` — §3.1 tables + `monday_sync_log`.
2. `seed_monday_config_keys` — §3.3 keys with owner-confirmed values.
3. `revive_pto_tables` — §3.2 ALTERs (`paid_pto_cap` → `paid_pto_days`,
   new columns, `status` CHECK, `total_days` NUMERIC, existing `'approved'`
   rows → `'recorded'`).
4. `seed_pto_from_excel` — one-time load generated locally from
   `PTO TRACKING GAF NEW.xlsx`: approvals (`source = excel_import`,
   `status = recorded`), `paid_pto_days`, FH used for the current year, and
   start-date overrides where the sheet disagrees with `employees.start_date`.
   Employees named in the sheet but absent from `employees` are listed in the
   migration header as skipped, for the owner to resolve first. Reviewed by
   the owner before applying.

## 9. Error handling — rules every prompt restates
- Missing config key → banner naming the key; no pull; no partial write.
- Monday API error → that board's sync stops; `last_error` recorded; existing
  rows untouched.
- Unmatched employee → row kept with `employee_id NULL` and surfaced; never
  silently dropped.
- Missing `start_date` → "—" plus warning; never `NaN`.
- Writes: save → reload → show.

## 10. Testing
Node tests in `tests/`, run with `node --test "tests/*.test.ts"`:
- `ptoAccrual.test.ts` — `days360` against Excel-known pairs (month ends,
  Feb, 31sts); accrued/available for ≥ 5 rows from the sheet at a fixed
  "as of"; `defaultTotalDays`; FH eligibility at 89 / 90 / 91 days;
  year rollover.
- `mondayResolve.test.ts` — email → alias → name order; accent/case
  normalization; no match → null.
- `hardcoding.test.ts` gains a check that no new file under `src/actions/`
  or `src/app/pages/{pto,admin/employees}/` contains a literal Monday board
  or column ID.
- The existing 69 tests stay green.

Per prompt, the loop's browser check is mandatory for any `src/actions/`
change: load the page, real data appears; for syncs, sync twice → same counts.

## 11. Delivery order (≈12 UIB prompts, one coherent change each)
1. Migrations 1–3 (DB only, nothing visible).
2. Employees hub shell + Roster tab (moved as-is), routed as "Employees (new)".
3. Monday tab: Directory sync card, config-driven (BACKLOG #3 phase 2).
4. Monday tab: Requests / Attendance forms / Contracts cards.
5. Reconciliation table + Unmatched + inline Add alias.
6. Aliases tab; then the deletion-only prompt removing the three old pages.
7. `ptoAccrual.ts` + `mondayResolve.ts` + tests.
8. People nav + `/pto` Balances tab.
9. Approvals log + Pending from Monday + Record dialog.
10. Floating Holidays tab.
11. Migration 4 (Excel seed) + reconcile the Balances tab against the sheet.
12. `src/AGENTS.md` update (PTO tables live; new tables, pages, config keys;
    remove the "Two current violations" once fixed) + BACKLOG update.

Each prompt follows `docs/CHANGE-LOOP.md`: named files, no-touch list,
observable acceptance criteria, export → sync → diff → tests → page load →
commit.

## 12. Out of scope (later sub-projects)
Employee 360 (C), contract milestones and alerts (D), calendar view (E),
manager-scoped access (G), scheduled server-side sync, payroll reading the
mirror instead of its own pull.
