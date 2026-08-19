# PTO Tracker v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the three-tab PTO tracker into one sortable table where each employee row expands into their pending Monday requests, recorded PTO ledger and floating holidays; fix the nav; give the PTO page, nav and filter bar a premium finish.

**Architecture:** UI Bakery owns the running app and database; `src/` is a read-only mirror of its export. Every app change is a **UIB prompt** pasted into UI Bakery's AI panel, then export → `node tools/sync-export.mjs` → diff → tests → browser check → commit (`docs/CHANGE-LOOP.md`). Pure sort/filter logic is written as exact code so node tests written *before* the prompt pass *after* it. New page built beside the old tabs, verified live, then the old tabs deleted (strangler).

**Tech Stack:** UIB vibe project (React 19, react-router-dom 6, Tailwind 3, shadcn-style primitives in `src/components/ui/`, `@uibakery/data` `useLoadAction`/`useMutateAction`, SheetJS), PostgreSQL (`GAF Planilla DB`), Node 24 `node:test`.

Spec: `docs/superpowers/specs/2026-08-19-pto-tracker-v2-design.md`.

## Global Constraints

- **`src/` is never hand-edited.** All app changes go through UIB prompts. Local hand-written files are limited to `tests/`, `tools/`, `docs/`.
- **One coherent change per prompt.** Every prompt names the files that may change and says no other file may be touched.
- **Never hardcode a Monday board, column or group id.** Tests H4/H5 enforce.
- **`{{params.x}}` is substituted as a whole value** — never inside a quoted string.
- **Timezone invariant:** dates are `YYYY-MM-DD` strings; compare as strings; never `new Date(str)` for date math; "today" is `toLocalYMD(new Date())`, never `toISOString().slice(0,10)`.
- **Do not touch:** `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, anything under `src/components/ui/`, any attendance or admin page, `ptoAccrual.ts`, `upsertPtoApproval.ts`, `updatePtoApproval.ts`.
- **Action naming:** `load*`, `upsert*`, `update*`; one action per file; SQL actions use `datasourceName: 'GAF Planilla DB'`; every new `load*` accepts optional `manager`.
- **Files under 15 KB each.**
- **Test command:** `node --test "tests/*.test.ts"`. Baseline: 83 passing.
- **Sync command (repo root):** `node tools/sync-export.mjs "C:/Users/SaulFallembaum/Downloads/GAF HR Hub.zip"`.
- **UIB operational rules:** agent textarea caps at 50,000 chars; "done" = textarea placeholder reads `Working on your request...` no longer; never press UIB's Fix button on transient errors; verify clipboard content before pasting if the owner may have copied something.
- **Browser check is mandatory** for any diff touching `src/actions/` or a page.
- Git: work on `claude/app-feature-expansion-08fa71`; at the end fast-forward `main` and push.

---

## The loop, once (referenced as **LOOP** in every UIB task)

1. Save the prompt to `docs/superpowers/prompts/2026-08-19-pto-v2/NN-*.md`, commit it. Paste it verbatim into UIB's AI panel. Wait until the textarea placeholder no longer reads `Working on your request...`.
2. Press **Export** in UIB. At repo root: `node tools/sync-export.mjs "C:/Users/SaulFallembaum/Downloads/GAF HR Hub.zip"` then `git status --short`.
3. Compare with the task's **Expected files**. Any extra file = collateral: revert in UIB, re-export, re-sync, re-prompt with the missing no-touch line.
4. `git diff` each expected file; confirm it matches the prompt; `wc -c` every touched `.tsx`/`.ts` stays < 15 360 bytes.
5. `node --test "tests/*.test.ts"` — all pass.
6. **Browser check** as the task specifies (use the `/dev/` URL of the app; wait 10 s and retry if the Chrome renderer times out on screenshot).
7. Commit with the task's message.

---

## File structure

**Local (hand-written):**
- `tests/ptoSort.test.ts` — sort/filter helpers (Task 1).
- `tests/hardcoding.test.ts` — H5 gains the five deleted PTO tab files (Task 8).
- `docs/superpowers/prompts/2026-08-19-pto-v2/20-…26-*.md` — each prompt on record.
- `docs/findings/2026-08-19-pto-v2/before-*.png`, `after-*.png`.

**Created in UIB (mirrored into `src/`):**
- `src/migrations/<ts>_link_excel_approvals_to_monday.sql` (Task 2)
- `src/app/lib/ptoSort.ts` (Task 3) — zero imports
- `src/actions/loadPtoEmployeeDetail.ts` (Task 3)
- `src/app/components/PageHeader.tsx`, `DataTable.tsx`, `StatusChip.tsx`, `EmptyState.tsx`, `InfoTip.tsx` (Task 4)
- `src/app/pages/pto/PtoTable.tsx`, `PtoRow.tsx` (Task 5), `PtoBreakdown.tsx` (Task 6)

**Modified in UIB:**
- `src/actions/loadPtoBalancesInputs.ts` (Task 3, drop `tft_hours`)
- `src/app/TopNav.tsx`, `src/app/FilterBar.tsx`, `src/index.css` (Task 4)
- `src/app/pages/PtoTracker.tsx` (Task 5)
- `src/app/pages/pto/RecordApprovalDialog.tsx` (Task 7)
- `src/AGENTS.md` (Task 8)

**Deleted (Task 8):** `src/app/pages/pto/BalancesTab.tsx`, `BalancesRow.tsx`, `ApprovalsTab.tsx`, `ApprovalRow.tsx`, `FloatingHolidaysTab.tsx`, `src/actions/loadPtoApprovals.ts`, `src/actions/loadFloatingHolidays.ts`.

---

### Task 1: Failing tests for the pure sort/filter helpers

**Files:**
- Create: `tests/ptoSort.test.ts`

**Interfaces:**
- Produces (implemented in Task 3 as `src/app/lib/ptoSort.ts`, zero imports):
  - `export type SortDir = 'asc' | 'desc' | null;`
  - `export function nextSortDir(current: SortDir): SortDir` — `null → 'asc' → 'desc' → null`.
  - `export function compareValues(a: unknown, b: unknown): number` — numbers numerically; strings case-insensitive with `localeCompare`; `null`/`undefined`/`''` always last regardless of direction.
  - `export function sortRows<T>(rows: T[], key: keyof T | null, dir: SortDir, fallbackKey: keyof T): T[]` — stable; when `key` or `dir` is null, sorts by `fallbackKey` ascending; never mutates input.
  - `export function matchesSearch(row: { display_name: string; role: string | null }, q: string): boolean` — trims, lowercases, substring on name or role; empty query matches all.

- [ ] **Step 1: Write `tests/ptoSort.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSortDir, compareValues, sortRows, matchesSearch } from '../src/app/lib/ptoSort.ts';

