Four live bugs in the PTO Tracker, all in SQL actions.

Files that may be modified: `src/actions/loadPtoEmployeeDetail.ts`, `src/actions/loadPtoBalancesInputs.ts`, `src/actions/loadPendingPtoRequests.ts`. No other file may change.

## Bug 1 — Withdraw makes a request vanish instead of returning it to pending

Recording a Monday request then withdrawing it leaves the employee showing "Nothing recorded or pending". The Monday request is real and still open, so it must come back as pending.

Cause: the pending aggregates exclude any Monday request that has *any* `pto_approvals` row. A withdrawn row still suppresses it, and the withdrawn row itself is hidden unless "Show withdrawn".

Fix: a withdrawn approval must not suppress its Monday request. In every place that joins `monday_requests` to `pto_approvals` to find unrecorded requests, add the status condition **to the join**, not the WHERE:

```sql
LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id AND a.status <> 'withdrawn'
...
AND a.id IS NULL
```

Apply this in all three files:
- `loadPtoEmployeeDetail.ts` — the `pending` aggregate.
- `loadPtoBalancesInputs.ts` — the `pending_count` sub-select.
- `loadPendingPtoRequests.ts` — its main query.

This is safe on re-record: `upsertPtoApproval` conflicts on `monday_item_id`, so recording it again updates the same withdrawn row back to `recorded` rather than inserting a duplicate. The audit trail is preserved either way — the withdrawn row is still there and still visible under "Show withdrawn".

## Bug 2 — a same-day leave shows "not in payroll yet" even when payroll has it

The payroll evidence sub-query uses `>= leave_on AND < return_on`. When someone records a one-day leave as `2026-05-29 -> 2026-05-29`, that range is empty and the column reads "not in payroll yet" even though payroll holds a row for that day.

Fix: make the upper bound at least one day after the start. In **both** payroll sub-queries in `loadPtoEmployeeDetail.ts` (the one in `ledger` and the one in `pending`), replace the upper bound:

```sql
AND LEFT(pe.work_date,10)::date <  GREATEST(a.return_on, a.leave_on + 1)
```

and in the pending one:

```sql
AND LEFT(pe.work_date,10)::date <  GREATEST(r.return_date, r.start_date + 1)
```

Leave the lower bound (`>= a.leave_on` / `>= r.start_date`) as it is.

## Bug 3 — WFH, Birthday and FH-used are 0 for everyone

The database has the data: Juan Fonseca has 64 WFH days in 2026, Alisha Dua 18, Luis Abad 24. The app shows 0 for every employee. Floating-holiday counts behave the same way — recording a floating holiday does not reduce "FH left".

Cause: the year comparisons compare a numeric `EXTRACT(YEAR FROM ...)` against `{{params.year}}`, which arrives as a string. Make every year comparison type-safe by casting both sides to text.

In `loadPtoBalancesInputs.ts`, change each of these:

- `fh_used`: `AND EXTRACT(YEAR FROM a.leave_on)::text = {{params.year}}::text`
- `wfh_days`: `AND EXTRACT(YEAR FROM r.start_date)::text = {{params.year}}::text`
- `birthday_days`: `AND EXTRACT(YEAR FROM r.start_date)::text = {{params.year}}::text`
- the floating-holiday join: `LEFT JOIN pto_floating_holidays fh ON fh.employee_id = e.id AND fh.calendar_year::text = {{params.year}}::text`

In `loadPtoEmployeeDetail.ts`, the `fh` aggregate's join the same way: `AND fh.calendar_year::text = {{params.year}}::text`.

## Bug 4 — one employee's WFH total comes back as NaN

`monday_requests.total_days_requested` holds a NaN for at least one row (Eddy Cedeno), and `GREATEST(1, NaN)` is NaN, which poisons the SUM.

In `loadPtoBalancesInputs.ts`, in the `wfh_days` sub-select, replace
`GREATEST(1, COALESCE(total_days_requested, 1))`
with
`GREATEST(1, COALESCE(NULLIF(r.total_days_requested, 'NaN'::numeric), 1))`

## Acceptance
- Recording a Monday request then withdrawing it puts that request back in the employee's list as **Pending** with a **Record** button, and the withdrawn row is still visible when "Show withdrawn" is ticked.
- A leave recorded as `2026-05-29 -> 2026-05-29` shows the payroll event types for 2026-05-29, not "not in payroll yet".
- Alisha Dua's WFH column reads 18, Juan Fonseca's 64, Luis Abad's 24.
- Recording a floating holiday reduces that employee's "FH left" by one.
- No employee's WFH reads NaN.

## Constraints
- `{{params.x}}` is never placed inside a quoted string.
- No Monday board, column or group id anywhere.
- Each file under 15 KB.
- Do not touch any page, any other action, or anything under `src/components/ui/`.
