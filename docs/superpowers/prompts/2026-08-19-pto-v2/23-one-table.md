Rebuild the PTO Tracker page as one table.

Files that may be created: `src/app/pages/pto/PtoTable.tsx`, `src/app/pages/pto/PtoRow.tsx`.
File that may be modified: `src/app/pages/PtoTracker.tsx`.
No other file may change. Do NOT delete the old tab files (`BalancesTab.tsx`, `BalancesRow.tsx`, `ApprovalsTab.tsx`, `ApprovalRow.tsx`, `FloatingHolidaysTab.tsx`) — they simply stop being imported; a later prompt removes them.

## PtoTracker.tsx

Replace the tabbed shell entirely.

- `PageHeader` (from `@/app/components/PageHeader`) with title `PTO Tracker`, subtitle `Accrual, approvals and floating holidays — one row per employee`, and `actions`:
  - an **As of** date `<input type="date">` (label "As of" as an 11px uppercase muted caption to its left), default `toLocalYMD(new Date())` imported from `@/app/lib/classificationEngine`;
  - an outline **Add manually** `Button` with a `Plus` icon that opens `RecordApprovalDialog` in `{ kind: 'manual' }` mode;
  - an outline **Export** `Button` with a `Download` icon.
- Below: `<PtoTable asOf={asOf} refreshKey={refreshKey} onOpenDialog={setDialogMode} onRowsChange={setRows} />`.
- Then `<RecordApprovalDialog mode={dialogMode} onClose={() => setDialogMode(null)} onSaved={() => { setDialogMode(null); setRefreshKey(k => k + 1); }} />` — import it from `./pto/RecordApprovalDialog`.
- Ignore any `?tab=` search param; do not redirect.
- Export handler uses SheetJS on the rows received from `onRowsChange` and writes columns Employee, Title, Start, Accrued, Taken, Available, Paid PTO, FH left, WFH, Birthday, Pending to `pto-tracker-<asOf>.xlsx`.
- The page is `flex flex-col h-full`; the table area gets `flex-1 min-h-0`.

## PtoTable.tsx

Props: `{ asOf: string; refreshKey: number; onOpenDialog: (m: DialogMode) => void; onRowsChange?: (rows: PtoRowData[]) => void }`.
Import `DialogMode` from `./RecordApprovalDialog` and `PtoRowData` from `./PtoRow`.

- Loads `loadPtoBalancesInputs` via `useLoadAction` with `{ year: asOf.slice(0, 4), manager: manager || null }` from `useGlobalFilters()`. Re-run when `refreshKey` or `asOf` changes.
- Derive per row, using `accruedPto`, `fhEligibleDate`, `fhRemaining` from `@/app/lib/ptoAccrual`:
  - `start = pto_start_date_override || start_date` (may be null)
  - `accrued = start && start <= asOf ? accruedPto(start, asOf) : null`
  - `available = accrued === null ? null : accrued - (Number(taken_days) || 0)`
  - `fhEligible = start ? fhEligibleDate(start) <= asOf : false`
  - `fh_left = fhEligible ? fhRemaining(fh_allocated, fh_used) : null`
  - `pending = Number(pending_count) || 0`
- Controls strip above the table (`flex flex-wrap items-center gap-3 px-6 pb-3`):
  - search `Input`, 240px, placeholder `Search name or title`, debounced 200 ms, filtered with `matchesSearch` from `@/app/lib/ptoSort`;
  - a checkbox **Only with pending**;
  - a checkbox **Show withdrawn** (its state is held here and is used by a later prompt; for now it only needs to exist and be wired to state);
  - pushed right, a 12px muted caption `{n} employees · {p} pending`.
- The global `employee` and `role` filters from `useGlobalFilters()` still apply, with the same substring logic the old `BalancesTab` used.
- Sorting with `sortRows` / `nextSortDir` / `SortDir` from `@/app/lib/ptoSort`:
  - state `sortKey: string | null` (init `null`), `sortDir: SortDir` (init `null`);
  - `onSort(k)`: if `k === sortKey`, `const d = nextSortDir(sortDir); setSortDir(d); if (d === null) setSortKey(null);` else `setSortKey(k); setSortDir('asc');`
  - rows = `sortRows(filtered, sortKey as keyof PtoRowData | null, sortDir, 'display_name')`.