test('nextSortDir cycles null → asc → desc → null', () => {
  assert.equal(nextSortDir(null), 'asc');
  assert.equal(nextSortDir('asc'), 'desc');
  assert.equal(nextSortDir('desc'), null);
});

test('compareValues: numbers numerically, strings case-insensitively, empties last', () => {
  assert.ok(compareValues(2, 10) < 0);
  assert.ok(compareValues('b', 'A') > 0);
  assert.equal(compareValues('x', 'X'), 0);
  assert.ok(compareValues(null, 'a') > 0);
  assert.ok(compareValues('a', '') < 0);
  assert.ok(compareValues(undefined, 0) > 0);
});

test('sortRows: three-state, stable, empties last in both directions, input untouched', () => {
  const rows = [
    { display_name: 'Bea',  available: 3,    start: '2025-01-01' },
    { display_name: 'Al',   available: null, start: '2024-01-01' },
    { display_name: 'Cy',   available: 1,    start: '2026-01-01' },
    { display_name: 'Dee',  available: 3,    start: '2023-01-01' },
  ];
  const copy = JSON.stringify(rows);

  const asc = sortRows(rows, 'available', 'asc', 'display_name');
  assert.deepEqual(asc.map(r => r.display_name), ['Cy', 'Bea', 'Dee', 'Al']);

  const desc = sortRows(rows, 'available', 'desc', 'display_name');
  assert.deepEqual(desc.map(r => r.display_name), ['Bea', 'Dee', 'Cy', 'Al']);

  const none = sortRows(rows, 'available', null, 'display_name');
  assert.deepEqual(none.map(r => r.display_name), ['Al', 'Bea', 'Cy', 'Dee']);

  const byStart = sortRows(rows, 'start', 'asc', 'display_name');
  assert.deepEqual(byStart.map(r => r.display_name), ['Dee', 'Al', 'Bea', 'Cy']);

  assert.equal(JSON.stringify(rows), copy);
});

