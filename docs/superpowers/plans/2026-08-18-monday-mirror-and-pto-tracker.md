# Monday Mirror, PTO Tracker and Employees Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give GAF HR Hub a durable local mirror of four Monday.com boards, a PTO ledger that reproduces the owner's Excel tracker, and one consolidated Employees admin page — without editing any of the six oversized files.

**Architecture:** UI Bakery owns the running app and database; `src/` is a read-only mirror of its export. Every application change in this plan is a **UIB prompt** executed in UI Bakery's AI panel, followed by export → sync → diff → tests → browser check → commit (`docs/CHANGE-LOOP.md`). Local, hand-written artifacts are limited to `tests/*.test.ts`, `tools/*.mjs`, and `docs/`. Pure logic (`ptoAccrual.ts`, `mondayResolve.ts`) is specified as exact code so node tests written *before* the UIB prompt pass *after* it.

**Tech Stack:** UI Bakery vibe project (React 19, react-router-dom 6, Tailwind 3, shadcn-style primitives, `@uibakery/data` `useLoadAction`/`useMutateAction`, SheetJS `xlsx`), PostgreSQL (`GAF Planilla DB`), Monday.com GraphQL (`Monday.com API` datasource via `pullMondayBoard`), Node 24 `node:test` with native TS stripping.

Spec: `docs/superpowers/specs/2026-08-18-monday-mirror-and-pto-tracker-design.md`.

## Global Constraints

- **`src/` is never hand-edited.** The next sync destroys hand-edits. All app changes go through UIB prompts.
- **One coherent change per prompt.** Every prompt names the files that may change and states that no other file may be touched.
- **Never hardcode a Monday board or column ID.** Read from `classification_config`. Never guess an ID — the owner supplies it from the board.
- **`{{params.x}}` is substituted as a whole value.** Never place it inside a quoted string in an action body. Pass a whole GraphQL query as one param, exactly as `src/actions/pullMondayBoard.ts` does.
- **Timezone invariant** (`src/AGENTS.md`): dates from Monday and Teramind are wall-clock strings; store as-is; never construct `Date` for date math on them; never convert.
- **Do not touch:** `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, anything under `src/components/ui/`.
- **Action naming:** `load*`, `upsert*`, `update*`, `delete*`, `save*`; one action per file; `'SQL'` actions use `datasourceName: 'GAF Planilla DB'`.
- **Every new `load*` accepts an optional `manager` param** (`{{params.manager}}`; `NULL`/empty = no filter) matched against `employees.manager`.
- **Test command:** `node --test "tests/*.test.ts"` (glob required). Baseline: 69 passing.
- **Sync command (PowerShell, repo root):** `node tools/sync-export.mjs "C:/Users/SaulFallembaum/Downloads/GAF HR Hub.zip"`.
- **Browser check is mandatory** for any diff touching `src/actions/`: load the page, confirm real data.
- **New pages/components stay under 15 KB each.** One component per tab.
- **Migrations:** created and applied in UIB (its migration tool updates `src/migrations/applied.txt`); the SQL is written here first and pasted verbatim. After apply, verify with a query in UIB's Database tab and record the result in the commit message.
- Git: work happens on the current branch; when the plan is done, fast-forward `main` and delete the branch (project rule: one branch).

---

## The loop, once (referenced as **LOOP** in every UIB task)

Every UIB task ends with these steps. They are written out here in full; each task lists the values that vary (expected files, page to load, tests to run).

1. In UIB's AI panel, paste the task's **UIB prompt** verbatim. Wait for it to finish. Read UIB's summary as a claim, not evidence.
2. Press **Export** in UIB. Then in PowerShell at the repo root:
   ```powershell
   node tools/sync-export.mjs "C:/Users/SaulFallembaum/Downloads/GAF HR Hub.zip"
   git status --short
   ```
3. Compare `git status --short` with the task's **Expected files**. Any file not listed is collateral damage: revert in UIB ("Revert to this checkpoint"), re-export, re-sync, confirm `git status` is clean, then re-prompt with the missing no-touch line.
4. `git diff` each expected file; confirm the change matches the prompt (no hardcoded IDs, no `{{params.…}}` inside quotes).
5. Run `node --test "tests/*.test.ts"`. Expected: all pass (count grows as tasks add tests).
6. **Browser check** as specified in the task. If it fails, distinguish infrastructure (`too many connections`, many actions failing at once — close tabs, reload) from a real defect (one action, deterministic, fresh `request_id`). Fix by re-prompting, never with UIB's Fix button.
7. Commit with the task's message. `git push` is done at the end of the plan when `main` is fast-forwarded.

---

## File structure

**Local (hand-written):**
- `tests/ptoAccrual.test.ts` — DAYS360, accrual, FH rules.
- `tests/mondayResolve.test.ts` — email → alias → name resolver.
- `tests/hardcoding.test.ts` — gains a no-literal-Monday-ID scan over new files.
- `tools/pto-seed-from-xlsx.mjs` — generates migration 4 from the extracted PTO workbook.
- `docs/superpowers/prompts/2026-08-18-pto/NN-*.md` — each UIB prompt saved verbatim before use, so what was asked is on record.

**Created in UIB (mirrored into `src/`):**
- `src/app/lib/ptoAccrual.ts`, `src/app/lib/mondayResolve.ts` — pure logic.
- `src/migrations/<ts>_create_monday_mirror_tables.sql`, `<ts>_seed_monday_config_keys.sql`, `<ts>_revive_pto_tables.sql`, `<ts>_seed_pto_from_excel.sql`.
- `src/actions/` — `upsertMondayRequests.ts`, `upsertMondayAttendanceForms.ts`, `upsertMondayContracts.ts`, `updateMondayDeleted.ts`, `upsertMondaySyncLog.ts`, `loadMondaySyncLog.ts`, `loadMondayUnmatched.ts`, `loadDirectoryReconciliation.ts`, `loadMondayRequests.ts`, `loadPtoBalancesInputs.ts`, `upsertPtoEmployee.ts`, `loadPendingPtoRequests.ts`, `loadPtoApprovals.ts`, `upsertPtoApproval.ts`, `updatePtoApprovalStatus.ts`, `loadFloatingHolidays.ts`, `upsertFloatingHoliday.ts`.
- `src/app/pages/admin/AdminEmployeesHub.tsx` + `src/app/pages/admin/employees/{RosterTab,MondayTab,MondaySyncCard,ReconciliationTable,UnmatchedList,AliasesTab}.tsx`.
- `src/app/pages/PtoTracker.tsx` + `src/app/pages/pto/{BalancesTab,ApprovalsTab,RecordApprovalDialog,FloatingHolidaysTab}.tsx`.
- Modified: `src/app/app.tsx` (routes), `src/app/TopNav.tsx` (People section, admin links), `src/app/FilterBar.tsx` (`/pto` route), `src/AGENTS.md`.
- Deleted (Task 11): `src/app/pages/admin/AdminEmployees.tsx`, `AdminEmployeeSync.tsx`, `AdminAliases.tsx`, `src/actions/loadEmployeeDirectory.ts`, `src/actions/fetchMondayStartDates.ts`.

---

### Task 1: Failing tests for the two pure libs

**Files:**
- Create: `tests/ptoAccrual.test.ts`
- Create: `tests/mondayResolve.test.ts`

**Interfaces:**
- Produces (implemented in Task 2): from `src/app/lib/ptoAccrual.ts` — `days360(start: string, end: string): number`, `accruedPto(start: string, asOf: string): number`, `takenPto(rows: { total_days: number | string; status: string }[]): number`, `defaultTotalDays(leaveOn: string, returnOn: string): number`, `fhEligibleDate(start: string): string`, `fhRemaining(allocated: number, used: number): number`. From `src/app/lib/mondayResolve.ts` — `buildResolver(employees: { id: number; display_name: string; teramind_email: string | null }[], aliases: { alias_text: string; employee_id: number }[]): (name: string | null | undefined, email: string | null | undefined) => number | null`.

- [ ] **Step 1: Write `tests/ptoAccrual.test.ts`**

Vectors come from `PTO TRACKING GAF NEW.xlsx` with its `TODAY()` frozen at 2026-08-11 (serial 46245): Timothy Moore 42.7273 = 470/11, Reggina Sandoval 47.2727 = 520/11, Luis Abad 50.1818 = 552/11, Juan Fonseca 30.2727 = 333/11, Charles Bush 15.1818 = 167/11.

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  days360, accruedPto, takenPto, defaultTotalDays, fhEligibleDate, fhRemaining,
} from '../src/app/lib/ptoAccrual.ts';

const ASOF = '2026-08-11'; // the sheet's TODAY() when it was saved

test('days360 matches Excel (US method) for rows taken from the sheet', () => {
  assert.equal(days360('2025-04-21', ASOF), 470); // Timothy Moore  → 42.7273
  assert.equal(days360('2025-03-01', ASOF), 520); // Reggina Sandoval → 47.2727
  assert.equal(days360('2025-01-29', ASOF), 552); // Luis Abad → 50.1818
  assert.equal(days360('2025-09-08', ASOF), 333); // Juan Fonseca → 30.2727
  assert.equal(days360('2026-02-24', ASOF), 167); // Charles Bush → 15.1818
});

test('days360 handles the 31st exactly as Excel does', () => {
  assert.equal(days360('2025-01-31', '2025-03-01'), 31); // start 31 → 30
  assert.equal(days360('2025-01-30', '2025-03-31'), 60); // end 31, start ≥ 30 → 30
  assert.equal(days360('2025-01-15', '2025-03-31'), 76); // end 31, start < 30 → 1st of next month
  assert.equal(days360('2025-02-28', '2025-03-30'), 30); // start = last day of Feb → 30
});

test('days360 is zero on the same day and never negative for start ≤ end', () => {
  assert.equal(days360(ASOF, ASOF), 0);
  assert.equal(days360('2026-08-10', ASOF), 1);
});

test('accruedPto = days360 / 11, matching the sheet to 4 decimals', () => {
  assert.equal(accruedPto('2025-04-21', ASOF).toFixed(4), '42.7273');
  assert.equal(accruedPto('2026-02-24', ASOF).toFixed(4), '15.1818');
});

test('takenPto sums recorded rows only, tolerating string numerics from SQL', () => {
  const rows = [
    { total_days: '15', status: 'recorded' },
    { total_days: 4.5, status: 'recorded' },
    { total_days: 7, status: 'pending' },
    { total_days: 3, status: 'withdrawn' },
  ];
  assert.equal(takenPto(rows), 19.5);
  assert.equal(takenPto([]), 0);
});

test('defaultTotalDays is calendar days between leave and return, as every sheet row is', () => {
  assert.equal(defaultTotalDays('2025-09-22', '2025-10-06'), 14); // Luis Abad row 4
  assert.equal(defaultTotalDays('2026-03-16', '2026-03-17'), 1);
  assert.equal(defaultTotalDays('2026-02-27', '2026-03-02'), 3);   // crosses Feb end
});

test('floating holidays: eligible 90 calendar days after hire; remaining never negative', () => {
  assert.equal(fhEligibleDate('2025-04-21'), '2025-07-20'); // sheet: 45858
  assert.equal(fhEligibleDate('2026-06-15'), '2026-09-13'); // Eder Quintero: 46278
  assert.equal(fhRemaining(2, 0), 2);
  assert.equal(fhRemaining(2, 2), 0);
  assert.equal(fhRemaining(2, 3), 0);
});
```

- [ ] **Step 2: Write `tests/mondayResolve.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResolver } from '../src/app/lib/mondayResolve.ts';

const employees = [
  { id: 1, display_name: 'Eddy Cedeño', teramind_email: 'eddy.c@vitasyahc.com' },
  { id: 2, display_name: 'Jose De Hermoso', teramind_email: 'jose.d@avondalecaregrouppa.com' },
  { id: 3, display_name: 'No Email Person', teramind_email: null },
];
const aliases = [{ alias_text: 'Joseph De Hermoso', employee_id: 2 }];
const resolve = buildResolver(employees, aliases);

test('email wins, case-insensitively, even when the name would not match', () => {
  assert.equal(resolve('Somebody Else', 'EDDY.C@vitasyahc.com'), 1);
});

test('alias is tried before the display name', () => {
  assert.equal(resolve('Joseph De Hermoso', null), 2);
});

test('normalized display name: accents, case and whitespace do not matter', () => {
  assert.equal(resolve('  eddy   CEDENO ', ''), 1);
  assert.equal(resolve('no email person', undefined), 3);
});

test('no match returns null, never a guess', () => {
  assert.equal(resolve('Unknown Person', 'nobody@example.com'), null);
  assert.equal(resolve(null, null), null);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test "tests/ptoAccrual.test.ts" "tests/mondayResolve.test.ts"`
Expected: both files fail with `Cannot find module '.../src/app/lib/ptoAccrual.ts'` / `mondayResolve.ts`.

- [ ] **Step 4: Confirm the rest of the suite is still 69 passing**

Run: `node --test "tests/*.test.ts"`
Expected: `pass 69`, `fail 2` (the two new files failing to import).

- [ ] **Step 5: Commit**

```bash
git add tests/ptoAccrual.test.ts tests/mondayResolve.test.ts
git commit -m "test: specify ptoAccrual and mondayResolve before they exist"
```

