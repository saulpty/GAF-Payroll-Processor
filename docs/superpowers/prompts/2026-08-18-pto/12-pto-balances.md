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

## Facts confirmed with the owner — build to these
- Headcount is 45: 44 on the Panama directory plus one onboarded who is not on
  it yet. So Balances should list roughly 43-45 rows, not hundreds. Everyone
  else on the Monday boards is a past employee.
- `pto_approvals` is currently **empty** — the historical ledger is imported in
  a later task. So Taken will be 0 and Available will equal Accrued for every
  employee on first load. That is expected, not a bug. Do not add placeholder
  or demo rows to make it look populated.
- Mirror/lookup columns on Monday return `text: null`; their value is in
  `display_value`. `colText` in `mondaySync.ts` already handles this. Do not
  reintroduce `.text` reads anywhere.

## Hard constraints for this task
- No Monday board or column id may appear in any file you create. Tests H4 and
  H5 in `tests/hardcoding.test.ts` fail the suite if one does.
- `PtoTracker.tsx` stays under 8 KB and each tab component under 15 KB. If
  Balances would exceed that, split the table row into its own component file
  under `src/app/pages/pto/`.
- Dates are `YYYY-MM-DD` strings throughout. Never construct a `Date` to do date
  arithmetic on them — `ptoAccrual.ts` already does the arithmetic correctly and
  is covered by tests that pin it to the owner's spreadsheet.