test('matchesSearch: name or role, case-insensitive, empty query matches', () => {
  const r = { display_name: 'Domingo Cruz', role: 'Care Coordinator' };
  assert.ok(matchesSearch(r, ''));
  assert.ok(matchesSearch(r, '  '));
  assert.ok(matchesSearch(r, 'cruz'));
  assert.ok(matchesSearch(r, 'COORD'));
  assert.ok(!matchesSearch(r, 'nurse'));
  assert.ok(matchesSearch({ display_name: 'X', role: null }, 'x'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/ptoSort.test.ts`
Expected: FAIL — `Cannot find module '.../src/app/lib/ptoSort.ts'`.

- [ ] **Step 3: Commit**

```bash
git add tests/ptoSort.test.ts
git commit -m "test: sort/filter helpers for the one-table PTO tracker (red)"
```

---

### Task 2: Migration — link Excel-imported approvals to their Monday items

**Files:**
- Create (UIB): `src/migrations/<ts>_link_excel_approvals_to_monday.sql`; `src/migrations/applied.txt` gains the entry.
- Create (local): `docs/superpowers/prompts/2026-08-19-pto-v2/20-link-excel-approvals.md`

- [ ] **Step 1: Before state.** In UIB → Data sources → Query runner (GAF Planilla DB) run and note the two numbers:

```sql
SELECT (SELECT count(*) FROM pto_approvals WHERE monday_item_id IS NULL AND source = 'excel_import') AS excel_unlinked,
       (SELECT count(*) FROM monday_requests r LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
         WHERE r.request_type = 'PTO / Vacation' AND r.deleted_on_monday = false AND a.id IS NULL) AS pending_now;
```
Expected: roughly `45 / 55`. Delete the scratch query afterwards.

- [ ] **Step 2: Write the prompt file** (content below, save it, commit it):

````markdown
Create and apply a new database migration named `link_excel_approvals_to_monday` against the `GAF Planilla DB` datasource, with exactly the SQL below. Do not change any other file.

```sql
-- PTO rows imported from the Excel tracker carry no monday_item_id, so the
-- matching Monday request still shows as pending in the app. Link each Excel
-- row to the request with the same employee and leave date. Idempotent; never
-- links two rows to one Monday item.
UPDATE pto_approvals a
SET    monday_item_id = r.monday_item_id,
       source         = 'monday',
       updated_at     = NOW()
FROM   monday_requests r
WHERE  a.monday_item_id IS NULL
  AND  a.source = 'excel_import'
  AND  r.request_type = 'PTO / Vacation'
  AND  r.deleted_on_monday = false
  AND  r.employee_id = a.employee_id
  AND  r.start_date  = a.leave_on
  AND  NOT EXISTS (SELECT 1 FROM pto_approvals x WHERE x.monday_item_id = r.monday_item_id);
```

Acceptance: after apply, `SELECT count(*) FROM monday_requests r LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id WHERE r.request_type = 'PTO / Vacation' AND r.deleted_on_monday = false AND a.id IS NULL` is small (expected 2). No file other than the new migration and `src/migrations/applied.txt` changed.
````

- [ ] **Step 3: LOOP.** Expected files: the new migration + `applied.txt` only. No tests change.

- [ ] **Step 4: After state.** Query runner:

```sql
SELECT e.display_name, r.start_date::text, r.return_date::text, r.total_days_requested
FROM monday_requests r LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
LEFT JOIN employees e ON e.id = r.employee_id
WHERE r.request_type = 'PTO / Vacation' AND r.deleted_on_monday = false AND a.id IS NULL
ORDER BY r.start_date;
```
Expected: Navvad Owusu 2026-08-26 and Elizabeth Mootoo 2026-08-17 only. If more, list each in the commit message (employee, Monday dates) — these are date mismatches for the owner to resolve; do not delete anything. Also run `SELECT count(*) FROM pto_approvals` — must equal the count before the migration (linking never inserts or deletes).

- [ ] **Step 5: Browser check.** Load `/pto?tab=approvals`; "PENDING FROM MONDAY (N)" shows N = the after-state count.

- [ ] **Step 6: Commit**

```
sync: link Excel-imported PTO rows to their Monday requests

<N> rows linked by employee + leave date. Pending from Monday drops from 55
to <M>: <names/dates if any besides Navvad Owusu and Elizabeth Mootoo>.
pto_approvals row count unchanged at <C>.
```

---

### Task 3: `ptoSort.ts`, `loadPtoEmployeeDetail`, drop TFT from balances inputs

**Files:**
- Create (UIB): `src/app/lib/ptoSort.ts`, `src/actions/loadPtoEmployeeDetail.ts`
- Modify (UIB): `src/actions/loadPtoBalancesInputs.ts`
- Create (local): `docs/superpowers/prompts/2026-08-19-pto-v2/21-ptosort-and-detail-action.md`

**Interfaces:**
- Produces `loadPtoEmployeeDetail({ employee_id: number, year: string, manager?: string | null })` returning **one row** with three JSON columns:
  - `pending: PendingRequest[]` — `{ monday_item_id, employee_id, display_name, employee_name_raw, leave_on, return_on, total_days, reason, submitted_at }` (same shape as `loadPendingPtoRequests`).
  - `ledger: LedgerRow[]` — `{ id, employee_id, display_name, leave_on, return_on, total_days, status, source, gaf_comments, recorded_by, monday_item_id, recorded_at }`.
  - `fh: { fh_allocated: number; fh_used: number; notes: string | null; start_date: string | null; pto_start_date_override: string | null } | null`.

- [ ] **Step 1: Write the prompt file:**

````markdown
Three small additions for the one-table PTO tracker. Files that may be created: `src/app/lib/ptoSort.ts`, `src/actions/loadPtoEmployeeDetail.ts`. File that may be modified: `src/actions/loadPtoBalancesInputs.ts`. No other file may change.

## 1. `src/app/lib/ptoSort.ts` — exact code, zero imports

```ts
// Pure sort/filter helpers for the PTO table. No imports: node tests load this directly.
export type SortDir = 'asc' | 'desc' | null;

export function nextSortDir(current: SortDir): SortDir {
  if (current === null) return 'asc';
  if (current === 'asc') return 'desc';
  return null;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

/** Numbers numerically, strings case-insensitively; empties always last. */
export function compareValues(a: unknown, b: unknown): number {
  const ea = isEmpty(a), eb = isEmpty(b);
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na - nb;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

/** Stable sort. key/dir null → fallbackKey ascending. Empties last in both directions. Never mutates. */
export function sortRows<T>(rows: T[], key: keyof T | null, dir: SortDir, fallbackKey: keyof T): T[] {
  const k: keyof T = key !== null && dir !== null ? key : fallbackKey;
  const d: 'asc' | 'desc' = key !== null && dir !== null ? dir : 'asc';
  const sign = d === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const a = x.r[k] as unknown, b = y.r[k] as unknown;
      const ea = isEmpty(a), eb = isEmpty(b);
      if (ea !== eb) return ea ? 1 : -1;           // empties last regardless of direction
      const c = compareValues(a, b) * sign;
      return c !== 0 ? c : x.i - y.i;
    })
    .map(x => x.r);
}

export function matchesSearch(row: { display_name: string; role: string | null }, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return row.display_name.toLowerCase().includes(s) || (row.role ?? '').toLowerCase().includes(s);
}
```

## 2. `src/actions/loadPtoEmployeeDetail.ts` — SQL, datasource `GAF Planilla DB`

Returns one row with three JSON columns for one employee. Params: `employee_id`, `year`, optional `manager`.

```sql
SELECT
  COALESCE((
    SELECT json_agg(json_build_object(
      'monday_item_id', r.monday_item_id, 'employee_id', r.employee_id, 'display_name', e.display_name,
      'employee_name_raw', r.employee_name_raw, 'leave_on', r.start_date::text, 'return_on', r.return_date::text,
      'total_days', r.total_days_requested, 'reason', r.reason, 'submitted_at', r.submitted_at::text
    ) ORDER BY r.start_date DESC)
    FROM monday_requests r
    LEFT JOIN employees e ON e.id = r.employee_id
    LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
    WHERE r.employee_id = {{params.employee_id}}::bigint
      AND r.request_type = 'PTO / Vacation' AND r.deleted_on_monday = false AND a.id IS NULL
  ), '[]'::json) AS pending,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', a.id, 'employee_id', a.employee_id, 'display_name', e.display_name,
      'leave_on', a.leave_on::text, 'return_on', a.return_on::text, 'total_days', a.total_days,
      'status', a.status, 'source', a.source, 'gaf_comments', a.gaf_comments, 'recorded_by', a.recorded_by,
      'monday_item_id', a.monday_item_id, 'recorded_at', a.recorded_at::text
    ) ORDER BY a.leave_on DESC, a.id DESC)
    FROM pto_approvals a LEFT JOIN employees e ON e.id = a.employee_id
    WHERE a.employee_id = {{params.employee_id}}::bigint
  ), '[]'::json) AS ledger,
  (
    SELECT json_build_object(
      'fh_allocated', COALESCE(fh.fh_allocated, 2), 'fh_used', COALESCE(fh.fh_used, 0), 'notes', fh.notes,
      'start_date', e.start_date::text, 'pto_start_date_override', pe.pto_start_date_override::text
    )
    FROM employees e
    LEFT JOIN pto_employees pe ON pe.employee_id = e.id
    LEFT JOIN pto_floating_holidays fh ON fh.employee_id = e.id AND fh.calendar_year = {{params.year}}::int
    WHERE e.id = {{params.employee_id}}::bigint
      AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
  ) AS fh
```

## 3. `src/actions/loadPtoBalancesInputs.ts`

Remove the `tft_hours` sub-select (the whole `(SELECT COALESCE(SUM(hours_approved),0) ... ) AS tft_hours` column and its trailing comma handling). Everything else in the query stays byte-identical.

Constraints: no Monday board/column/group id anywhere; `{{params.x}}` never inside quotes; files under 15 KB.
````

- [ ] **Step 2: LOOP.** Expected files: the two new files + `loadPtoBalancesInputs.ts`. Tests: `node --test "tests/*.test.ts"` now 87 passing (83 + 4 from Task 1).

- [ ] **Step 3: Browser check.** `/pto` Balances tab still loads with numbers (the TFT column shows 0/blank until Task 5 removes it — acceptable). In UIB's action runner, run `loadPtoEmployeeDetail` with Domingo Cruz's `employee_id` and year `2026`: `ledger` is a JSON array whose `total_days` for status `recorded` sum to his Taken; `fh` is an object.

- [ ] **Step 4: Commit**

```
sync: ptoSort helpers, loadPtoEmployeeDetail, TFT dropped from balances