---

### Task 2: Create the two pure libs in UIB

**Files:**
- Create (via UIB): `src/app/lib/ptoAccrual.ts`, `src/app/lib/mondayResolve.ts`
- Create: `docs/superpowers/prompts/2026-08-18-pto/02-pure-libs.md` (the prompt, saved verbatim)

**Interfaces:**
- Consumes: `normalizeName` from `src/app/lib/classificationEngine.ts` (existing: strips accents, lowercases, collapses whitespace).
- Produces: the signatures listed in Task 1.

- [ ] **Step 1: Save the prompt to `docs/superpowers/prompts/2026-08-18-pto/02-pure-libs.md`, then paste it into UIB**

````markdown
Create two new pure TypeScript modules. Do not modify any existing file. Only these two files may be created; no other file may change.

## 1. `src/app/lib/ptoAccrual.ts` — exactly this content

```ts
// PTO accrual rules for GAF Healthcare Panama. Pure functions, no I/O.
// Dates are 'YYYY-MM-DD' strings. No Date objects are constructed for the
// arithmetic here — see AGENTS.md, Timezone rules.

function parts(d: string): [number, number, number] {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return [y, m, day];
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function isLastDayOfFeb(y: number, m: number, d: number): boolean {
  return m === 2 && d === (isLeap(y) ? 29 : 28);
}

/**
 * Excel DAYS360, US (NASD) method — the formula the PTO tracker workbook uses.
 *  - If start is the 31st or the last day of February, start day = 30.
 *  - If end is the 31st: if start day < 30 the end becomes the 1st of the next
 *    month, otherwise the end day = 30.
 */
export function days360(start: string, end: string): number {
  const [y1, m1, d1raw] = parts(start);
  const [y2raw, m2raw, d2raw] = parts(end);
  let d1 = d1raw;
  let d2 = d2raw;
  let m2 = m2raw;
  let y2 = y2raw;
  if (d1 === 31 || isLastDayOfFeb(y1, m1, d1)) d1 = 30;
  if (d2 === 31) {
    if (d1 < 30) { d2 = 1; m2 += 1; if (m2 === 13) { m2 = 1; y2 += 1; } }
    else d2 = 30;
  }
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

/** Accumulated PTO days: 1 day per 11 DAYS360 days (≈ 33 per year). */
export function accruedPto(start: string, asOf: string): number {
  return days360(start, asOf) / 11;
}

/** Sum of total_days over recorded ledger rows only. SQL may return numerics as strings. */
export function takenPto(rows: { total_days: number | string | null; status: string }[]): number {
  return rows.reduce((sum, r) => r.status === 'recorded' ? sum + (Number(r.total_days) || 0) : sum, 0);
}

function toDayNumber(d: string): number {
  // Days since 1970-01-01 using UTC so no local timezone can shift the result.
  const [y, m, day] = parts(d);
  return Math.round(Date.UTC(y, m - 1, day) / 86400000);
}

function fromDayNumber(n: number): string {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

/** Calendar days between leave_on and return_on — what every row in the sheet is. */
export function defaultTotalDays(leaveOn: string, returnOn: string): number {
  return toDayNumber(returnOn) - toDayNumber(leaveOn);
}

/** Floating holidays: eligible 90 calendar days after hire. */
export function fhEligibleDate(start: string): string {
  return fromDayNumber(toDayNumber(start) + 90);
}

export function fhRemaining(allocated: number, used: number): number {
  return Math.max(0, (Number(allocated) || 0) - (Number(used) || 0));
}
```

## 2. `src/app/lib/mondayResolve.ts` — exactly this content

```ts
// Resolves a Monday.com board row to an employees.id.
// Order is the same as the classification engine's rowMatchesEmp:
//   email → name_aliases → normalized display_name. No match → null.
import { normalizeName } from './classificationEngine'; // relative, like teramindParser.ts — node tests import this file directly

export interface ResolvableEmployee { id: number; display_name: string; teramind_email: string | null }
export interface ResolvableAlias { alias_text: string; employee_id: number }
export type Resolver = (name: string | null | undefined, email: string | null | undefined) => number | null;

export function buildResolver(employees: ResolvableEmployee[], aliases: ResolvableAlias[]): Resolver {
  const byEmail = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const e of employees) {
    if (e.teramind_email) byEmail.set(e.teramind_email.trim().toLowerCase(), e.id);
    byName.set(normalizeName(e.display_name), e.id);
  }
  const byAlias = new Map<string, number>();
  for (const a of aliases) byAlias.set(normalizeName(a.alias_text), a.employee_id);

  return (name, email) => {
    const em = (email ?? '').trim().toLowerCase();
    if (em && byEmail.has(em)) return byEmail.get(em)!;
    const nm = name ? normalizeName(name) : '';
    if (nm && byAlias.has(nm)) return byAlias.get(nm)!;
    if (nm && byName.has(nm)) return byName.get(nm)!;
    return null;
  };
}
```

Acceptance: both files exist with exactly the content above; no other file in the project changed.
````

- [ ] **Step 2: LOOP** — Expected files: `src/app/lib/ptoAccrual.ts`, `src/app/lib/mondayResolve.ts` (both `??`). Tests: `node --test "tests/*.test.ts"` → 69 + 11 new = **80 pass, 0 fail**. Browser check: none (no action or page changed).

- [ ] **Step 3: Commit**

```bash
git add src/app/lib/ptoAccrual.ts src/app/lib/mondayResolve.ts docs/superpowers/prompts/2026-08-18-pto/02-pure-libs.md
git commit -m "sync: add ptoAccrual and mondayResolve pure libs (12 tests green)"
```

---

### Task 3: Migration 1 — Monday mirror tables

**Files:**
- Create (via UIB): `src/migrations/<ts>_create_monday_mirror_tables.sql`; `src/migrations/applied.txt` (+1 line, written by UIB)
- Create: `docs/superpowers/prompts/2026-08-18-pto/03-migration-mirror-tables.md`

**Interfaces:**
- Produces: tables `monday_requests`, `monday_attendance_forms`, `monday_contracts`, `monday_sync_log` with the columns below. Later tasks' SQL actions depend on these exact names.

- [ ] **Step 1: Save and paste the prompt**

````markdown
Create and apply a new database migration named `create_monday_mirror_tables` against the `GAF Planilla DB` datasource, with exactly the SQL below. Do not change any other file. Do not modify existing tables.

```sql
-- Durable local mirror of four Monday.com boards. Rows are keyed by the
-- Monday item id; employee_id is resolved at sync time (email → alias → name)
-- and is NULL when nothing matched. Rows are never deleted: an item that
-- disappears from the board is flagged deleted_on_monday.

CREATE TABLE IF NOT EXISTS monday_requests (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monday_item_id        BIGINT NOT NULL UNIQUE,
  employee_id           BIGINT NULL REFERENCES employees(id) ON DELETE SET NULL,
  employee_name_raw     TEXT,
  employee_email_raw    TEXT,
  manager_email_raw     TEXT,
  board_group           TEXT,
  request_type          TEXT,
  permission_type       TEXT,
  start_date            DATE,
  end_date              DATE,
  return_date           DATE,
  start_datetime        TEXT,
  end_datetime          TEXT,
  total_days_requested  NUMERIC(6,2),
  hours_approved        NUMERIC(6,2),
  reason                TEXT,
  details               TEXT,
  submitted_at          TEXT,
  raw                   JSONB NOT NULL,
  deleted_on_monday     BOOLEAN NOT NULL DEFAULT false,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monday_requests_employee ON monday_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_monday_requests_type_start ON monday_requests (request_type, start_date);

CREATE TABLE IF NOT EXISTS monday_attendance_forms (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monday_item_id        BIGINT NOT NULL UNIQUE,
  employee_id           BIGINT NULL REFERENCES employees(id) ON DELETE SET NULL,
  employee_name_raw     TEXT,
  employee_email_raw    TEXT,
  board_group           TEXT,
  form_type             TEXT,
  reason                TEXT,
  details               TEXT,
  eta                   TEXT,
  form_date             DATE,
  submitted_at          TEXT,
  raw                   JSONB NOT NULL,
  deleted_on_monday     BOOLEAN NOT NULL DEFAULT false,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monday_attendance_forms_emp_date ON monday_attendance_forms (employee_id, form_date);

CREATE TABLE IF NOT EXISTS monday_contracts (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monday_item_id        BIGINT NOT NULL UNIQUE,
  employee_id           BIGINT NULL REFERENCES employees(id) ON DELETE SET NULL,
  employee_name_raw     TEXT,
  employee_email_raw    TEXT,
  board_group           TEXT,
  position              TEXT,
  state                 TEXT,
  manager_raw           TEXT,
  start_date            DATE,
  contract_end_date     DATE,
  raw                   JSONB NOT NULL,
  deleted_on_monday     BOOLEAN NOT NULL DEFAULT false,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monday_contracts_employee ON monday_contracts (employee_id);

CREATE TABLE IF NOT EXISTS monday_sync_log (
  board_key        TEXT PRIMARY KEY,
  last_synced_at   TIMESTAMPTZ,
  item_count       INT NOT NULL DEFAULT 0,
  matched_count    INT NOT NULL DEFAULT 0,
  unmatched_count  INT NOT NULL DEFAULT 0,
  last_error       TEXT
);
INSERT INTO monday_sync_log (board_key) VALUES ('directory'), ('requests'), ('attendance_forms'), ('contracts')
ON CONFLICT (board_key) DO NOTHING;
```

Acceptance: the migration is applied; `SELECT count(*) FROM monday_sync_log` returns 4; no file other than the new migration and `src/migrations/applied.txt` changed.
````

- [ ] **Step 2: Verify in UIB's Database tab** — run `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'monday\_%' ORDER BY 1;` Expected 4 rows. Run `SELECT * FROM monday_sync_log;` Expected 4 rows with NULL `last_synced_at`.

- [ ] **Step 3: LOOP** — Expected files: `src/migrations/<ts>_create_monday_mirror_tables.sql`, `src/migrations/applied.txt`. Tests: 80 pass. Browser check: none.

- [ ] **Step 4: Commit**

```bash
git add src/migrations docs/superpowers/prompts/2026-08-18-pto/03-migration-mirror-tables.md
git commit -m "sync: create Monday mirror tables (monday_requests, _attendance_forms, _contracts, _sync_log)"
```

---

### Task 4: Migration 2 — Monday config keys (owner supplies every ID)

**Files:**
- Create (via UIB): `src/migrations/<ts>_seed_monday_config_keys.sql`; `applied.txt`
- Create: `docs/superpowers/prompts/2026-08-18-pto/04-migration-config-keys.md`

**Interfaces:**
- Produces: `classification_config` rows for every key named below. Tasks 7–8 read them with no fallback.

- [ ] **Step 1: Collect the IDs from the owner — do not guess any of them**

Ask the owner to open each board in Monday.com → board menu → *Developers* / *API playground*, or run this in the app's browser console on the Process page (it uses the existing `pullMondayBoard` datasource) — whichever they prefer:

```
{ boards(ids: [<BOARD_ID>]) { id name columns { id title type } } }
```

Boards to query: Permissions & Requests (`monday_board_permissions` = 18394590373, already in config), GAF Attendance (`monday_board_attendance` = 9542698245, already in config), Employee Onboarding (ID to confirm — `src/actions/fetchMondayStartDates.ts` queries `8661565945`, which is likely it, but **the owner confirms**).

Fill this table with the owner (title → column id):

| Config key | Board | Column title on the board |
|---|---|---|
| `monday_board_onboarding` | — | (board id) |
| `monday_col_requests_name` | Permissions | Name (item name — use literal `name`) |
| `monday_col_requests_email` | Permissions | Email |
| `monday_col_requests_manager_email` | Permissions | Manager Email |
| `monday_col_requests_request_type` | Permissions | Request Type |
| `monday_col_requests_permission_type` | Permissions | Permission Type |
| `monday_col_requests_date_range` | Permissions | Date(s) Requested |
| `monday_col_requests_return_date` | Permissions | Return to Work Date |
| `monday_col_requests_start_datetime` | Permissions | Start Date & Time |
| `monday_col_requests_end_datetime` | Permissions | End Date & Time |
| `monday_col_requests_total_days` | Permissions | Total Days Requested |
| `monday_col_requests_hours_approved` | Permissions | Hours Per Day Approved |
| `monday_col_requests_reason` | Permissions | Reason |
| `monday_col_requests_details` | Permissions | Details |
| `monday_col_requests_submitted` | Permissions | Date Submission |
| `monday_col_attendance_details` | Attendance | Details |
| `monday_col_attendance_eta` | Attendance | ETA |
| `monday_col_onboarding_position` | Onboarding | Position |
| `monday_col_onboarding_state` | Onboarding | State |
| `monday_col_onboarding_manager` | Onboarding | Manager |
| `monday_col_onboarding_start_date` | Onboarding | Start Date |
| `monday_col_onboarding_contract_end` | Onboarding | 6 Contract End Date |