- Call `onRowsChange(rows)` in an effect whenever the sorted/filtered rows change.
- Track `expanded: Set<number>` of `employee_id` and pass `expanded` / `onToggle` to each `PtoRow`. (No breakdown content yet — a later prompt supplies it.)
- Columns array typed `Col<PtoRowData>[]`, in this exact order, with these tips:
  1. `display_name` — "Employee"
  2. `role` — "Title"
  3. `start` — "Start"
  4. `accrued` — "Accrued", align right, tip `DAYS360(start, as-of) ÷ 11 — the sheet's formula. About 1 day per 11 calendar days.`
  5. `taken_days` — "Taken", align right, tip `Sum of recorded PTO days. Withdrawn rows don't count.`
  6. `available` — "Available", align right, tip `Accrued − Taken. Red when negative.`
  7. `paid_pto_days` — "Paid PTO", align right, tip `Days already paid in advance (CSS two-week blocks). Manual.`
  8. `fh_left` — "FH left", align right, tip `2 per calendar year, non-stacking, eligible 90 days after hire.`
  9. `wfh_days` — "WFH", align right, tip `Approved Work-From-Home requests on Monday this year.`
  10. `birthday_days` — "Birthday", align right, tip `Birthday day-off requests on Monday this year.`
  11. `pending` — "Pending", align center, tip `Monday PTO requests not yet recorded.`
- Render with `DataTable` from `@/app/components/DataTable`, `stickyHeader`, and `className="mx-6 mb-6 max-h-[calc(100vh-260px)]"` so the header stays put while rows scroll.
- Loading: a single row with a centred `Loader2` spinner. Error: a red banner reading `Couldn't load PTO balances — loadPtoBalancesInputs`. No rows after filtering: `EmptyState` title `No employees match`, hint `Try clearing the search or filters.`

## PtoRow.tsx

Export the row type and the component:

```ts
export interface PtoRowData {
  employee_id: number;
  display_name: string;
  role: string | null;
  manager: string | null;
  start_date: string | null;
  pto_start_date_override: string | null;
  paid_pto_days: number | string;
  taken_days: number | string;
  pending_count: number | string;
  fh_allocated: number | string;
  fh_used: number | string;
  wfh_days: number | string;
  birthday_days: number | string;
  start: string | null;
  accrued: number | null;
  available: number | null;
  fh_left: number | null;
  fh_eligible_from: string | null;
  pending: number;
}
```

Props: `{ row: PtoRowData; expanded: boolean; onToggle: () => void; children?: ReactNode }`.

- Main `<tr>` is clickable (`cursor-pointer hover:bg-slate-50/80`), `onClick={onToggle}`, with `aria-expanded={expanded}`.
- First cell: a `ChevronRight` that rotates 90° when expanded (`transition-transform duration-150`), then the name in `font-medium text-slate-900`. If `!row.start`, a 11px amber caption `no start date` under the name.
- Numeric cells: `text-right tabular-nums`. Accrued / Taken / Available show two decimals; Paid PTO, WFH, Birthday, FH left show integers. A `null` renders a muted `—`.
- Available is `text-red-600 font-semibold` when negative.
- FH left: when `row.fh_left === null` and `row.fh_eligible_from` is set, render `StatusChip` tone `slate` reading `from {fh_eligible_from}`; otherwise the number.
- Pending: `0` renders a muted `—`; otherwise `StatusChip` tone `amber` with the count.
- When `expanded && children`, render a second `<tr>` with a single `<td colSpan={11} className="bg-slate-50/60 p-0">` containing `{children}`.

## Constraints
- Each file under 15 KB.
- Dates are `YYYY-MM-DD` strings — compare them as strings, never construct a `Date` from one. "Today" comes from `toLocalYMD(new Date())`.
- No Monday board, column or group id anywhere.
- Do not touch any action, any other page, or anything under `src/components/ui/`.
