# 03 — Payroll: remove the Dashboard, start on Payroll Master

## Files you may change

- `src/app/TopNav.tsx`
- `src/app/app.tsx`
- `src/app/FilterBar.tsx`
- `src/AGENTS.md` — the routes table only
- **Delete:** `src/app/pages/SummaryDashboard.tsx`,
  `src/actions/loadSummaryDashboard.ts`, `src/actions/loadSummaryAllPeriods.ts`
  (both actions are used only by that page — check with a grep before deleting).

**No other file may be touched.** Do not edit `ProcessPayroll.tsx`,
`PayrollMaster.tsx`, `ActionRequired.tsx`, `HrkSummary.tsx` or `PeriodLog.tsx`.

## TopNav.tsx

In `SECTIONS`, the `payroll` entry:
- `home: '/payroll-master'`
- `paths`: remove `'/summary'`
- `links`, in this order: Payroll Master (`/payroll-master`, `TableIcon`),
  Process (`/process`, `PlayCircle`), Action Required (`/action-required`,
  `AlertTriangle`, `badge: true`), HRK Summary (`/hrk-summary`,
  `FileSpreadsheet`), Period Log (`/period-log`, `History`).
- The brand block's `onClick={() => navigate('/summary')}` becomes
  `navigate('/payroll-master')`.
- Remove the `BarChart2` import if nothing else uses it.

## app.tsx

- `/` redirects to `/payroll-master`.
- Remove the `/summary` route and the `SummaryDashboard` import.

## FilterBar.tsx

Remove the `'/summary'` entry from `ROUTE_CONFIG`. Nothing else.

## AGENTS.md

In the routes table: `/` → `/payroll-master`; delete the `/summary` row.

## Verify

- Opening the app lands on Payroll Master. The Payroll sub-nav reads
  Payroll Master · Process · Action Required · HRK Summary · Period Log.
- `/summary` no longer exists. No console errors on `/payroll-master`, `/process`.
- Only the listed files changed or were deleted. Confirm every identifier used in
  each edited file is still imported — removing an import that is still used has
  crashed this app before.