Existing keys reused unchanged: `monday_board_permissions`, `monday_board_attendance`, `monday_board_directory`, `monday_col_permissions_email|daterange|type|type_alt`, `monday_col_attendance_email|date|type|reason`, `monday_col_directory_role|manager|active|email`. Note `monday_col_requests_email` may equal `monday_col_permissions_email` — that is fine; the new keys are a complete, self-describing set for the mirror and the old ones stay for the payroll run.

- [ ] **Step 2: Save and paste the prompt (with the confirmed values substituted for `<…>`)**

````markdown
Create and apply a new database migration named `seed_monday_config_keys` against `GAF Planilla DB` with exactly the SQL below. Do not change any other file.

```sql
INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('monday_board_onboarding',            '<BOARD_ID>',   'Monday Board: Employee Onboarding', 'Monday.com board ID for Employee Onboarding / Contract Tracking.', 'number', 'monday_boards'),
  ('monday_col_requests_name',           'name',         'Requests: Name',            'Item name on the Permissions & Requests board (literal name).', 'text', 'monday_columns'),
  ('monday_col_requests_email',          '<COL_ID>',     'Requests: Email',           'Employee email column on the Permissions & Requests board.', 'text', 'monday_columns'),
  ('monday_col_requests_manager_email',  '<COL_ID>',     'Requests: Manager Email',   'Manager email column.', 'text', 'monday_columns'),
  ('monday_col_requests_request_type',   '<COL_ID>',     'Requests: Request Type',    'PTO / Vacation, Time Off / Permission, Floating Holiday, Birthday Day Off, Work From Home…', 'text', 'monday_columns'),
  ('monday_col_requests_permission_type','<COL_ID>',     'Requests: Permission Type', 'e.g. Time for Time.', 'text', 'monday_columns'),
  ('monday_col_requests_date_range',     '<COL_ID>',     'Requests: Date(s) Requested', 'Date range column (from/to).', 'text', 'monday_columns'),
  ('monday_col_requests_return_date',    '<COL_ID>',     'Requests: Return to Work Date', '', 'text', 'monday_columns'),
  ('monday_col_requests_start_datetime', '<COL_ID>',     'Requests: Start Date & Time', 'Time-for-Time start.', 'text', 'monday_columns'),
  ('monday_col_requests_end_datetime',   '<COL_ID>',     'Requests: End Date & Time',   'Time-for-Time end.', 'text', 'monday_columns'),
  ('monday_col_requests_total_days',     '<COL_ID>',     'Requests: Total Days Requested', '', 'text', 'monday_columns'),
  ('monday_col_requests_hours_approved', '<COL_ID>',     'Requests: Hours Per Day Approved', '', 'text', 'monday_columns'),
  ('monday_col_requests_reason',         '<COL_ID>',     'Requests: Reason',          '', 'text', 'monday_columns'),
  ('monday_col_requests_details',        '<COL_ID>',     'Requests: Details',         '', 'text', 'monday_columns'),
  ('monday_col_requests_submitted',      '<COL_ID>',     'Requests: Date Submission', '', 'text', 'monday_columns'),
  ('monday_col_attendance_details',      '<COL_ID>',     'Attendance: Details',       '', 'text', 'monday_columns'),
  ('monday_col_attendance_eta',          '<COL_ID>',     'Attendance: ETA',           '', 'text', 'monday_columns'),
  ('monday_col_onboarding_position',     '<COL_ID>',     'Onboarding: Position',      '', 'text', 'monday_columns'),
  ('monday_col_onboarding_state',        '<COL_ID>',     'Onboarding: State',         '', 'text', 'monday_columns'),
  ('monday_col_onboarding_manager',      '<COL_ID>',     'Onboarding: Manager',       '', 'text', 'monday_columns'),
  ('monday_col_onboarding_start_date',   '<COL_ID>',     'Onboarding: Start Date',    '', 'text', 'monday_columns'),
  ('monday_col_onboarding_contract_end', '<COL_ID>',     'Onboarding: Contract End Date', '', 'text', 'monday_columns')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, label = EXCLUDED.label, description = EXCLUDED.description;
```

Acceptance: `SELECT count(*) FROM classification_config WHERE key LIKE 'monday_col_requests_%'` returns 14; no other file changed.
````

If `classification_config` has no unique constraint on `key` (check with `\d`-equivalent: `SELECT conname FROM pg_constraint WHERE conrelid='classification_config'::regclass;`), replace `ON CONFLICT (key) DO UPDATE …` with a preceding `DELETE FROM classification_config WHERE key IN (…all keys…);`.

- [ ] **Step 3: Verify in UIB's Database tab** — `SELECT key, value FROM classification_config WHERE category IN ('monday_boards','monday_columns') ORDER BY key;` Every new key present, no empty `value`.

- [ ] **Step 4: LOOP** — Expected files: the new migration + `applied.txt`. Tests: 80 pass. Browser: Admin → Rules & Config shows the new keys (read-only sanity, no action changed).

- [ ] **Step 5: Commit**

```bash
git add src/migrations docs/superpowers/prompts/2026-08-18-pto/04-migration-config-keys.md
git commit -m "sync: seed Monday board/column config keys for the mirror (owner-confirmed IDs)"
```

---

### Task 5: Migration 3 — revive the PTO tables

**Files:**
- Create (via UIB): `src/migrations/<ts>_revive_pto_tables.sql`; `applied.txt`
- Create: `docs/superpowers/prompts/2026-08-18-pto/05-migration-revive-pto.md`

**Interfaces:**
- Produces: `pto_approvals(monday_item_id, source, recorded_by, recorded_at, status ∈ pending|recorded|withdrawn, total_days NUMERIC)`, `pto_employees(paid_pto_days, pto_start_date_override)`. Tasks 12–15 depend on these names.

- [ ] **Step 1: Save and paste the prompt**

````markdown
Create and apply a new database migration named `revive_pto_tables` against `GAF Planilla DB` with exactly the SQL below. These three tables were created by migration 1781402200 and have never been used; this brings them into use. Do not change any other file.

```sql
-- pto_approvals: the PTO ledger. Monday submissions are pending until recorded.
ALTER TABLE pto_approvals
  ADD COLUMN IF NOT EXISTS monday_item_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS recorded_by   TEXT NULL,
  ADD COLUMN IF NOT EXISTS recorded_at   TIMESTAMPTZ NULL;
ALTER TABLE pto_approvals ALTER COLUMN total_days TYPE NUMERIC(5,2);
UPDATE pto_approvals SET status = 'recorded' WHERE status = 'approved';
ALTER TABLE pto_approvals ALTER COLUMN status SET DEFAULT 'recorded';
ALTER TABLE pto_approvals DROP CONSTRAINT IF EXISTS pto_approvals_status_check;
ALTER TABLE pto_approvals ADD CONSTRAINT pto_approvals_status_check CHECK (status IN ('pending','recorded','withdrawn'));
ALTER TABLE pto_approvals DROP CONSTRAINT IF EXISTS pto_approvals_source_check;
ALTER TABLE pto_approvals ADD CONSTRAINT pto_approvals_source_check CHECK (source IN ('monday','excel_import','manual'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_pto_approvals_monday_item ON pto_approvals (monday_item_id) WHERE monday_item_id IS NOT NULL;
ALTER TABLE pto_approvals DROP CONSTRAINT IF EXISTS fk_pto_approvals_monday_item;
ALTER TABLE pto_approvals ADD CONSTRAINT fk_pto_approvals_monday_item
  FOREIGN KEY (monday_item_id) REFERENCES monday_requests(monday_item_id) ON DELETE SET NULL;

-- pto_employees: manual per-employee facts.
ALTER TABLE pto_employees RENAME COLUMN paid_pto_cap TO paid_pto_days;
ALTER TABLE pto_employees ALTER COLUMN paid_pto_days SET DEFAULT 0;
ALTER TABLE pto_employees ADD COLUMN IF NOT EXISTS pto_start_date_override DATE NULL;
```

Acceptance: `SELECT column_name FROM information_schema.columns WHERE table_name='pto_approvals' ORDER BY ordinal_position` includes monday_item_id, source, recorded_by, recorded_at; `pto_employees` has paid_pto_days and pto_start_date_override and no paid_pto_cap. No other file changed.
````

- [ ] **Step 2: Verify in UIB's Database tab** with the two queries in the acceptance line. Also `SELECT count(*) FROM pto_approvals;` — record the count (expected 0; if not 0, stop and tell the owner what is there before continuing).

- [ ] **Step 3: LOOP** — Expected files: new migration + `applied.txt`. Tests: 80 pass. Browser: none.

- [ ] **Step 4: Commit**

```bash
git add src/migrations docs/superpowers/prompts/2026-08-18-pto/05-migration-revive-pto.md
git commit -m "sync: revive pto_* tables — ledger status/source/monday link, paid_pto_days, start-date override"
```

---

### Task 6: Employees hub shell + Roster tab (new files, temporary route)

**Files:**
- Create (via UIB): `src/app/pages/admin/AdminEmployeesHub.tsx`, `src/app/pages/admin/employees/RosterTab.tsx`
- Modify (via UIB): `src/app/app.tsx` (one route), `src/app/TopNav.tsx` (one admin sub-link)
- Create: `docs/superpowers/prompts/2026-08-18-pto/06-employees-hub-roster.md`

**Interfaces:**
- Consumes: existing actions `loadAllEmployees`, `loadSchedules`, `upsertEmployee`, `updateEmployeeFlag` (as `AdminEmployees.tsx` uses them today).
- Produces: `AdminEmployeesHub` renders tabs `roster` | `monday` | `aliases` from the URL search param `?tab=`; Tasks 7–10 add the `MondayTab` and `AliasesTab` components it imports.

- [ ] **Step 1: Save and paste the prompt**

````markdown
Build the shell of a new consolidated Employees admin page. This is the first step of replacing Admin → Employees, Directory Sync and Name Aliases with one page. The old pages must keep working untouched.

Files that may be created: `src/app/pages/admin/AdminEmployeesHub.tsx`, `src/app/pages/admin/employees/RosterTab.tsx`.
Files that may be modified, minimally: `src/app/app.tsx` (add one nested admin route), `src/app/TopNav.tsx` (add one admin sub-link).
No other file may change. In particular do NOT modify `AdminEmployees.tsx`, `AdminEmployeeSync.tsx`, `AdminAliases.tsx`, `AdminLayout.tsx`, or anything under `src/actions/`.

## AdminEmployeesHub.tsx
- Route: `employees-hub` under the existing `/admin` `AdminLayout` route in `app.tsx` (i.e. `/admin/employees-hub`). Keep the existing `employees`, `aliases`, `directory-sync` routes exactly as they are.
- Header: title "Employees", subtitle "Roster · Monday · Aliases".
- Tab strip with three tabs — Roster, Monday, Aliases — driven by the URL search param `tab` (`?tab=roster` default, `?tab=monday`, `?tab=aliases`) using `useSearchParams` from react-router-dom, so a reload keeps the tab. Use the same visual style as the tab strip on the Attendance page.
- Renders `<RosterTab />` for roster. For the other two tabs render a placeholder card with the text "Coming next" — those components are added in later steps.
- Keep this file small (well under 10 KB): it only owns the header, tab strip and routing.

## employees/RosterTab.tsx
- The Roster tab is the current Admin → Employees page moved as-is: the same active/inactive counters, search box, Active/Inactive/All filter, the grid (Name, Teramind Email, Domain, Schedule, Grace, Macbook, Excluded, Active, Edit) and the Add Employee / Edit dialog. Reproduce the behaviour of `src/app/pages/admin/AdminEmployees.tsx` by moving its JSX and handlers into this component, using the same actions: `loadAllEmployees`, `loadSchedules`, `upsertEmployee`, `updateEmployeeFlag`. Do not change what those actions receive.
- If moving everything would push this file past 15 KB, split the edit dialog into `src/app/pages/admin/employees/EmployeeEditDialog.tsx` (that file is then also allowed).

## TopNav.tsx
- In the Admin section's sub-links, add `{ to: '/admin/employees-hub', label: 'Employees (new)', icon: Users }` immediately after the existing Employees link. Do not remove or reorder existing links.

Acceptance:
- `/admin/employees-hub` shows the tab strip; the Roster tab lists the same employees with the same counts as `/admin/employees`; toggling a flag (e.g. Grace) on the new page and reloading `/admin/employees` shows the same value; Add Employee works from the new page.
- `/admin/employees`, `/admin/directory-sync`, `/admin/aliases` are unchanged and still work.
- Only the four files named above changed (plus `EmployeeEditDialog.tsx` if the split was needed).
````

- [ ] **Step 2: LOOP** — Expected files: `src/app/pages/admin/AdminEmployeesHub.tsx`, `src/app/pages/admin/employees/RosterTab.tsx`, `src/app/app.tsx`, `src/app/TopNav.tsx` (optionally `.../employees/EmployeeEditDialog.tsx`). Tests: 80 pass. Browser: open `/admin/employees-hub` → Roster shows the same active count as `/admin/employees`; flip Grace on one test-safe employee on the new page, reload the old page, confirm, flip it back.

- [ ] **Step 3: Commit**

```bash
git add src/app docs/superpowers/prompts/2026-08-18-pto/06-employees-hub-roster.md
git commit -m "sync: Employees hub shell with Roster tab at /admin/employees-hub (old pages untouched)"
```

---

