# 09 — Payroll Master shows every period when "All periods" is selected

Saul's explicit request (2026-09-10) to edit `PayrollMaster.tsx`. Both actions
(`loadPayrollMaster`, `countPayrollMaster`) already handle an empty period; only
the page refuses.

## Files you may change

- `src/app/pages/PayrollMaster.tsx` — the smallest possible edit; do not
  restructure, rename or reformat anything else in this 42 KB file

**No other file may be touched.** No action changes.

## Change

1. Remove `hasPeriod` and the `{ enabled: hasPeriod }` option from both
   `useLoadAction` calls — they always run.
2. Delete the `if (!hasPeriod) { return (… "Select a Period" …) }` early return.
3. Add a **Period** column, only when `params.periodName === ''`: a header
   `<Th col="period_name" label="Period" style={{ width: 120, minWidth: 120 }} />`
   right after the *Date* header (add `'period_name'` to the sort key type if it
   is a literal union), and in each row a
   `<td className="px-2 py-1.5 border-r whitespace-nowrap text-slate-600">{row.period_name}</td>`
   in the same position. The sticky left offsets are unaffected because the
   column sits after the sticky group.
4. The page counter already reads "Page N of M (X total rows)" — unchanged; 500
   rows per page across all periods is expected.

## Verify

- Period = *All periods* on `/payroll-master`: rows from all periods load,
  newest period first, with a Period column; the pager shows the true total.
- Picking one period: identical to before, no Period column. Deep links
  `/payroll-master?period=…` from Period Log still work.
- Save/Delete on a row still works.
- Only this file changed. Confirm every identifier used is imported.