ptoSort.ts is pure (zero imports) and green under the Task 1 tests.
loadPtoEmployeeDetail returns pending + ledger + fh as JSON for one employee,
loaded on row expand so the table stays one query.
```

---

### Task 4: Shared shell components + TopNav + FilterBar premium pass

**Files:**
- Create (UIB): `src/app/components/PageHeader.tsx`, `DataTable.tsx`, `StatusChip.tsx`, `EmptyState.tsx`, `InfoTip.tsx`
- Modify (UIB): `src/app/TopNav.tsx`, `src/app/FilterBar.tsx`, `src/index.css`
- Create (local): `docs/superpowers/prompts/2026-08-19-pto-v2/22-shell-and-nav.md`, `docs/findings/2026-08-19-pto-v2/before-nav.png`, `before-pto.png`

**Interfaces (Produces; Task 5/6 consume exactly these):**
```ts
// PageHeader.tsx
export default function PageHeader(props: { title: string; subtitle?: string; actions?: React.ReactNode }): JSX.Element;
// DataTable.tsx
export type Col<T> = { key: keyof T | string; label: string; align?: 'left'|'right'|'center'; tip?: string; sortable?: boolean; width?: string };
export default function DataTable<T>(props: {
  columns: Col<T>[]; sortKey: string | null; sortDir: 'asc'|'desc'|null;
  onSort: (key: string) => void; children: React.ReactNode; // <tbody> rows
  stickyHeader?: boolean; dense?: boolean; className?: string;
}): JSX.Element;
// StatusChip.tsx
export type ChipTone = 'green'|'amber'|'red'|'slate'|'violet'|'blue';
export default function StatusChip(props: { tone: ChipTone; icon?: React.ReactNode; children: React.ReactNode; strike?: boolean }): JSX.Element;
// EmptyState.tsx
export default function EmptyState(props: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }): JSX.Element;
// InfoTip.tsx — an ⓘ that shows `text` via native title (no portal)
export default function InfoTip(props: { text: string }): JSX.Element;
```

- [ ] **Step 1: Before screenshots.** Load `/pto` and the home page in Chrome; save screenshots to `docs/findings/2026-08-19-pto-v2/before-pto.png` and `before-nav.png` (use the `computer` screenshot with `save_to_disk`, then move the file).

- [ ] **Step 2: Read the three UI skills** (`agent-skills:frontend-ui-engineering`, `ui-styling`, `ui-ux-pro-max`) and use them to tighten the wording of the style brief below **without changing any rule in it**. The brief is the contract; the skills polish the how.

- [ ] **Step 3: Write the prompt file:**

````markdown
Premium pass on the app shell plus five small app-level presentational components the PTO page will use. Files that may be created: `src/app/components/PageHeader.tsx`, `src/app/components/DataTable.tsx`, `src/app/components/StatusChip.tsx`, `src/app/components/EmptyState.tsx`, `src/app/components/InfoTip.tsx`. Files that may be modified: `src/app/TopNav.tsx`, `src/app/FilterBar.tsx`, `src/index.css`. No other file may change — in particular nothing under `src/components/ui/` and no page.

## Nav change (TopNav.tsx)
Remove the `people` section entirely. Add in its slot a top-level section: `id: 'pto'`, `label: 'PTO Tracker'`, `icon: Palmtree`, `home: '/pto'`, `paths: ['/pto']`, same purple colour set the People section had, `links: []`. When a section has no links, render no sub-row at all (no empty strip). Keep every other section's content identical.

## Style brief (applies to everything in this prompt)
- Spacing on an 8-pt grid (4/8/12/16/24/32). Type scale: page title 18/600, section label 11/600 uppercase tracking-wide muted, body 13, caption 12 muted.
- Brand stays: navy `--primary` for primary actions, teal `--secondary` for positive chips, purple only as the PTO section accent. No gradients on buttons; the nav's section gradient may stay but soften (opacity 90%).
- Surfaces: white cards, `border border-slate-200`, shadow `0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)` (add as `--shadow-card` in `:root` of index.css and a `.shadow-card` utility under `@layer utilities`). Radius 10 px for cards, 8 px for inputs/buttons, full for chips.
- Tables: 13 px body, `tabular-nums`, numeric columns right-aligned, header uppercase caption on `bg-slate-50`, row `hover:bg-slate-50/80`, no zebra, 1 px `border-slate-100` row dividers.
- Focus: visible `ring-2 ring-primary/30` on every interactive element.
- Transitions 150 ms on hover/colour only; no layout animation.

## TopNav.tsx
Keep the component's structure and section ids; restyle: brand block with the GAF mark and "GAF Healthcare" 14/700 + "HR Hub" 10 caption (replace "Planilla · Payroll System" with "HR Hub"); section buttons as pills 32 px tall, 13/500, 8 px gap, active pill uses the section colour, inactive `text-slate-600 hover:bg-slate-100`; the sub-link row (when a section has links) is a 36 px strip with 12/500 links and the section's `subActiveBg`. Keep the environment/edit chrome untouched (it is UIB's, not ours).

## FilterBar.tsx
Keep all behaviour and the per-route visibility map. Restyle: 48 px bar, `bg-white border-b border-slate-200`, labels as 11 uppercase muted captions left of each control, inputs 32 px tall `rounded-lg border-slate-200`, the "clear all" affordance as a quiet text button on the right. No new filters.

## New components — exact exports
```tsx
// src/app/components/PageHeader.tsx
import type { ReactNode } from 'react';
export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
```
```tsx
// src/app/components/InfoTip.tsx
import { Info } from 'lucide-react';
export default function InfoTip({ text }: { text: string }) {
  return <Info className="inline-block w-3 h-3 ml-1 text-slate-400 align-[-1px]" aria-label={text} title={text} />;
}
```
```tsx
// src/app/components/StatusChip.tsx
import type { ReactNode } from 'react';
export type ChipTone = 'green' | 'amber' | 'red' | 'slate' | 'violet' | 'blue';
const TONES: Record<ChipTone, string> = {
  green:  'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber:  'bg-amber-50 text-amber-700 ring-amber-600/15',
  red:    'bg-red-50 text-red-700 ring-red-600/15',
  slate:  'bg-slate-100 text-slate-600 ring-slate-500/10',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  blue:   'bg-sky-50 text-sky-700 ring-sky-600/15',
};
export default function StatusChip({ tone, icon, children, strike }: { tone: ChipTone; icon?: ReactNode; children: ReactNode; strike?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONES[tone]} ${strike ? 'line-through opacity-70' : ''}`}>
      {icon}{children}
    </span>
  );
}
```
```tsx
// src/app/components/EmptyState.tsx
import type { ReactNode } from 'react';
export default function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 bg-white">
      {icon && <div className="text-slate-300 mb-2">{icon}</div>}
      <div className="text-sm font-medium text-slate-700">{title}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
```
```tsx
// src/app/components/DataTable.tsx
import type { ReactNode } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import InfoTip from './InfoTip';
export type Col<T> = { key: keyof T | string; label: string; align?: 'left' | 'right' | 'center'; tip?: string; sortable?: boolean; width?: string };
export default function DataTable<T>({ columns, sortKey, sortDir, onSort, children, stickyHeader = true, dense = false, className = '' }: {
  columns: Col<T>[]; sortKey: string | null; sortDir: 'asc' | 'desc' | null; onSort: (key: string) => void;
  children: ReactNode; stickyHeader?: boolean; dense?: boolean; className?: string;
}) {
  const pad = dense ? 'px-3 py-1.5' : 'px-3 py-2';
  return (
    <div className={`overflow-auto rounded-xl border border-slate-200 bg-white shadow-card ${className}`}>
      <table className="w-full text-[13px] text-slate-700">
        <thead className={`${stickyHeader ? 'sticky top-0 z-10' : ''} bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500`}>
          <tr className="border-b border-slate-200">
            {columns.map(c => {
              const k = String(c.key);
              const active = sortKey === k && sortDir !== null;
              const al = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
              const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={k} style={c.width ? { width: c.width } : undefined} className={`${pad} font-semibold ${al} whitespace-nowrap`}>
                  {c.sortable === false ? (
                    <span>{c.label}{c.tip && <InfoTip text={c.tip} />}</span>
                  ) : (
                    <button type="button" onClick={() => onSort(k)} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={`inline-flex items-center gap-1 rounded px-1 -mx-1 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${active ? 'text-slate-900' : ''}`}>
                      {c.label}{c.tip && <InfoTip text={c.tip} />}
                      <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
```
Constraints: each file under 15 KB; no behaviour change in FilterBar; no page imports these yet.
````

- [ ] **Step 4: LOOP.** Expected files: five new components, `TopNav.tsx`, `FilterBar.tsx`, `src/index.css`. Tests: 87 passing.

- [ ] **Step 5: Browser check.** Home page: nav shows Payroll · Attendance · PTO Tracker · Admin, no "People"; click PTO Tracker → `/pto` with no sub-row; the filter bar renders on `/pto` and `/attendance` with the same controls as before. Save `docs/findings/2026-08-19-pto-v2/after-nav.png`.

- [ ] **Step 6: Commit**

```
sync: shell premium pass — TopNav, FilterBar, shadow token, five app-level components

People group removed; PTO Tracker is top-level. PageHeader/DataTable/
StatusChip/EmptyState/InfoTip added under src/app/components for the PTO
page; nothing under src/components/ui changed; no page touched.
```

---

### Task 5: `PtoTracker` v2 — the one table (no breakdown yet)

**Files:**
- Create (UIB): `src/app/pages/pto/PtoTable.tsx`, `src/app/pages/pto/PtoRow.tsx`
- Modify (UIB): `src/app/pages/PtoTracker.tsx`
- Create (local): `docs/superpowers/prompts/2026-08-19-pto-v2/23-one-table.md`

**Interfaces:**
- Consumes: `DataTable`, `Col`, `PageHeader`, `StatusChip`, `InfoTip`, `EmptyState` (Task 4); `sortRows`, `nextSortDir`, `matchesSearch`, `SortDir` (Task 3); `accruedPto`, `fhEligibleDate`, `fhRemaining` from `ptoAccrual.ts`; `loadPtoBalancesInputs`; `toLocalYMD` — **check**: `grep -rn "export function toLocalYMD" src/app` and give the prompt the real import path; if none exists, the prompt defines it locally in `PtoTracker.tsx` as shown.
- Produces for Task 6: `PtoRow` accepts `children` (the breakdown) and renders it in a second `<tr>` when `expanded`; Task 6 supplies the child. Type `PtoRowData` exported from `PtoRow.tsx`:
```ts
export interface PtoRowData {
  employee_id: number; display_name: string; role: string | null; manager: string | null;
  start_date: string | null; pto_start_date_override: string | null;
  paid_pto_days: number | string; taken_days: number | string; pending_count: number | string;
  fh_allocated: number | string; fh_used: number | string; wfh_days: number | string; birthday_days: number | string;
  // derived client-side in PtoTable:
  start: string | null; accrued: number | null; available: number | null; fh_left: number | null; pending: number;
}
```

- [ ] **Step 1: Write the prompt file:**

````markdown
Rebuild the PTO Tracker page as one table. Files that may be created: `src/app/pages/pto/PtoTable.tsx`, `src/app/pages/pto/PtoRow.tsx`. File that may be modified: `src/app/pages/PtoTracker.tsx`. No other file may change. Do NOT delete the old tab files yet; they simply stop being imported.

## PtoTracker.tsx
Replace the tabbed shell with:
- `PageHeader` title "PTO Tracker", subtitle "Accrual, approvals and floating holidays — one row per employee", actions: As-of date input (`<input type="date">`, default `toLocalYMD(new Date())`), "Add manually" outline button with a `Plus` icon (opens `RecordApprovalDialog` in `{ kind: 'manual' }` mode — import the existing dialog from `./pto/RecordApprovalDialog`), "Export" outline button with `Download` icon.
- Below it `<PtoTable asOf={asOf} onOpenDialog={setDialogMode} />` and the `RecordApprovalDialog` with `mode/onClose/onSaved` (onSaved bumps a `refreshKey` passed into `PtoTable`).
- Ignore any `?tab=` search param; do not redirect.
- If no exported `toLocalYMD` exists in `src/app`, define locally:
```ts
function toLocalYMD(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

## PtoTable.tsx
Props: `{ asOf: string; refreshKey: number; onOpenDialog: (m: DialogMode) => void; onRowsChange?: (rows: PtoRowData[]) => void }`. In this task rows never expand into content (the chevron toggles an `expanded` set but no child is passed); Task 6 adds the breakdown.
- Loads `loadPtoBalancesInputs` with `{ year: asOf.slice(0,4), manager: manager || null }` from `useGlobalFilters()`; re-runs when `refreshKey` or `asOf` changes.
- Derives per row: `start = pto_start_date_override || start_date`, `accrued = start && start <= asOf ? accruedPto(start, asOf) : null`, `available = accrued === null ? null : accrued - Number(taken_days)`, `fh_left = fhRemaining(fh_allocated, fh_used)` (null if `fhEligibleDate(start) > asOf`), `pending = Number(pending_count) || 0`.
- Controls row above the table, inside the page body (`flex flex-wrap items-center gap-3 px-6 pb-3`): search input (placeholder "Search name or title", 240 px, debounced 200 ms, uses `matchesSearch`), checkbox "Only with pending", checkbox "Show withdrawn" (state held here; Task 6 passes it into the breakdown), and on the right a caption "N employees · P pending".
- Global `employee` and `role` filters from `useGlobalFilters()` still apply (same substring logic as the old `BalancesTab`).
- Sorting: `sortKey: string | null`, `sortDir: SortDir`; `onSort(k)` → if `k === sortKey` then `sortDir = nextSortDir(sortDir)` (and if it becomes null, `sortKey = null`) else `sortKey = k, sortDir = 'asc'`. Rows = `sortRows(filtered, sortKey as keyof PtoRowData | null, sortDir, 'display_name')`.
- Columns (`Col<PtoRowData>[]`), in this order with these tips:
  1. `display_name` "Employee"
  2. `role` "Title"
  3. `start` "Start"
  4. `accrued` "Accrued" right, tip "DAYS360(start, as-of) ÷ 11 — the sheet's formula. About 1 day per 11 calendar days."
  5. `taken_days` "Taken" right, tip "Sum of recorded PTO days. Withdrawn rows don't count."
  6. `available` "Available" right, tip "Accrued − Taken. Red when negative."
  7. `paid_pto_days` "Paid PTO" right, tip "Days already paid in advance (CSS two-week blocks). Manual."
  8. `fh_left` "FH left" right, tip "2 per calendar year, non-stacking, eligible 90 days after hire."
  9. `wfh_days` "WFH" right, tip "Approved Work-From-Home requests on Monday this year."
  10. `birthday_days` "Birthday" right, tip "Birthday day-off requests on Monday this year."
  11. `pending` "Pending" center, tip "Monday PTO requests not yet recorded."
- Wrap in `DataTable` with `stickyHeader`. The scroll container is the `DataTable` itself; give it `max-h-[calc(100vh-220px)]` via `className` so the header sticks while rows scroll.
- Loading: a centered `Loader2` spinner row. Error: a red banner "Couldn't load PTO balances — loadPtoBalancesInputs". Empty after filters: `EmptyState` title "No employees match" hint "Try clearing the search or filters."
- Export button handler lives in `PtoTracker.tsx` but needs the rows: `PtoTable` calls `onRowsChange(sortedFilteredRows)` whenever they change; export writes columns Employee, Title, Start, Accrued, Taken, Available, Paid PTO, FH left, WFH, Birthday, Pending to `pto-tracker-<asOf>.xlsx` with SheetJS.

## PtoRow.tsx
Props: `{ row: PtoRowData; asOf: string; expanded: boolean; onToggle: () => void; children?: ReactNode }` — `children` is the breakdown content; when `expanded` and `children` is provided, render a second `<tr>` with one `<td colSpan={11} className="bg-slate-50/60 p-0">` containing it.
- First cell: chevron (`ChevronRight` rotating 90° when expanded, 150 ms) + name in `font-medium text-slate-900`; below the name, if `!row.start`, a caption "no start date" in amber.
- Numbers `tabular-nums`, right-aligned, 2 decimals for accrued/available/taken, integers elsewhere; null renders a muted "—".
- Available: `text-red-600 font-semibold` when negative.
- FH left: when not yet eligible show `StatusChip tone="slate"` "from {fhEligibleDate}"; else the number.
- Pending: `0` → muted "—"; otherwise `StatusChip tone="amber"` with the count.
- Whole row clickable (`cursor-pointer hover:bg-slate-50/80`), `onClick={onToggle}`, `aria-expanded`.

Constraints: each file under 15 KB; dates compared as strings; today via `toLocalYMD`; no Monday ids.
````

- [ ] **Step 2: LOOP.** Expected files: `PtoTable.tsx`, `PtoRow.tsx`, `PtoTracker.tsx`. Tests: 87 passing.

- [ ] **Step 3: Browser check.** `/pto`: no tabs; header sticks when scrolling rows; clicking "Available" sorts ascending (Charles Bush's negative-or-low value first), again descending, again back to A→Z; search "cruz" leaves Domingo; "Only with pending" leaves the two; Pending badges show 1 on Navvad and Elizabeth. Add manually opens the dialog. Export downloads.

- [ ] **Step 4: Commit**

```
sync: PTO Tracker is one sortable table; tabs gone

Sticky header, three-state sort on every column, search, only-with-pending,
show-withdrawn; tooltips on every numeric header. Rows expand (breakdown
arrives next). Old tab files still present, no longer imported.
```

---

### Task 6: `PtoBreakdown` — pending, ledger, floating holidays inside the row

**Files:**
- Create (UIB): `src/app/pages/pto/PtoBreakdown.tsx`
- Modify (UIB): `src/app/pages/pto/PtoTable.tsx` (pass `PtoBreakdown` as the `PtoRow` child; per-row detail reload)
- Create (local): `docs/superpowers/prompts/2026-08-19-pto-v2/24-breakdown.md`

**Interfaces:**
- Consumes: `loadPtoEmployeeDetail` (Task 3), `updatePtoApprovalStatus`, `upsertFloatingHoliday`, `RecordApprovalDialog`'s `DialogMode`, `PendingRequest`, `LedgerRow` types, `StatusChip`, `EmptyState`.
- Produces: `export default function PtoBreakdown(props: { row: PtoRowData; year: string; showWithdrawn: boolean; onOpenDialog: (m: DialogMode) => void; onChanged: () => void; detailKey: number })`.

- [ ] **Step 1: Write the prompt file:**

````markdown
Add the per-employee breakdown to the one-table PTO Tracker. File that may be created: `src/app/pages/pto/PtoBreakdown.tsx`. File that may be modified: `src/app/pages/pto/PtoTable.tsx`. No other file may change.

## PtoTable.tsx changes
- Hold `expanded: Set<number>` of employee_ids (multiple rows may be open) and `detailKey: number` bumped whenever any write succeeds.
- Render `<PtoRow … expanded={expanded.has(id)} onToggle={…}>{expanded.has(id) && <PtoBreakdown row={row} year={asOf.slice(0,4)} showWithdrawn={showWithdrawn} onOpenDialog={onOpenDialog} onChanged={() => { bumpDetailKey(); reloadBalances(); }} detailKey={detailKey} />}</PtoRow>`.
- When the dialog's `onSaved` fires (via `refreshKey` prop changing), also bump `detailKey` so open breakdowns refetch.

## PtoBreakdown.tsx
Props: `{ row: PtoRowData; year: string; showWithdrawn: boolean; onOpenDialog: (m: DialogMode) => void; onChanged: () => void; detailKey: number }`.
- `useLoadAction(loadPtoEmployeeDetailAction, null, { employee_id: row.employee_id, year, manager: null })`, re-run on `detailKey`. While loading show a 48 px row with `Loader2`. On error a compact red line "Couldn't load details — loadPtoEmployeeDetail".
- Layout: `grid grid-cols-1 lg:grid-cols-[1fr_1fr_280px] gap-4 px-6 py-4` with three blocks, each a white card (`rounded-lg border border-slate-200 shadow-card p-3`) with a section label (11 uppercase muted) and content.

### Block 1 — "Pending from Monday"
Rows from `detail.pending`: `leave_on → return_on · requested N d` (N = `total_days` from Monday) in 13 px, reason in 12 px muted truncated with `title` = full reason, and a primary `Button size="sm"` "Record" with `Plus` icon → `onOpenDialog({ kind: 'record', request })`. Empty: `EmptyState` title "Nothing waiting" (compact: `py-6`).

### Block 2 — "Recorded PTO"  (header right: "taken {sum} d" where sum = Σ total_days of status `recorded`)
Rows from `detail.ledger`, newest first; skip `status === 'withdrawn'` unless `showWithdrawn`. Each row: `leave_on → return_on · N d`, source chip (`StatusChip` tone violet "Monday" / slate "Excel" / blue "Manual" by `source` in {'monday','excel_import','manual'}), comments 12 px muted truncated with `title`, then buttons: outline `size="sm"` "Edit" (`Pencil`) → `onOpenDialog({ kind: 'edit', row })`; outline red `size="sm"` "Withdraw" (`Trash2`) shown only when `status === 'recorded'` → `window.confirm("Withdraw this PTO record? Taken will drop by N days.")` → `updatePtoApprovalStatus({ id, status: 'withdrawn' })` → `onChanged()`. Withdrawn rows: `StatusChip tone="red" strike` "withdrawn", text `line-through text-slate-400`, no buttons. Empty: `EmptyState` title "No PTO recorded".

### Block 3 — "Floating holidays {year}"
From `detail.fh` (treat null as `{fh_allocated: 2, fh_used: 0}`). Start = `pto_start_date_override || start_date`. If start and `fhEligibleDate(start) > asOfToday` (today = local `YYYY-MM-DD`): show "Eligible from {date}" muted and no stepper. Else: big "{used} of {allocated} used", "{left} left" caption, and a stepper `[−] [+]` (outline icon buttons, disabled at 0 and at allocated) that calls `upsertFloatingHoliday({ employee_id, calendar_year: Number(year), fh_allocated, fh_used: next, notes: detail.fh?.notes ?? null })` optimistically, rolls back on error with a red caption, then `onChanged()`.

Constraints: under 15 KB; string date comparison only; no Monday ids; every button is a real `<Button>` with icon + label (no text links).
````

- [ ] **Step 2: LOOP.** Expected files: `PtoBreakdown.tsx`, `PtoTable.tsx`. Tests: 87.

- [ ] **Step 3: Browser check.** `/pto`: expand Domingo Cruz → Recorded PTO lists his rows and "taken" equals his Taken column; expand Navvad Owusu → Pending shows 2026-08-26 → 27 with Record; click Record → dialog (old layout for now) → cancel. Expand someone with FH, press `+` → "used" increments and the FH left column drops by 1 without reload; press `−` to restore. Withdraw on a manual/test row is NOT exercised on real data — instead: Add manually a 1-day row for Timothy Moore (no payroll impact), confirm it appears in his breakdown and Taken = 1, then Withdraw it: Taken back to 0, row struck-through when "Show withdrawn" is on.

- [ ] **Step 4: Commit**

```
sync: per-employee breakdown — pending, ledger with Edit/Withdraw, FH stepper

Loaded on expand via loadPtoEmployeeDetail; every write refreshes the row's
numbers without a page reload. Verified live on Timothy Moore with a manual
1-day row recorded then withdrawn (Taken 0 → 1 → 0).
```

---

### Task 7: Record dialog — Monday block, no "Recorded by"

**Files:**
- Modify (UIB): `src/app/pages/pto/RecordApprovalDialog.tsx`
- Create (local): `docs/superpowers/prompts/2026-08-19-pto-v2/25-dialog.md`

- [ ] **Step 1: Write the prompt file:**

````markdown
Rework the PTO record dialog's layout. Only `src/app/pages/pto/RecordApprovalDialog.tsx` may change. Keep its exports (`PendingRequest`, `LedgerRow`, `DialogMode`, default component with `{ mode, onClose, onSaved }`) and all three modes.

1. Remove the "Recorded by" input, its label, the `LS_RECORDED_BY` localStorage read/write, and the "Recorded by is required" validation. Send `recorded_by: 'app'` on insert (record and manual modes). In edit mode do not send `recorded_by` at all if `updatePtoApproval` requires it — then send the row's existing `recorded_by` unchanged.
2. Title line: "Record PTO" / "Edit PTO" / "Add PTO manually" + a context caption under it: employee name, and in record mode "· from Monday request".
3. In **record** mode add, above the form, a read-only block with a section label "Requested on Monday" (11 uppercase muted) in a `rounded-lg bg-slate-50 border border-slate-200 p-3` card: `{leave_on} → {return_on} · {total_days} day(s)` in 13 px, and the reason in 12 px muted if present. Not shown in edit/manual modes.
4. A section label "Recording" above the date/total/comments fields.
5. Under Total days, when `mode.kind === 'record'` and `Number(mode.request.total_days) !== Number(totalDays)`, a 12 px muted note: "Monday request said {N} day(s); the calendar span is {M}." Not blocking.
6. Validation order stays: dates required → return ≥ leave (string compare) → total > 0 → employee chosen in manual mode.
7. Footer: Cancel (outline) then primary "Record approval" / "Save changes" / "Add approval" with `Loader2` while saving.

Constraints: under 15 KB; no `new Date(...)` on date strings; keep the existing action imports.
````

- [ ] **Step 2: LOOP.** Expected file: `RecordApprovalDialog.tsx`. Tests: 87.

- [ ] **Step 3: Browser check.** Expand Navvad Owusu → Record → dialog shows "Requested on Monday 2026-08-26 → 2026-08-27 · 1 day" above "Recording"; no Recorded by field; set return to 2026-08-25 → red "Return date must be on or after the leave date."; cancel without saving. Then Edit on a Timothy Moore manual row → no Monday block, Save → row unchanged, `SELECT recorded_by FROM pto_approvals WHERE id = <that id>` unchanged. Add manually for Timothy Moore 1 day → `recorded_by = 'app'` in the DB; then Withdraw it.

- [ ] **Step 4: Commit**

```
sync: record dialog shows the Monday request beside what we record; Recorded-by removed

recorded_by now 'app' for new rows; edits leave it untouched.
```

---

### Task 8: Delete the old tabs, update H5 and AGENTS.md

**Files:**
- Delete (UIB): `src/app/pages/pto/BalancesTab.tsx`, `BalancesRow.tsx`, `ApprovalsTab.tsx`, `ApprovalRow.tsx`, `FloatingHolidaysTab.tsx`, `src/actions/loadPtoApprovals.ts`, `src/actions/loadFloatingHolidays.ts`
- Modify (UIB): `src/AGENTS.md`
- Modify (local): `tests/hardcoding.test.ts`
- Create (local): `docs/superpowers/prompts/2026-08-19-pto-v2/26-delete-old-tabs.md`

- [ ] **Step 1: Confirm nothing imports the doomed files** (local, before prompting):

Run: `grep -rn "BalancesTab\|BalancesRow\|ApprovalsTab\|ApprovalRow\|FloatingHolidaysTab\|loadPtoApprovals\|loadFloatingHolidays" src/app src/actions --include=*.ts --include=*.tsx | grep -v "src/app/pages/pto/\(BalancesTab\|BalancesRow\|ApprovalsTab\|ApprovalRow\|FloatingHolidaysTab\)"`
Expected: no output. If any file still imports one, fix that first (it means Task 5/6 left a reference).

- [ ] **Step 2: Extend H5 locally** — in `tests/hardcoding.test.ts` replace the H5 test body's list with:

```ts
test('H5: the legacy admin pages, hardcoded-id actions and the old PTO tabs are gone', () => {
  for (const f of [
    'src/app/pages/admin/AdminEmployees.tsx',
    'src/app/pages/admin/AdminEmployeeSync.tsx',
    'src/app/pages/admin/AdminAliases.tsx',
    'src/actions/loadEmployeeDirectory.ts',
    'src/actions/fetchMondayStartDates.ts',
    // PTO Tracker v2 (2026-08-19): one table replaced the three tabs.
    'src/app/pages/pto/BalancesTab.tsx',
    'src/app/pages/pto/BalancesRow.tsx',
    'src/app/pages/pto/ApprovalsTab.tsx',
    'src/app/pages/pto/ApprovalRow.tsx',
    'src/app/pages/pto/FloatingHolidaysTab.tsx',
    'src/actions/loadPtoApprovals.ts',
    'src/actions/loadFloatingHolidays.ts',
  ]) {
    assert.ok(!existsSync(f), `${f} should have been deleted`);
  }
});
```

Run: `node --test "tests/*.test.ts"` → H5 FAILS (files still exist). Commit the test: `git commit -am "test: H5 expects the old PTO tabs gone (red)"`.

- [ ] **Step 3: Write the prompt file:**

````markdown
Delete seven files that nothing imports any more, and update one doc. Files to delete: `src/app/pages/pto/BalancesTab.tsx`, `src/app/pages/pto/BalancesRow.tsx`, `src/app/pages/pto/ApprovalsTab.tsx`, `src/app/pages/pto/ApprovalRow.tsx`, `src/app/pages/pto/FloatingHolidaysTab.tsx`, `src/actions/loadPtoApprovals.ts`, `src/actions/loadFloatingHolidays.ts`. File to modify: `src/AGENTS.md` — in the PTO section replace the description of the three tabs with: "`/pto` is one table (`PtoTracker.tsx` → `pto/PtoTable.tsx`, `PtoRow.tsx`, `PtoBreakdown.tsx`); a row expands into pending Monday requests, the recorded ledger (Edit/Withdraw) and floating holidays, loaded by `loadPtoEmployeeDetail`. `RecordApprovalDialog.tsx` has record / edit / manual modes; `recorded_by` is `'app'` for new rows." No other file may change. Do not remove the actions' datasource or any table.
````

- [ ] **Step 4: LOOP.** Expected: seven deletions + `src/AGENTS.md`. Tests: 87 passing, H5 green.

- [ ] **Step 5: Browser check.** `/pto` loads; expand a row; nothing in the console about missing modules.

- [ ] **Step 6: Commit**

```
sync: old PTO tabs and their two actions deleted; AGENTS.md describes the one-table page
```

---

### Task 9: Final verification, screenshots, merge

- [ ] **Step 1: Acceptance pass against spec §5** — tick each live: pending = 2; no tabs; sticky header; three-state sort on Employee, Available, Pending; search; only-with-pending; show-withdrawn; Domingo's breakdown sums to his Taken; Record/Edit/Withdraw/FH write and refresh in place; dialog Monday block; no Recorded-by; nav top-level; no payroll file in `git log --stat` since `d482fb1`; `wc -c` on every `src/app/pages/pto/*.tsx` and `src/app/components/*.tsx` < 15 360.

- [ ] **Step 2: After screenshots** → `docs/findings/2026-08-19-pto-v2/after-pto.png`, `after-pto-expanded.png`, `after-dialog.png`. Commit.

- [ ] **Step 3: Findings note** `docs/findings/2026-08-19-pto-v2/README.md`: what shipped, link count from Task 2, anything left pending (e.g. date-mismatch rows), and that payroll was untouched. Commit.

- [ ] **Step 4: Merge**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor" && git merge --ff-only claude/app-feature-expansion-08fa71 && git push origin main && git rev-parse origin/main HEAD
```
Expected: identical SHAs.