### Task 7: Monday tab — Directory sync card, config-driven (closes BACKLOG #3 phase 2)

**Files:**
- Create (via UIB): `src/app/pages/admin/employees/MondayTab.tsx`, `src/app/pages/admin/employees/MondaySyncCard.tsx`, `src/actions/upsertMondaySyncLog.ts`, `src/actions/loadMondaySyncLog.ts`
- Modify (via UIB): `src/app/pages/admin/AdminEmployeesHub.tsx` (import `MondayTab`)
- Create: `docs/superpowers/prompts/2026-08-18-pto/07-monday-tab-directory.md`

**Interfaces:**
- Consumes: `pullMondayBoard` (`{ query, variables }`), `loadClassificationConfig`, `loadAllEmployees`, `loadNameAliases`, `updateEmployeeRoleManager({ id, role, manager })`, `updateEmployeeFlag({ id, is_grace_list, is_macbook_swap, excluded_from_payroll, active })`, `upsertEmployee(...)`, `updateEmployeeStartDate({ display_name, start_date })`, `buildResolver` from `mondayResolve.ts`.
- Produces: `MondaySyncCard` props `{ boardKey: 'directory'|'requests'|'attendance_forms'|'contracts'; title: string; onSync: () => Promise<{ items: number; matched: number; unmatched: number }>; log: SyncLogRow | undefined; onDone: () => void }`; a shared helper inside `MondayTab.tsx`: `async function pullAllItems(pull, boardId: number, columnIds: string[]): Promise<MondayItem[]>` (paginates with `items_page`/`next_items_page`); `type MondayItem = { id: string; name: string; group: { title: string }; column_values: { id: string; text: string | null; value: string | null }[] }`. `upsertMondaySyncLog` params `{ board_key, item_count, matched_count, unmatched_count, last_error }`; `loadMondaySyncLog` returns all four rows.

- [ ] **Step 1: Save and paste the prompt**

````markdown
Add the Monday tab to the Employees hub with its first card: Directory sync, re-implemented config-driven. This replaces what `AdminEmployeeSync.tsx` does today, but that file must not be modified — it stays live until a later step deletes it.

Files that may be created: `src/app/pages/admin/employees/MondayTab.tsx`, `src/app/pages/admin/employees/MondaySyncCard.tsx`, `src/actions/upsertMondaySyncLog.ts`, `src/actions/loadMondaySyncLog.ts`.
Files that may be modified: `src/app/pages/admin/AdminEmployeesHub.tsx` (only to import and render `MondayTab` in place of the "Coming next" placeholder for the monday tab).
No other file may change. Do NOT modify `AdminEmployeeSync.tsx`, `loadEmployeeDirectory.ts`, `fetchMondayStartDates.ts`, `pullMondayBoard.ts`, `ProcessPayroll.tsx`, or `classificationEngine.ts`.

## Non-negotiable rules for this change
- Every Monday board ID and column ID is read from `classification_config` via the existing `loadClassificationConfig` action. There is NO fallback value: if a required key is missing or empty, show a red banner naming the key and do not call Monday. Never write a board or column ID literal anywhere in these files.
- Call Monday only through the existing generic action `src/actions/pullMondayBoard.ts`, passing the whole GraphQL query string as `params.query` and an object as `params.variables`. Never put `{{params.…}}` inside a quoted string.
- Dates from Monday are stored as the text Monday returns. No timezone conversion.

## New SQL actions (datasource `GAF Planilla DB`, one per file, `import { action } from '@uibakery/data'` pattern like the other actions)
- `upsertMondaySyncLog`: `INSERT INTO monday_sync_log (board_key, last_synced_at, item_count, matched_count, unmatched_count, last_error) VALUES ({{params.board_key}}, NOW(), {{params.item_count}}, {{params.matched_count}}, {{params.unmatched_count}}, {{params.last_error}}) ON CONFLICT (board_key) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at, item_count = EXCLUDED.item_count, matched_count = EXCLUDED.matched_count, unmatched_count = EXCLUDED.unmatched_count, last_error = EXCLUDED.last_error`.
- `loadMondaySyncLog`: `SELECT board_key, last_synced_at, item_count, matched_count, unmatched_count, last_error FROM monday_sync_log ORDER BY board_key`.

## MondayTab.tsx
- Loads config (`loadClassificationConfig`), employees (`loadAllEmployees`), aliases (`loadNameAliases`), and the sync log (`loadMondaySyncLog`).
- Exposes internally a helper `pullAllItems(boardId, columnIds)` that pages through the board: first query `{ boards(ids: [<boardId>]) { items_page(limit: 500) { cursor items { id name group { title } column_values(ids: [<columnIds>]) { id text value } } } } }`, then while `cursor` is non-null query `{ next_items_page(limit: 500, cursor: "<cursor>") { cursor items { id name group { title } column_values(ids: [<columnIds>]) { id text value } } } }`. Build the query string in TypeScript and call `pullMondayBoard` with `{ query, variables: {} }`. Concatenate all items.
- Builds a resolver with `buildResolver(employees, aliases)` from `src/app/lib/mondayResolve.ts`.
- Renders a 2×2 grid of `MondaySyncCard`s for keys `directory`, `requests`, `attendance_forms`, `contracts`. In this step only the Directory card is wired; the other three cards render with their title and log row but the Sync now button disabled with tooltip "Next step".

## MondaySyncCard.tsx
- Props: `boardKey`, `title`, `onSync` (async, returns `{ items, matched, unmatched }`), `log` (the row from `loadMondaySyncLog` for this key, may be undefined), `onDone` (called after a sync so the parent reloads the log).
- Shows: title, "Last synced" (`last_synced_at` formatted, or "never"), three counters (items / matched / unmatched), `last_error` in red if present, and a **Sync now** button with a spinner while running. On error: show the message under the button; call `upsertMondaySyncLog` with `last_error` = message and the previous counts.

## Directory card behaviour (must equal what Admin → Directory Sync does today)
Reads keys `monday_board_directory`, `monday_col_directory_email`, `monday_col_directory_role`, `monday_col_directory_manager`, `monday_col_directory_active`. Pulls all items. For each item: resolve to an employee (email from the email column → alias → name). Then:
1. Matched employees: update `role` and `manager` from the role/manager columns via `updateEmployeeRoleManager({ id, role, manager })`; update `active` from the active-status column (Active → true, anything else → false) via `updateEmployeeFlag({ id, is_grace_list, is_macbook_swap, excluded_from_payroll, active })` passing the employee's current values for the three flags. Only call these when a value actually changed.
2. Unmatched items whose email column is non-empty and does not exist in `employees`: offer to create them exactly as the current page's "Add missing" flow does — with `upsertEmployee` — but behind a confirmation dialog listing them; default is to skip. (Do not auto-create.)
3. Start dates: read `monday_board_onboarding` and `monday_col_onboarding_start_date`, pull that board with `pullAllItems`, resolve by name/email, and for matched employees whose `employees.start_date` is empty, call `updateEmployeeStartDate({ display_name, start_date })` with the date text (YYYY-MM-DD) exactly as Monday returns it. Never overwrite a non-empty start_date.
Finally call `upsertMondaySyncLog({ board_key: 'directory', item_count, matched_count, unmatched_count, last_error: null })` and `onDone()`.
Show a result summary under the card: "N updated · M created · K start dates set · U unmatched".

Acceptance:
- On `/admin/employees-hub?tab=monday`, pressing Sync now on Directory completes and the card shows counts; `SELECT * FROM monday_sync_log WHERE board_key='directory'` has a fresh `last_synced_at`.
- Running it a second time reports the same item/matched/unmatched counts and "0 updated".
- Roles/managers in `/admin/employees` match what `/admin/directory-sync` produces (compare a few rows).
- Removing the value of `monday_col_directory_role` in Admin → Rules & Config and reloading shows a red banner naming that key and the button is disabled; restoring the value re-enables it.
- Only the files named above changed.
````

- [ ] **Step 2: LOOP** — Expected files: the four new files, `AdminEmployeesHub.tsx`. Tests: 80 pass. Browser (mandatory — actions changed): run Directory sync twice; identical counts the second time; spot-check three employees' role/manager against the old page; test the missing-key banner and restore the key.

- [ ] **Step 3: Commit**

```bash
git add src/app src/actions docs/superpowers/prompts/2026-08-18-pto/07-monday-tab-directory.md
git commit -m "sync: Monday tab with config-driven Directory sync card (BACKLOG #3 phase 2, no hardcoded IDs)"
```

Update `docs/BACKLOG.md` item 3 to "✅ phase 2 done" in this commit or the next docs commit.

---

### Task 8: Monday tab — Requests, Attendance forms, Contracts cards + upsert actions

**Files:**
- Create (via UIB): `src/actions/upsertMondayRequests.ts`, `src/actions/upsertMondayAttendanceForms.ts`, `src/actions/upsertMondayContracts.ts`, `src/actions/updateMondayDeleted.ts`
- Modify (via UIB): `src/app/pages/admin/employees/MondayTab.tsx`
- Create: `docs/superpowers/prompts/2026-08-18-pto/08-monday-tab-boards.md`

**Interfaces:**
- Consumes: `pullAllItems`, `buildResolver`, `MondaySyncCard`, `upsertMondaySyncLog` from Task 7; config keys from Task 4; tables from Task 3.
- Produces: `upsertMondayRequests({ rows: string })` where `rows` is a JSON array of objects with keys `monday_item_id, employee_id, employee_name_raw, employee_email_raw, manager_email_raw, board_group, request_type, permission_type, start_date, end_date, return_date, start_datetime, end_datetime, total_days_requested, hours_approved, reason, details, submitted_at, raw`; same shape idea for `upsertMondayAttendanceForms` (`…, form_type, reason, details, eta, form_date, submitted_at, raw`) and `upsertMondayContracts` (`…, position, state, manager_raw, start_date, contract_end_date, raw`); `updateMondayDeleted({ table: 'monday_requests'|'monday_attendance_forms'|'monday_contracts', seen_ids: string })` — because `{{params.table}}` cannot be an identifier, this is three CASE-free statements: implement as three separate actions `updateMondayRequestsDeleted`, `updateMondayAttendanceFormsDeleted`, `updateMondayContractsDeleted` (each: `UPDATE <table> SET deleted_on_monday = NOT (monday_item_id = ANY(SELECT jsonb_array_elements_text({{params.seen_ids}}::jsonb)::bigint))`). **Use the three-action form**; the single `updateMondayDeleted` name in the file structure is superseded by these three.

- [ ] **Step 1: Save and paste the prompt**

````markdown
Wire the remaining three cards on the Employees hub Monday tab: Requests (Permissions & Requests board), Attendance forms (GAF Attendance board), Contracts (Employee Onboarding board). Each syncs the board into its mirror table.

Files that may be created: `src/actions/upsertMondayRequests.ts`, `src/actions/upsertMondayAttendanceForms.ts`, `src/actions/upsertMondayContracts.ts`, `src/actions/updateMondayRequestsDeleted.ts`, `src/actions/updateMondayAttendanceFormsDeleted.ts`, `src/actions/updateMondayContractsDeleted.ts`.
Files that may be modified: `src/app/pages/admin/employees/MondayTab.tsx`.
No other file may change. Do NOT modify `ProcessPayroll.tsx` (its own Monday pull stays as is), `pullMondayBoard.ts`, `MondaySyncCard.tsx`, or anything else.

Rules: same as the Directory card — all IDs from `classification_config` with no fallback and a red banner naming any missing key; Monday only via `pullMondayBoard` with the whole query as `params.query`; dates stored as Monday's text; never write an ID literal.

## SQL actions (datasource `GAF Planilla DB`)
Each upsert takes one param `rows` (a JSON string of an array) and does a set-based upsert:

`upsertMondayRequests`:
```sql
INSERT INTO monday_requests (monday_item_id, employee_id, employee_name_raw, employee_email_raw, manager_email_raw, board_group, request_type, permission_type, start_date, end_date, return_date, start_datetime, end_datetime, total_days_requested, hours_approved, reason, details, submitted_at, raw, deleted_on_monday, synced_at)
SELECT (r->>'monday_item_id')::bigint, NULLIF(r->>'employee_id','')::bigint, r->>'employee_name_raw', r->>'employee_email_raw', r->>'manager_email_raw', r->>'board_group', r->>'request_type', r->>'permission_type', NULLIF(r->>'start_date','')::date, NULLIF(r->>'end_date','')::date, NULLIF(r->>'return_date','')::date, r->>'start_datetime', r->>'end_datetime', NULLIF(r->>'total_days_requested','')::numeric, NULLIF(r->>'hours_approved','')::numeric, r->>'reason', r->>'details', r->>'submitted_at', (r->'raw'), false, NOW()
FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
ON CONFLICT (monday_item_id) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, employee_name_raw = EXCLUDED.employee_name_raw, employee_email_raw = EXCLUDED.employee_email_raw, manager_email_raw = EXCLUDED.manager_email_raw, board_group = EXCLUDED.board_group, request_type = EXCLUDED.request_type, permission_type = EXCLUDED.permission_type, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, return_date = EXCLUDED.return_date, start_datetime = EXCLUDED.start_datetime, end_datetime = EXCLUDED.end_datetime, total_days_requested = EXCLUDED.total_days_requested, hours_approved = EXCLUDED.hours_approved, reason = EXCLUDED.reason, details = EXCLUDED.details, submitted_at = EXCLUDED.submitted_at, raw = EXCLUDED.raw, deleted_on_monday = false, synced_at = NOW()
```
`upsertMondayAttendanceForms` — same pattern with columns `monday_item_id, employee_id, employee_name_raw, employee_email_raw, board_group, form_type, reason, details, eta, form_date (date), submitted_at, raw`.
`upsertMondayContracts` — same pattern with columns `monday_item_id, employee_id, employee_name_raw, employee_email_raw, board_group, position, state, manager_raw, start_date (date), contract_end_date (date), raw`.

