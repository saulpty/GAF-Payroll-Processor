# 02b — loadPtoEmployeeDetail fails at runtime: move the date cutoff to a param

Expanding any employee on /pto now shows "Couldn't load details —
loadPtoEmployeeDetail" (console: `Can't execute loadPtoEmployeeDetail action:
Unknown error`). Running the SQL by hand succeeds; the action runtime rejects
the expression `(({{params.year}}::int - 1)::text || '-12-01')` in the `days`
sub-select. Do not compute dates from a parameter inside the query.

## Files you may change

- `src/actions/loadPtoEmployeeDetail.ts`
- `src/app/pages/pto/PtoBreakdown.tsx`

**No other file.**

## Change

1. In the action, replace
   `AND LEFT(pr.work_date, 10) >= (({{params.year}}::int - 1)::text || '-12-01')`
   with
   `AND LEFT(pr.work_date, 10) >= {{params.daysFrom}}`
   (`{{params.daysFrom}}` outside any quotes; it is a `YYYY-MM-DD` string).
2. In `PtoBreakdown.tsx`, pass the new param flat, next to the existing ones:
   `{ employee_id: row.employee_id, year, manager: null, daysFrom: `${Number(year) - 1}-12-01` }`.
   No `{ params: ... }` wrapper.

## Verify

Expanding Domingo Cruz renders the sub-table with the In-payroll column
populated (cycle names, `PTO ×2`, `Back …`). No console errors.
