Show, on each PTO/floating-holiday subitem, what payroll actually recorded on those days — so nobody has to go to the Payroll section to cross-check. Plus four small clean-ups.

Files that may be modified: `src/actions/loadPtoEmployeeDetail.ts`, `src/app/pages/pto/PtoSubRow.tsx`, `src/app/pages/pto/PtoBreakdown.tsx`, `src/app/pages/pto/PtoTable.tsx`, `src/app/pages/PtoTracker.tsx`. No other file may change.

## 1. `loadPtoEmployeeDetail.ts` — add payroll evidence to both aggregates

A leave row covers the days from `leave_on` up to but not including `return_on` (the return day is the day back at work). For each item, summarise the `payroll_entries` event types on those days.

Add to the **ledger** `json_build_object`:

```sql
'payroll', (
  SELECT string_agg(x.t || ' x' || x.c, ', ' ORDER BY x.c DESC, x.t)
  FROM (
    SELECT COALESCE(NULLIF(TRIM(pe.event_type_1),''), 'no event') AS t, count(*) AS c
    FROM payroll_entries pe
    WHERE pe.employee_id = a.employee_id
      AND LEFT(pe.work_date,10)::date >= a.leave_on
      AND LEFT(pe.work_date,10)::date <  a.return_on
    GROUP BY 1
  ) x
)
```

Add the same to the **pending** `json_build_object`, but keyed off the Monday request's columns — `pe.employee_id = r.employee_id`, `>= r.start_date`, `< r.return_date`.

Nothing else in the file changes.

## 2. `PtoSubRow.tsx` — a new "In payroll" column

Add a column between **Source** and **Comments**, header `In payroll`.

- When `payroll` is null or empty: muted 12px `not in payroll yet`.
- Otherwise: the string in 12px, e.g. `PTO x4` or `PTO x2, Tardanza x1`, with the full value in a `title` attribute so a long list is readable on hover.

This is the whole point of the column: if someone requested 12-07 → 12-11 and payroll shows `PTO x4`, they took the days they asked for; if it shows `Tardanza x1, no event x3` or `not in payroll yet`, it did not happen as requested.

Add the matching `payroll?: string | null` field to the `SubItem` type.

## 3. `PtoBreakdown.tsx` — drop the summary line, add a retry

- **Delete the summary line** above the table (`{n} PTO days taken · {n} of {n} floating holidays used`). It repeats the Taken and FH-left columns on the employee row.
- Carry `payroll` through from the loaded detail into each `SubItem`.
- On the error line, keep the text `Couldn't load details — loadPtoEmployeeDetail` and add next to it a small outline `Button size="sm"` labelled **Retry** that re-runs the load. (A transient database blip should not need a page reload.)

## 4. `PtoTable.tsx` — remove the page search box

Delete the `Search name or title` input, its state, its debounce and the `matchesSearch` filter and import. The global **EMPLOYEE** filter in the top filter bar already does this. Keep **Only with pending** and **Show withdrawn** exactly as they are.

Move the count caption out of this component: instead of rendering `{n} employees · {p} pending` here, call a new optional prop `onCountsChange?: (counts: { employees: number; pending: number }) => void` whenever the filtered rows change.

## 5. `PtoTracker.tsx` — counts move up to the As-of line

Receive the counts from `PtoTable` and render them in the `PageHeader` actions row, immediately to the left of **As of**, as a 12px muted caption:

`{employees} employees · {pending} requests to record`

("pending" on its own did not say what it counted; these are Monday requests — PTO and floating holidays — not yet recorded or withdrawn.)

## Constraints
- Every file under 15 KB.
- `{{params.x}}` never inside a quoted string.
- Dates stay `YYYY-MM-DD` strings in logic; only `fmtDate` changes how they look. No `new Date(...)` on a date string.
- No Monday board, column or group id anywhere.
- Do not touch any other action, the dialog, or anything under `src/components/ui/`.