`updateMondayRequestsDeleted` (param `seen_ids`, JSON string of an array of item ids as strings):
```sql
UPDATE monday_requests SET deleted_on_monday = NOT (monday_item_id IN (SELECT (jsonb_array_elements_text({{params.seen_ids}}::jsonb))::bigint))
```
`updateMondayAttendanceFormsDeleted` and `updateMondayContractsDeleted` — identical for their tables.

## MondayTab.tsx — the three cards
Common: pull all items with the tab's `pullAllItems(boardId, columnIds)`, resolve each with the resolver (email column → alias → item name), map to the row objects below, upsert in batches of 100 (`JSON.stringify(batch)` as `rows`), then call the table's `…Deleted` action with all seen ids, then `upsertMondaySyncLog` for the board and `onDone()`. Column values: use `text` for everything except date-range and date columns, where you parse `value` (JSON) — date range: `{ from, to }`; date: `{ date }` — and store the `YYYY-MM-DD` text as returned, no conversion. Numbers: `Number(text)` or empty.

**Requests card** — keys `monday_board_permissions`, `monday_col_requests_email`, `monday_col_requests_manager_email`, `monday_col_requests_request_type`, `monday_col_requests_permission_type`, `monday_col_requests_date_range`, `monday_col_requests_return_date`, `monday_col_requests_start_datetime`, `monday_col_requests_end_datetime`, `monday_col_requests_total_days`, `monday_col_requests_hours_approved`, `monday_col_requests_reason`, `monday_col_requests_details`, `monday_col_requests_submitted`. Row: `monday_item_id = item.id`, `employee_name_raw = item.name`, `employee_email_raw = <email col text>`, `board_group = item.group.title`, `request_type`, `permission_type`, `start_date/end_date` from the range, `return_date`, `start_datetime/end_datetime` (text as-is), `total_days_requested`, `hours_approved`, `reason`, `details`, `submitted_at`, `raw = item`.

**Attendance forms card** — keys `monday_board_attendance`, `monday_col_attendance_email`, `monday_col_attendance_date`, `monday_col_attendance_type`, `monday_col_attendance_reason`, `monday_col_attendance_details`, `monday_col_attendance_eta`. Row: `form_type` = type text, `reason`, `details`, `eta`, `form_date` from the date column, `submitted_at` = the date column's raw text if it carries a time, `raw = item`.

**Contracts card** — keys `monday_board_onboarding`, `monday_col_onboarding_position`, `monday_col_onboarding_state`, `monday_col_onboarding_manager`, `monday_col_onboarding_start_date`, `monday_col_onboarding_contract_end`. Row: `position`, `state`, `manager_raw`, `start_date`, `contract_end_date`, `raw = item`. Resolve by item name (this board has no email column) via alias → name.

Acceptance:
- Sync now on each card completes; `SELECT count(*) FROM monday_requests` equals the card's item count; same for the other two tables.
- Syncing again changes no counts and `SELECT count(*) FROM monday_requests WHERE synced_at > now() - interval '5 minutes'` equals the item count (every row refreshed).
- `SELECT count(*) FROM monday_requests WHERE employee_id IS NULL` equals the card's unmatched count.
- Only the files named above changed.
````

- [ ] **Step 2: LOOP** — Expected files: six new actions, `MondayTab.tsx`. Tests: 80 pass. Browser (mandatory): sync all three boards; run the count queries in the Database tab; sync again → same counts.

- [ ] **Step 3: Commit**

```bash
git add src/app src/actions docs/superpowers/prompts/2026-08-18-pto/08-monday-tab-boards.md
git commit -m "sync: mirror Requests, Attendance-form and Contract boards into local tables (idempotent, batched)"
```

---

### Task 9: Reconciliation table + Unmatched list with inline Add alias

**Files:**
- Create (via UIB): `src/actions/loadDirectoryReconciliation.ts`, `src/actions/loadMondayUnmatched.ts`, `src/app/pages/admin/employees/ReconciliationTable.tsx`, `src/app/pages/admin/employees/UnmatchedList.tsx`
- Modify (via UIB): `src/app/pages/admin/employees/MondayTab.tsx` (render the two components below the cards)
- Create: `docs/superpowers/prompts/2026-08-18-pto/09-reconciliation-unmatched.md`

**Interfaces:**
- Consumes: mirror tables; `saveNameAlias` (existing; check its params in `src/actions/saveNameAlias.ts` — `{ alias_text, employee_id }` or as defined) ; `loadAllEmployees`.
- Produces: `loadDirectoryReconciliation()` rows `{ employee_id, display_name, teramind_email, role, manager, active, monday_email, monday_role, monday_manager, monday_active, monday_item_id }`; `loadMondayUnmatched()` rows `{ source: 'requests'|'attendance_forms'|'contracts', monday_item_id, employee_name_raw, employee_email_raw, board_group, first_seen: synced_at }`.

- [ ] **Step 1: Save and paste the prompt**

````markdown
Below the four sync cards on the Employees hub Monday tab, add (1) a reconciliation table comparing our `employees` rows to the Monday directory, and (2) an Unmatched list with an inline "Add alias" control.

Files that may be created: `src/actions/loadDirectoryReconciliation.ts`, `src/actions/loadMondayUnmatched.ts`, `src/app/pages/admin/employees/ReconciliationTable.tsx`, `src/app/pages/admin/employees/UnmatchedList.tsx`.
Files that may be modified: `src/app/pages/admin/employees/MondayTab.tsx` (render the two components; pass it a `refreshKey` that increments after any sync so they reload).
No other file may change.

## Where does the directory mirror come from?
The Directory card (previous step) writes into `employees` directly and does not keep a mirror table. For reconciliation, have the Directory card additionally keep its last pulled items in component state and pass them to `ReconciliationTable` as a prop `mondayDirectory: { item_id: string; name: string; email: string; role: string; manager: string; active: string }[]` (empty until the operator presses Sync now on Directory; show "Press Sync now on Directory to compare" in that case). Do NOT create a new table for this.

## loadDirectoryReconciliation (SQL, `GAF Planilla DB`)
```sql
SELECT id AS employee_id, display_name, teramind_email, role, manager, active
FROM employees
WHERE ({{params.manager}} IS NULL OR {{params.manager}} = '' OR manager = {{params.manager}})
ORDER BY display_name
```

## ReconciliationTable.tsx
- Props: `employees` (from `loadDirectoryReconciliation`), `mondayDirectory` (from the Directory card), `resolver` (the tab's resolver).
- For each employee find its Monday row (by email → alias → name using the resolver on the Monday rows). Columns: Employee · Email ✅/⚠️ · Role ✅/⚠️ · Manager ✅/⚠️ · Active ✅/⚠️ · Monday? (✅ found / ❌ not on board). A ⚠️ cell shows both values on hover (`title` attribute) — "ours: X · Monday: Y". Filter chips: All / Only mismatches / Not on Monday. A count line: "N employees · M mismatches · K not on Monday".
- Read-only. Fixing is done via Sync now (role/manager/active) or the Roster tab (email).

## loadMondayUnmatched (SQL)
```sql
SELECT 'requests' AS source, monday_item_id, employee_name_raw, employee_email_raw, board_group, synced_at FROM monday_requests WHERE employee_id IS NULL AND deleted_on_monday = false
UNION ALL
SELECT 'attendance_forms', monday_item_id, employee_name_raw, employee_email_raw, board_group, synced_at FROM monday_attendance_forms WHERE employee_id IS NULL AND deleted_on_monday = false
UNION ALL
SELECT 'contracts', monday_item_id, employee_name_raw, employee_email_raw, board_group, synced_at FROM monday_contracts WHERE employee_id IS NULL AND deleted_on_monday = false
ORDER BY employee_name_raw, source
```

## UnmatchedList.tsx
- Groups rows by `employee_name_raw` (+ email). Each group shows the name, email, which boards it appears on, and a row count.
- Inline control per group: an employee combobox (from `loadAllEmployees`, active first) and an **Add alias** button. On click: call the existing `saveNameAlias` action with `alias_text = employee_name_raw` and the chosen `employee_id` (use the same param names `saveNameAlias` already takes — read `src/actions/saveNameAlias.ts`), then show "Alias saved — press Sync now on the affected board(s) to re-match" and remove the group from the list. Do not try to update the mirror rows directly.
- Empty state: "Everything on the boards matches an employee."

Acceptance:
- After a Directory sync, the reconciliation table lists every active employee and the mismatch count is plausible (spot-check two ⚠️ cells against Monday).
- The Unmatched list shows the same total as the sum of the three cards' unmatched counts.
- Adding an alias for one unmatched name and re-syncing that board reduces the unmatched count by that name's row count and the rows now have `employee_id` set (`SELECT count(*) FROM monday_requests WHERE employee_id IS NULL`).
- Only the files named above changed.
````

- [ ] **Step 2: LOOP** — Expected files: two actions, two components, `MondayTab.tsx`. Tests: 80 pass. Browser (mandatory): counts match; add one alias for a real unmatched name (owner picks), re-sync, confirm.

- [ ] **Step 3: Commit**

```bash
git add src/app src/actions docs/superpowers/prompts/2026-08-18-pto/09-reconciliation-unmatched.md
git commit -m "sync: directory reconciliation table and unmatched list with inline alias creation"
```

---

### Task 10: Aliases tab

**Files:**
- Create (via UIB): `src/app/pages/admin/employees/AliasesTab.tsx`
- Modify (via UIB): `src/app/pages/admin/AdminEmployeesHub.tsx` (import `AliasesTab`)
- Create: `docs/superpowers/prompts/2026-08-18-pto/10-aliases-tab.md`

**Interfaces:**
- Consumes: `loadNameAliasesAdmin`, `deleteNameAlias`, `saveNameAlias`, `loadAllEmployees` (as `AdminAliases.tsx` uses them).

- [ ] **Step 1: Save and paste the prompt**

````markdown
Add the Aliases tab to the Employees hub by moving the current Admin → Name Aliases page into a tab component.

Files that may be created: `src/app/pages/admin/employees/AliasesTab.tsx`.
Files that may be modified: `src/app/pages/admin/AdminEmployeesHub.tsx` (only to import and render `AliasesTab` for `?tab=aliases`).
No other file may change. Do NOT modify or delete `AdminAliases.tsx` yet.

`AliasesTab.tsx` reproduces `src/app/pages/admin/AdminAliases.tsx` as-is: the alias list with employee names, search, add-alias form, delete — using the same actions `loadNameAliasesAdmin`, `deleteNameAlias`, `saveNameAlias`, `loadAllEmployees` with the same params.

Acceptance: `/admin/employees-hub?tab=aliases` shows the same alias count as `/admin/aliases`; adding an alias on the new tab shows on the old page after reload (then delete it from either). Only the two files named changed.
````

- [ ] **Step 2: LOOP** — Expected files: `AliasesTab.tsx`, `AdminEmployeesHub.tsx`. Tests: 80 pass. Browser: alias count equal on both pages; add + delete a throwaway alias.

- [ ] **Step 3: Commit**

```bash
git add src/app docs/superpowers/prompts/2026-08-18-pto/10-aliases-tab.md
git commit -m "sync: Aliases tab on the Employees hub (old page still live)"
```

---

### Task 11: Delete the three old admin pages; move the hub to `/admin/employees`; guard against hardcoded IDs

**Files:**
- Delete (via UIB): `src/app/pages/admin/AdminEmployees.tsx`, `src/app/pages/admin/AdminEmployeeSync.tsx`, `src/app/pages/admin/AdminAliases.tsx`, `src/actions/loadEmployeeDirectory.ts`, `src/actions/fetchMondayStartDates.ts`
- Modify (via UIB): `src/app/app.tsx`, `src/app/TopNav.tsx`
- Modify (local): `tests/hardcoding.test.ts`
- Create: `docs/superpowers/prompts/2026-08-18-pto/11-delete-old-admin-pages.md`

**Interfaces:**
- Consumes: everything from Tasks 6–10 verified in the browser.

- [ ] **Step 1: Write the failing test first — append to `tests/hardcoding.test.ts`**

```ts
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// Monday board ids are 10-11 digit integers; column ids look like text_mkzj84w1 /
// color_mkyjv6et / date_rangeye9vcz9z / single_selectogxov2i / email_mkzjqdh7.
const BOARD_ID = /\b(?:8592460836|8661565945|9542698245|18394647909|18394590373)\b/;
const COLUMN_ID = /\b(?:text|color|date|date_range|single_select|email|status|numbers|numeric|people|long_text)_?[a-z0-9]{6,12}\b/;

test('H4: no Monday board or column id is hardcoded in the mirror/PTO/admin-hub code', () => {
  const files = [
    ...walk('src/app/pages/admin/employees'),
    ...walk('src/app/pages/pto'),
    'src/app/pages/admin/AdminEmployeesHub.tsx',
    'src/app/pages/PtoTracker.tsx',
    ...walk('src/actions').filter(f => /Monday|Pto|FloatingHoliday|Reconciliation|Unmatched/.test(f)),
  ].filter(existsSync);
  assert.ok(files.length > 0, 'expected the new files to exist');
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!BOARD_ID.test(src), `${f} contains a literal Monday board id`);
    assert.ok(!COLUMN_ID.test(src), `${f} contains a literal Monday column id`);
  }
});

test('H5: the three legacy admin pages and their hardcoded-ID actions are gone', () => {
  for (const f of [
    'src/app/pages/admin/AdminEmployees.tsx',
    'src/app/pages/admin/AdminEmployeeSync.tsx',
    'src/app/pages/admin/AdminAliases.tsx',
    'src/actions/loadEmployeeDirectory.ts',
    'src/actions/fetchMondayStartDates.ts',
  ]) assert.ok(!existsSync(f), `${f} should have been deleted`);
});
```

Run: `node --test "tests/hardcoding.test.ts"`. Expected: H4 passes (new files clean), **H5 fails** (files still exist).

- [ ] **Step 2: Save and paste the prompt**

````markdown
The new Employees hub has been verified against the three pages it replaces. Remove the old pages and give the hub their route. This is a deletion-only change plus route/nav edits.

Delete exactly these files: `src/app/pages/admin/AdminEmployees.tsx`, `src/app/pages/admin/AdminEmployeeSync.tsx`, `src/app/pages/admin/AdminAliases.tsx`, `src/actions/loadEmployeeDirectory.ts`, `src/actions/fetchMondayStartDates.ts`.
Modify only: `src/app/app.tsx` and `src/app/TopNav.tsx`.
No other file may change. Do NOT modify `AdminLayout.tsx`, `ProcessPayroll.tsx`, `pullMondayBoard.ts` or any file under `src/app/pages/admin/employees/`.

app.tsx: remove the imports of the three deleted pages; change the hub route from `employees-hub` to `employees`; remove the `aliases` and `directory-sync` routes; add redirects `aliases` → `/admin/employees?tab=aliases` and `directory-sync` → `/admin/employees?tab=monday` (Navigate replace) so old bookmarks still land somewhere. Keep the `index` redirect to `/admin/employees`.
TopNav.tsx: in the Admin section, remove the "Employees (new)", "Directory Sync" and "Name Aliases" links; the "Employees" link now points to `/admin/employees` (unchanged path) with the Users icon.

Acceptance: `/admin/employees` opens the hub on Roster; `/admin/aliases` redirects to the Aliases tab; `/admin/directory-sync` redirects to the Monday tab; the app builds with no missing-import errors; nothing else changed.
````

- [ ] **Step 3: LOOP** — Expected files: five deletions, `app.tsx`, `TopNav.tsx`. Tests: `node --test "tests/*.test.ts"` → **82 pass** (H4, H5 added). Browser: all three routes; run Directory sync once more from the hub (proves nothing depended on the deleted actions).

- [ ] **Step 4: Update `docs/BACKLOG.md`** — item 3: `✅ FIXED (phase 2) <commit>`; item 9 table: `AdminEmployeeSync.tsx` row → "removed; replaced by `admin/employees/*` components ≤ 15 KB". Update `docs/CHANGE-LOOP.md` high-blast-radius table the same way.

- [ ] **Step 5: Commit**

```bash
git add -A src/app src/actions tests/hardcoding.test.ts docs
git commit -m "sync: remove legacy Employees/Directory Sync/Aliases pages; hub owns /admin/employees; H4/H5 tests"
```

---

### Task 12: People nav + `/pto` Balances tab

**Files:**
- Create (via UIB): `src/actions/loadPtoBalancesInputs.ts`, `src/actions/upsertPtoEmployee.ts`, `src/app/pages/PtoTracker.tsx`, `src/app/pages/pto/BalancesTab.tsx`
- Modify (via UIB): `src/app/app.tsx`, `src/app/TopNav.tsx`, `src/app/FilterBar.tsx`
- Create: `docs/superpowers/prompts/2026-08-18-pto/12-pto-balances.md`

**Interfaces:**
- Consumes: `accruedPto`, `takenPto`, `fhEligibleDate`, `fhRemaining` from `ptoAccrual.ts`; `GlobalFilterContext` (employee/role/manager filters); `xlsx` for export.
- Produces: `loadPtoBalancesInputs({ manager })` rows: `{ employee_id, display_name, role, manager, start_date, pto_start_date_override, paid_pto_days, taken_days, pending_count, fh_allocated, fh_used, wfh_days, birthday_days, tft_hours }`; `upsertPtoEmployee({ employee_id, paid_pto_days, pto_start_date_override })`. `PtoTracker` renders tabs `balances | approvals | floating` from `?tab=`.

- [ ] **Step 1: Save and paste the prompt**

````markdown
Add a new top-level section "People" with one page, the PTO Tracker, and build its first tab: Balances. The math must come from `src/app/lib/ptoAccrual.ts` — do not reimplement any formula in the page.

Files that may be created: `src/actions/loadPtoBalancesInputs.ts`, `src/actions/upsertPtoEmployee.ts`, `src/app/pages/PtoTracker.tsx`, `src/app/pages/pto/BalancesTab.tsx`.
Files that may be modified, minimally: `src/app/app.tsx` (one route `/pto`), `src/app/TopNav.tsx` (new section), `src/app/FilterBar.tsx` (one `ROUTE_CONFIG` entry).
No other file may change. Do NOT modify `ptoAccrual.ts`, `classificationEngine.ts`, or any payroll page.

## TopNav.tsx
Add a fourth section after Attendance, before Admin: label `People`, its own colour (pick one not used by the other three), sub-links: `{ to: '/pto', label: 'PTO Tracker', icon: Palmtree }` (any fitting lucide icon).

## FilterBar.tsx
Add `'/pto': { employee: true, role: true, manager: true }` to `ROUTE_CONFIG`.

## loadPtoBalancesInputs (SQL, `GAF Planilla DB`, param `manager` optional)
```sql
SELECT e.id AS employee_id, e.display_name, e.role, e.manager, e.start_date::text AS start_date,
       pe.pto_start_date_override::text AS pto_start_date_override,
       COALESCE(pe.paid_pto_days, 0) AS paid_pto_days,
       COALESCE((SELECT SUM(total_days) FROM pto_approvals a WHERE a.employee_id = e.id AND a.status = 'recorded'), 0) AS taken_days,
       (SELECT count(*) FROM monday_requests r LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
         WHERE r.employee_id = e.id AND r.request_type = 'PTO / Vacation' AND r.deleted_on_monday = false AND a.id IS NULL) AS pending_count,
       COALESCE(fh.fh_allocated, 2) AS fh_allocated, COALESCE(fh.fh_used, 0) AS fh_used,
       (SELECT COALESCE(SUM(GREATEST(1, COALESCE(total_days_requested, 1))),0) FROM monday_requests r WHERE r.employee_id = e.id AND r.request_type = 'Work From Home' AND r.deleted_on_monday = false AND EXTRACT(YEAR FROM r.start_date) = {{params.year}}) AS wfh_days,
       (SELECT count(*) FROM monday_requests r WHERE r.employee_id = e.id AND r.request_type = 'Birthday Day Off' AND r.deleted_on_monday = false AND EXTRACT(YEAR FROM r.start_date) = {{params.year}}) AS birthday_days,
       (SELECT COALESCE(SUM(hours_approved),0) FROM monday_requests r WHERE r.employee_id = e.id AND r.permission_type = 'Time for Time' AND r.deleted_on_monday = false AND EXTRACT(YEAR FROM COALESCE(r.start_date, r.submitted_at::date)) = {{params.year}}) AS tft_hours
FROM employees e
LEFT JOIN pto_employees pe ON pe.employee_id = e.id
LEFT JOIN pto_floating_holidays fh ON fh.employee_id = e.id AND fh.calendar_year = {{params.year}}
WHERE e.active = true
  AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
ORDER BY e.display_name
```
Params: `year` (number, the "as of" year), `manager` (string or null).

## upsertPtoEmployee (SQL)
```sql
INSERT INTO pto_employees (employee_id, paid_pto_days, pto_start_date_override)
VALUES ({{params.employee_id}}, {{params.paid_pto_days}}, NULLIF({{params.pto_start_date_override}}, '')::date)
ON CONFLICT (employee_id) DO UPDATE SET paid_pto_days = EXCLUDED.paid_pto_days, pto_start_date_override = EXCLUDED.pto_start_date_override, updated_at = NOW()
```

## PtoTracker.tsx
Route `/pto`. Header "PTO Tracker". Tab strip Balances · Approvals · Floating Holidays driven by `?tab=` (default balances) like the Employees hub. Renders `<BalancesTab />`; the other two tabs render a "Coming next" card for now. Keep under 8 KB.

## pto/BalancesTab.tsx
- Top-right: an **As of** date input (default today, `YYYY-MM-DD` string; never converted), an **Export to Excel** button, and the count line.
- Loads `loadPtoBalancesInputs({ year: asOf.slice(0,4), manager: <manager filter from GlobalFilterContext or null> })`. Applies the employee/role filters from `GlobalFilterContext` client-side.
- For each row: `start = pto_start_date_override ?? start_date`; if empty → show "—" in Accrued/Available with a ⚠️ "no start date" tooltip and skip math. Otherwise `accrued = accruedPto(start, asOf)`, `taken = Number(taken_days)`, `available = accrued − taken`, `fhRemaining(fh_allocated, fh_used)`, `fhEligible = fhEligibleDate(start) <= asOf`.
- Columns: Employee · Title (role) · Start · Accrued (2 dp) · Taken · **Available** (2 dp, red text if < 0) · Paid PTO (inline number input, saves via `upsertPtoEmployee` on blur, then reloads) · FH remaining (grey if not yet eligible, with the eligible date in the tooltip) · WFH days · Birthday off · TFT hours · Pending (⏳ badge with `pending_count` when > 0, links to `/pto?tab=approvals&employee=<id>`).
- Hint: if `start` is at least 6 months before `asOf` (i.e. `days360(start, asOf) >= 180`) and `paid_pto_days = 0`, show a small amber dot on the Paid PTO cell with tooltip "6 months reached — CSS advance not recorded". Import `days360` from ptoAccrual for this.
- Sortable by Employee, Available, Start. Export writes the visible rows to an `.xlsx` with the same column headers as the sheet: Employee, Title, Start Date, Accumulated PTO, Available PTO, Taken PTO, Paid PTO.
- States: loading spinner, error banner (message + retry), empty ("No active employees match the filters"), data.

Acceptance:
- `/pto` shows one row per active employee. For Timothy Moore with As of = 2026-08-11 the Accrued cell reads 42.73 (start 2025-04-21). Changing Paid PTO to 15 for one employee and reloading persists (`SELECT * FROM pto_employees`).
- Only the files named above changed.
````

- [ ] **Step 2: LOOP** — Expected files: two actions, `PtoTracker.tsx`, `pto/BalancesTab.tsx`, `app.tsx`, `TopNav.tsx`, `FilterBar.tsx`. Tests: 82 pass. Browser (mandatory): the Timothy Moore check with As of 2026-08-11 → 42.73; set/unset Paid PTO on one row.

- [ ] **Step 3: Commit**

```bash
git add src/app src/actions docs/superpowers/prompts/2026-08-18-pto/12-pto-balances.md
git commit -m "sync: People section and PTO Tracker Balances tab (accrual via ptoAccrual, inline Paid PTO)"
```

---

### Task 13: Approvals log — Pending from Monday, Record dialog, ledger table

**Files:**
- Create (via UIB): `src/actions/loadPendingPtoRequests.ts`, `src/actions/loadPtoApprovals.ts`, `src/actions/upsertPtoApproval.ts`, `src/actions/updatePtoApprovalStatus.ts`, `src/app/pages/pto/ApprovalsTab.tsx`, `src/app/pages/pto/RecordApprovalDialog.tsx`
- Modify (via UIB): `src/app/pages/PtoTracker.tsx` (import `ApprovalsTab`)
- Create: `docs/superpowers/prompts/2026-08-18-pto/13-pto-approvals.md`

**Interfaces:**
- Consumes: `defaultTotalDays` from `ptoAccrual.ts`; `loadAllEmployees`.
- Produces: `loadPendingPtoRequests({ manager })` rows `{ monday_item_id, employee_id, display_name, employee_name_raw, start_date, end_date, return_date, total_days_requested, details, submitted_at }`; `loadPtoApprovals({ employee_id, status, manager })` rows `{ id, employee_id, display_name, leave_on, return_on, total_days, status, source, gaf_comments, monday_item_id, recorded_by, recorded_at }`; `upsertPtoApproval({ id, employee_id, leave_on, return_on, total_days, status, source, gaf_comments, monday_item_id, recorded_by })`; `updatePtoApprovalStatus({ id, status })`.

- [ ] **Step 1: Save and paste the prompt**

````markdown
Build the Approvals tab of the PTO Tracker: pending Monday submissions at the top, the ledger below, and a Record dialog. `pto_approvals` is the ledger; Monday rows are suggestions until Tim records them.

Files that may be created: `src/actions/loadPendingPtoRequests.ts`, `src/actions/loadPtoApprovals.ts`, `src/actions/upsertPtoApproval.ts`, `src/actions/updatePtoApprovalStatus.ts`, `src/app/pages/pto/ApprovalsTab.tsx`, `src/app/pages/pto/RecordApprovalDialog.tsx`.
Files that may be modified: `src/app/pages/PtoTracker.tsx` (render `ApprovalsTab` for `?tab=approvals`).
No other file may change.

## SQL actions (`GAF Planilla DB`)
`loadPendingPtoRequests` (param `manager` optional):
```sql
SELECT r.monday_item_id, r.employee_id, e.display_name, r.employee_name_raw, r.start_date::text AS start_date, r.end_date::text AS end_date, r.return_date::text AS return_date, r.total_days_requested, r.details, r.submitted_at
FROM monday_requests r
LEFT JOIN employees e ON e.id = r.employee_id
LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
WHERE r.request_type = 'PTO / Vacation' AND r.deleted_on_monday = false AND a.id IS NULL
  AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
ORDER BY r.start_date DESC NULLS LAST
```
`loadPtoApprovals` (params `employee_id`, `status`, `manager`, all optional):
```sql
SELECT a.id, a.employee_id, e.display_name, a.leave_on::text AS leave_on, a.return_on::text AS return_on, a.total_days, a.status, a.source, a.gaf_comments, a.monday_item_id, a.recorded_by, a.recorded_at
FROM pto_approvals a JOIN employees e ON e.id = a.employee_id
WHERE ({{params.employee_id}} IS NULL OR a.employee_id = {{params.employee_id}})
  AND ({{params.status}} IS NULL OR {{params.status}} = '' OR a.status = {{params.status}})
  AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
ORDER BY a.leave_on DESC, a.id DESC
```
`upsertPtoApproval`:
```sql
INSERT INTO pto_approvals (id, employee_id, leave_on, return_on, total_days, status, source, gaf_comments, monday_item_id, recorded_by, recorded_at)
VALUES (COALESCE({{params.id}}, nextval(pg_get_serial_sequence('pto_approvals','id'))), {{params.employee_id}}, {{params.leave_on}}::date, {{params.return_on}}::date, {{params.total_days}}, {{params.status}}, {{params.source}}, {{params.gaf_comments}}, {{params.monday_item_id}}, {{params.recorded_by}}, CASE WHEN {{params.status}} = 'recorded' THEN NOW() ELSE NULL END)
ON CONFLICT (id) DO UPDATE SET employee_id = EXCLUDED.employee_id, leave_on = EXCLUDED.leave_on, return_on = EXCLUDED.return_on, total_days = EXCLUDED.total_days, status = EXCLUDED.status, source = EXCLUDED.source, gaf_comments = EXCLUDED.gaf_comments, monday_item_id = EXCLUDED.monday_item_id, recorded_by = EXCLUDED.recorded_by, recorded_at = COALESCE(pto_approvals.recorded_at, EXCLUDED.recorded_at), updated_at = NOW()
```
If `pto_approvals.id` is `GENERATED ALWAYS AS IDENTITY` and the INSERT rejects an explicit id, use `OVERRIDING SYSTEM VALUE` after the column list.
`updatePtoApprovalStatus`: `UPDATE pto_approvals SET status = {{params.status}}, updated_at = NOW() WHERE id = {{params.id}}`.

## pto/ApprovalsTab.tsx
- **Pending from Monday** panel (collapsible, open when count > 0): rows from `loadPendingPtoRequests`. Columns: Employee (display_name, or the raw name in amber with "unmatched — add an alias on Admin → Employees → Monday" if `employee_id` is null), Requested (start–end), Return, Days requested, Details, Submitted, and two buttons: **Record** (opens the dialog prefilled; disabled when unmatched) and **Dismiss** (calls `upsertPtoApproval` with `status='withdrawn'`, `source='monday'`, `total_days = 0`, the request's dates and `monday_item_id`, `gaf_comments = 'Dismissed from pending'`).
- **Ledger** table from `loadPtoApprovals`: filters — employee (from `GlobalFilterContext` employee filter or a local combobox), status chips All / Recorded / Pending / Withdrawn. Columns: Employee · Leave on · Return on · Total days · Status chip · Source chip (Monday / Excel / Manual) · GAF comments · Recorded by/at · actions **Edit** (opens the dialog with the row) and **Withdraw** (`updatePtoApprovalStatus` to `withdrawn`, with confirm). Button **Add manually** opens the dialog empty with `source='manual'`.
- After any save: reload both lists.

## pto/RecordApprovalDialog.tsx
- Props: `open`, `onClose`, `onSaved`, `initial` (partial row: employee_id, leave_on, return_on, total_days, gaf_comments, monday_item_id, source, id).
- Fields: Employee (combobox from `loadAllEmployees`, locked when opened from a Monday row), Leave on (date input, string), Return on (date input), Total days (number, default `defaultTotalDays(leave_on, return_on)` from `src/app/lib/ptoAccrual.ts` whenever either date changes and the field has not been hand-edited; step 0.5), GAF comments (textarea), Recorded by (text, remembers the last value in localStorage). Save calls `upsertPtoApproval` with `status='recorded'`, the given `source`, and `monday_item_id` when present.
- Validation: return_on ≥ leave_on; total_days ≥ 0; employee required.

Acceptance:
- Pending panel count equals `SELECT count(*) FROM monday_requests r LEFT JOIN pto_approvals a ON a.monday_item_id=r.monday_item_id WHERE r.request_type='PTO / Vacation' AND r.deleted_on_monday=false AND a.id IS NULL`.
- Recording one pending request removes it from the panel, adds a `recorded` ledger row with `source='monday'` and its `monday_item_id`, and the employee's Taken on the Balances tab increases by its total days.
- Add manually / Edit / Withdraw round-trip; a withdrawn row no longer counts toward Taken.
- Only the files named above changed.
````

- [ ] **Step 2: LOOP** — Expected files: four actions, two components, `PtoTracker.tsx`. Tests: 82 pass. Browser (mandatory): record one real pending request that Tim confirms; verify Taken moves; add/withdraw a manual test row and delete it via SQL afterwards if the owner prefers (`DELETE FROM pto_approvals WHERE id = <id>`).

- [ ] **Step 3: Commit**

```bash
git add src/app src/actions docs/superpowers/prompts/2026-08-18-pto/13-pto-approvals.md
git commit -m "sync: PTO Approvals tab — pending Monday requests, Record dialog, ledger with edit/withdraw"
```

---

### Task 14: Floating Holidays tab

**Files:**
- Create (via UIB): `src/actions/loadFloatingHolidays.ts`, `src/actions/upsertFloatingHoliday.ts`, `src/app/pages/pto/FloatingHolidaysTab.tsx`
- Modify (via UIB): `src/app/pages/PtoTracker.tsx`
- Create: `docs/superpowers/prompts/2026-08-18-pto/14-pto-floating.md`

**Interfaces:**
- Consumes: `fhEligibleDate`, `fhRemaining` from `ptoAccrual.ts`.
- Produces: `loadFloatingHolidays({ year, manager })` rows `{ employee_id, display_name, role, start_date, pto_start_date_override, fh_allocated, fh_used, notes, fh_requests }`; `upsertFloatingHoliday({ employee_id, calendar_year, fh_allocated, fh_used, notes })`.

- [ ] **Step 1: Save and paste the prompt**

````markdown
Build the Floating Holidays tab of the PTO Tracker.

Files that may be created: `src/actions/loadFloatingHolidays.ts`, `src/actions/upsertFloatingHoliday.ts`, `src/app/pages/pto/FloatingHolidaysTab.tsx`.
Files that may be modified: `src/app/pages/PtoTracker.tsx` (render `FloatingHolidaysTab` for `?tab=floating`).
No other file may change.

`loadFloatingHolidays` (params `year`, `manager` optional):
```sql
SELECT e.id AS employee_id, e.display_name, e.role, e.start_date::text AS start_date, pe.pto_start_date_override::text AS pto_start_date_override,
       COALESCE(fh.fh_allocated, 2) AS fh_allocated, COALESCE(fh.fh_used, 0) AS fh_used, fh.notes,
       (SELECT count(*) FROM monday_requests r WHERE r.employee_id = e.id AND r.request_type = 'Floating Holiday' AND r.deleted_on_monday = false AND EXTRACT(YEAR FROM r.start_date) = {{params.year}}) AS fh_requests
FROM employees e
LEFT JOIN pto_employees pe ON pe.employee_id = e.id
LEFT JOIN pto_floating_holidays fh ON fh.employee_id = e.id AND fh.calendar_year = {{params.year}}
WHERE e.active = true AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
ORDER BY e.display_name
```
`upsertFloatingHoliday`:
```sql
INSERT INTO pto_floating_holidays (employee_id, calendar_year, fh_allocated, fh_used, notes)
VALUES ({{params.employee_id}}, {{params.calendar_year}}, {{params.fh_allocated}}, {{params.fh_used}}, {{params.notes}})
ON CONFLICT (employee_id, calendar_year) DO UPDATE SET fh_allocated = EXCLUDED.fh_allocated, fh_used = EXCLUDED.fh_used, notes = EXCLUDED.notes, updated_at = NOW()
```

`FloatingHolidaysTab.tsx`: a Year selector (default the current year); a policy line "2 per calendar year · non-stacking · eligible 90 days after hire". Table: Employee · Title · Start · Eligible date (`fhEligibleDate(start)` from `src/app/lib/ptoAccrual.ts`, using `pto_start_date_override ?? start_date`) · Eligible? (✔ if eligible date ≤ today, else ⏳ "in N days") · Allocated · Used (inline number input, saves via `upsertFloatingHoliday` on blur then reloads) · Remaining (`fhRemaining`) · Requests on Monday this year (`fh_requests`, informational, with a tooltip "requests are not the ledger; Used is what Tim records") · Notes (inline text). Missing start → "—" with a warning. Loading/empty/error/data states.

Acceptance: `/pto?tab=floating` lists active employees; setting Used to 1 for one row persists (`SELECT * FROM pto_floating_holidays WHERE calendar_year = <year>`); Remaining shows 1. Only the files named changed.
````

- [ ] **Step 2: LOOP** — Expected files: two actions, one component, `PtoTracker.tsx`. Tests: 82 pass. Browser (mandatory): set/unset Used on one row.

- [ ] **Step 3: Commit**

```bash
git add src/app src/actions docs/superpowers/prompts/2026-08-18-pto/14-pto-floating.md
git commit -m "sync: PTO Floating Holidays tab (eligibility, manual Used, remaining)"
```

---

### Task 15: Migration 4 — seed the ledger from the Excel tracker, then reconcile

**Files:**
- Create (local): `tools/pto-seed-from-xlsx.mjs`
- Create (via UIB): `src/migrations/<ts>_seed_pto_from_excel.sql`; `applied.txt`
- Create: `docs/superpowers/prompts/2026-08-18-pto/15-migration-seed-excel.md`, `docs/findings/2026-08-18-pto-seed-reconciliation.md`

**Interfaces:**
- Consumes: the workbook `C:\Users\SaulFallembaum\OneDrive - Passion To Care\Documents\HR\PTO AND PERMISSIONS\PTO TRACKING GAF NEW.xlsx` (sheets `PTO-Balance` cols A Employee, B Title, C Start Date, G Paid PTO; `PTO Approvals` cols A Employee, D Leave On, E Return On, F Total Days, G GAF Comments; `Floating Holidays` cols A Employee, G FH Used); tables from Task 5.
- Produces: SQL that inserts `pto_approvals` rows (`source='excel_import'`, `status='recorded'`), `pto_employees` rows (`paid_pto_days`, override where the sheet's start date ≠ `employees.start_date`), and current-year `pto_floating_holidays` rows.

- [ ] **Step 1: Write `tools/pto-seed-from-xlsx.mjs`**

The workbook is a zip; extract it first (PowerShell: `Expand-Archive "<xlsx>" "<dir>" -Force`), then run this over the extracted directory. It resolves employees **by name only** and emits SQL that looks up ids at apply time, so no employee id is hardcoded and unknown names fail loudly.

```js
// Generates the seed_pto_from_excel migration from an extracted PTO workbook.
// Usage: node tools/pto-seed-from-xlsx.mjs <extracted-xlsx-dir> > out.sql
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/pto-seed-from-xlsx.mjs <extracted-xlsx-dir>'); process.exit(1); }
const dec = s => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
const shared = existsSync(join(dir,'xl/sharedStrings.xml'))
  ? [...readFileSync(join(dir,'xl/sharedStrings.xml'),'utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)]
      .map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t=>t[1]).join('')))
  : [];
const wb = readFileSync(join(dir,'xl/workbook.xml'),'utf8');
const rels = readFileSync(join(dir,'xl/_rels/workbook.xml.rels'),'utf8');
const relMap = {};
for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
  const id = (m[0].match(/Id="([^"]+)"/)||[])[1], t = (m[0].match(/Target="([^"]+)"/)||[])[1];
  if (id && t) relMap[id] = t;
}
const sheets = {};
for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
  const name = dec((m[0].match(/name="([^"]+)"/)||[])[1]||''), rid = (m[0].match(/r:id="([^"]+)"/)||[])[1];
  sheets[name] = join(dir,'xl',relMap[rid].replace(/^\/xl\//,''));
}
function rows(sheetName) {
  const xml = readFileSync(sheets[sheetName],'utf8');
  return [...xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map(r => {
    const cells = {};
    for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const t = (c[2].match(/t="([^"]+)"/)||[])[1]; let v = (c[3]||'').match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (t==='s' && v!==undefined) v = shared[Number(v)];
      if (t==='inlineStr') v = dec([...(c[3]||'').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join(''));
      if (v!==undefined) cells[c[1]] = v;
    }
    return { n: Number(r[1]), cells };
  });
}
// Excel serial → YYYY-MM-DD (1900 date system). Text dates pass through.
function toISO(v) {
  if (v === undefined || v === '') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
  const n = Number(v); if (!Number.isFinite(n)) return null;
  const ms = Math.round((n - 25569) * 86400000); return new Date(ms).toISOString().slice(0,10);
}
const q = s => "'" + String(s).replace(/'/g,"''") + "'";
const nameSql = name => `(SELECT id FROM employees WHERE lower(unaccent(display_name)) = lower(unaccent(${q(name)})) LIMIT 1)`;

const out = [];
out.push('-- Generated by tools/pto-seed-from-xlsx.mjs from PTO TRACKING GAF NEW.xlsx.');
out.push('-- Employees are matched by name at apply time; unknown names raise. Review before applying.');
out.push("CREATE EXTENSION IF NOT EXISTS unaccent;");
out.push('DO $$ DECLARE missing text; BEGIN');
const names = new Set();
for (const s of ['PTO-Balance','PTO Approvals','Floating Holidays']) for (const r of rows(s)) if (r.n>=4 && r.cells.A) names.add(r.cells.A.trim());
out.push(`  SELECT string_agg(n, ', ') INTO missing FROM unnest(ARRAY[${[...names].map(q).join(',')}]) AS n WHERE NOT EXISTS (SELECT 1 FROM employees WHERE lower(unaccent(display_name)) = lower(unaccent(n)));`);
out.push("  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Unknown employees in sheet: %', missing; END IF;");
out.push('END $$;');

out.push('\n-- PTO-Balance: paid PTO and start-date overrides');
for (const r of rows('PTO-Balance')) {
  if (r.n < 4 || !r.cells.A) continue;
  const name = r.cells.A.trim(), start = toISO(r.cells.C), paid = Number(r.cells.G||0)||0;
  out.push(`INSERT INTO pto_employees (employee_id, paid_pto_days, pto_start_date_override) VALUES (${nameSql(name)}, ${paid}, CASE WHEN (SELECT start_date FROM employees WHERE id = ${nameSql(name)}) IS DISTINCT FROM ${start?q(start)+'::date':'NULL'} THEN ${start?q(start)+'::date':'NULL'} ELSE NULL END) ON CONFLICT (employee_id) DO UPDATE SET paid_pto_days = EXCLUDED.paid_pto_days, pto_start_date_override = EXCLUDED.pto_start_date_override;`);
}
out.push('\n-- PTO Approvals: the historical ledger');
for (const r of rows('PTO Approvals')) {
  if (r.n < 4 || !r.cells.A || !r.cells.D) continue;
  const name = r.cells.A.trim(), leave = toISO(r.cells.D), ret = toISO(r.cells.E), days = Number(r.cells.F||0)||0, cmt = r.cells.G ? q(r.cells.G) : 'NULL';
  out.push(`INSERT INTO pto_approvals (employee_id, leave_on, return_on, total_days, status, source, gaf_comments, recorded_by, recorded_at) VALUES (${nameSql(name)}, ${q(leave)}::date, ${q(ret)}::date, ${days}, 'recorded', 'excel_import', ${cmt}, 'excel import', NOW());`);
}
const year = new Date().getUTCFullYear();
out.push(`\n-- Floating Holidays used, calendar year ${year}`);
for (const r of rows('Floating Holidays')) {
  if (r.n < 4 || !r.cells.A) continue;
  const name = r.cells.A.trim(), used = Number(r.cells.G||0)||0;
  out.push(`INSERT INTO pto_floating_holidays (employee_id, calendar_year, fh_allocated, fh_used) VALUES (${nameSql(name)}, ${year}, 2, ${used}) ON CONFLICT (employee_id, calendar_year) DO UPDATE SET fh_used = EXCLUDED.fh_used;`);
}
console.log(out.join('\n'));
```

- [ ] **Step 2: Generate and review**

```powershell
$x = "C:\Users\SaulFallembaum\OneDrive - Passion To Care\Documents\HR\PTO AND PERMISSIONS\PTO TRACKING GAF NEW.xlsx"
$d = "$env:TEMP\pto-xlsx"; Copy-Item $x "$env:TEMP\pto.zip" -Force; Expand-Archive "$env:TEMP\pto.zip" $d -Force
node tools/pto-seed-from-xlsx.mjs $d > "$env:TEMP\seed_pto_from_excel.sql"
```
Open the SQL with the owner. Expected: ~46 `pto_employees` rows, ~60 `pto_approvals` rows, ~54 `pto_floating_holidays` rows. Names in the sheet that are not in `employees` (the guard block will name them, e.g. people who left) — resolve with the owner: add the employee as inactive, or delete those lines from the SQL and list them in the findings doc.

Note: employees whose sheet row has no Start Date get `pto_start_date_override = NULL`; the page then uses `employees.start_date`.

- [ ] **Step 3: Save and paste the prompt** — "Create and apply a migration named `seed_pto_from_excel` against `GAF Planilla DB` with exactly the SQL below. Do not change any other file." followed by the reviewed SQL.

- [ ] **Step 4: Verify** — in the Database tab: `SELECT count(*), source FROM pto_approvals GROUP BY source;`, `SELECT count(*) FROM pto_employees WHERE paid_pto_days > 0;`, `SELECT count(*) FROM pto_floating_holidays;`. Then on `/pto` with **As of = 2026-08-11**: Timothy Moore Available = 27.73, Reggina Sandoval 14.27, Tanya Bedoya 5.45, Charles Bush 0.18 (the sheet's values). Record any difference and its cause in `docs/findings/2026-08-18-pto-seed-reconciliation.md` (rows only; no personal data beyond names already in the app).

- [ ] **Step 5: LOOP** — Expected files: new migration + `applied.txt`. Tests: 82 pass. Browser: the four Available values above.

- [ ] **Step 6: Commit**

```bash
git add tools/pto-seed-from-xlsx.mjs src/migrations docs/findings/2026-08-18-pto-seed-reconciliation.md docs/superpowers/prompts/2026-08-18-pto/15-migration-seed-excel.md
git commit -m "sync: seed the PTO ledger from the Excel tracker; balances reconcile to the sheet as of 2026-08-11"
```

---

### Task 16: `src/AGENTS.md`, docs, and wrap-up

**Files:**
- Modify (via UIB): `src/AGENTS.md`
- Modify (local): `docs/BACKLOG.md`, `docs/CHANGE-LOOP.md`, `docs/HOW-WE-WORK.md` (one paragraph on the biweekly PTO routine now being: Sync now → Record pending → done), `tests/agentsDoc.test.ts` if it asserts on sections
- Create: `docs/superpowers/prompts/2026-08-18-pto/16-agents-md.md`

- [ ] **Step 1: Check what `tests/agentsDoc.test.ts` asserts** (`grep -n "assert" tests/agentsDoc.test.ts`) so the AGENTS.md edit keeps it green; if it asserts the "Dead — do not build on these" heading exists, update the test to the new heading in the same commit.

- [ ] **Step 2: Save and paste the prompt**

````markdown
Update `src/AGENTS.md` only. No other file may change.

1. Schema → replace the section "### Dead — do not build on these" with "### PTO ledger — live since 2026-08-18": `pto_approvals` is the PTO ledger (status pending|recorded|withdrawn, source monday|excel_import|manual, monday_item_id links to monday_requests); `pto_employees` holds manual facts (paid_pto_days, pto_start_date_override); `pto_floating_holidays` per employee-year. Balances are computed in the browser by `src/app/lib/ptoAccrual.ts` (Excel DAYS360/11); SQL never computes them. Keep the paragraph warning that `pto_days`/`pto_dates`/`pto_count` in `loadHrkSummary.ts` are unrelated CTE aliases.
2. Schema → add "### Monday mirror": `monday_requests`, `monday_attendance_forms`, `monday_contracts` (keyed by monday_item_id, employee_id nullable = unmatched, raw jsonb, deleted_on_monday, never deleted) and `monday_sync_log`. Synced from Admin → Employees → Monday tab. Payroll's own per-period Monday pull in ProcessPayroll is separate and unchanged.
3. Monday.com integration → the config table: add `monday_board_onboarding` and the `monday_col_requests_*`, `monday_col_attendance_details|eta`, `monday_col_onboarding_*` keys. Remove the "Two current violations" subsection: `loadEmployeeDirectory.ts` and `AdminEmployeeSync.tsx` no longer exist; the Directory sync lives in `src/app/pages/admin/employees/MondayTab.tsx` and reads every ID from config. Add: "Resolution of board rows to employees is `buildResolver` in `src/app/lib/mondayResolve.ts` — use it, do not write another matcher."
4. File map → Routes: add `/pto` (`PtoTracker.tsx`, tabs balances/approvals/floating) under a new **People** section; Admin children: `employees` is now `AdminEmployeesHub.tsx` with tabs roster/monday/aliases (components under `pages/admin/employees/`); remove `aliases` and `directory-sync` (redirects only). Actions list: add the new load/upsert/update actions by name. Libs: add `ptoAccrual.ts`, `mondayResolve.ts`.
5. Hard constraints → add: "New pages/components stay under 15 KB; one component per tab."
````

- [ ] **Step 3: LOOP** — Expected files: `src/AGENTS.md`. Tests: `node --test "tests/*.test.ts"` → 82 pass (adjust `agentsDoc.test.ts` locally if it pinned the old heading; commit that with this).

- [ ] **Step 4: Local docs** — `docs/BACKLOG.md`: roadmap rows A, B, F → "✅ built <date>"; item 8 unchanged; item 9 table updated (Task 11). `docs/CHANGE-LOOP.md`: add a line under "Prompt rules": "Prompts are saved verbatim under `docs/superpowers/prompts/` before use." `docs/HOW-WE-WORK.md`: add the three-line PTO routine.

- [ ] **Step 5: Commit, then integrate**

```bash
git add src/AGENTS.md tests/agentsDoc.test.ts docs
git commit -m "docs: AGENTS.md knows the PTO ledger, Monday mirror and Employees hub; roadmap A/B/F built"
```

Then, per the project's one-branch rule, from the main checkout:

```powershell
cd "C:\Users\SaulFallembaum\Documents\GAF-Payroll-Processor"
git merge --ff-only claude/app-feature-expansion-08fa71
git push
git worktree remove ".claude/worktrees/app-feature-expansion-08fa71"
git branch -d claude/app-feature-expansion-08fa71
git worktree remove --force ".claude/worktrees/gaf-hr-hub-local-92331a"; git branch -D claude/gaf-hr-hub-local-92331a
```

Expected: `main` fast-forwards (no merge commit), push succeeds, `git worktree list` shows only the main checkout, `git branch` shows only `main`.

---

## Self-review against the spec

- §3.1 mirror tables → Task 3; §3.2 PTO tables → Task 5; §3.3 config keys → Task 4.
- §4.1–4.4 sync (config no-fallback, `pullMondayBoard` whole-query, pagination, resolver order, batched upsert, deleted flag, sync log, idempotent, payroll untouched) → Tasks 7–8; resolver lib → Tasks 1–2.
- §5 math → Tasks 1–2 (lib + tests), used in 12–14; Paid-PTO 6-month hint → Task 12; FH year row on first view → Task 14 (upsert on first edit; the row is *displayed* from COALESCE defaults before that — equivalent for the operator).
- §6.1 nav/FilterBar → Task 12; §6.2 three tabs → 12, 13, 14; §6.3 hub, strangler, deletion → 6–11 (temporary route `/admin/employees-hub`, then `/admin/employees` in Task 11 — a detail the spec left implicit).
- §7 actions → all named per task; `updateMondayDeleted` became three per-table actions (Task 8) because a table name cannot be a `{{params}}` value.
- §8 migrations 1–4 → Tasks 3, 4, 5, 15. §9 error rules → restated in every prompt. §10 tests → Tasks 1, 11 (H4/H5), 16. §11 order → preserved, with the two libs moved to the front so the sync can use `buildResolver`. §12 out of scope → nothing here builds C/D/E/G.
- Types: `MondayItem`, `MondaySyncCard` props, `loadPtoBalancesInputs` row shape, `upsertPtoApproval` params are each defined once and reused by name.
