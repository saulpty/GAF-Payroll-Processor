# 07 — Review vs waiting counts, and a global review count for the nav badge

"Pending" on the PTO tracker is being renamed **Review**: a Monday request
counts only when it can actually be recorded — its return date has passed
**and** payroll has been processed through that date. Everything else is
"waiting" (future, or payroll not run yet). Requests whose return date is
before their leave date are never counted (they are broken on the board).

## Files you may change

- `src/actions/loadPtoBalancesInputs.ts`
- `src/actions/loadPtoReviewCount.ts` — **new**
- `src/app/pages/pto/PtoTable.tsx` — only to pass the new `today` param (§3)

**No other file.** `{{params.x}}` is a value, never an operand — never put a
parameter inside arithmetic or string concatenation in SQL, and never inside
a quoted string. Params to `useLoadAction` go flat.

## 1. `loadPtoBalancesInputs.ts`

Replace the `pending_count` sub-select with two columns. Both use a new flat
param `today` (a `YYYY-MM-DD` string) and the last processed payroll date:

```sql
             (SELECT count(*) FROM monday_requests r
               LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
               WHERE r.employee_id = e.id AND r.request_type IN ('PTO / Vacation','Floating Holiday')
                 AND r.deleted_on_monday = false AND a.id IS NULL
                 AND r.return_date >= r.start_date
                 AND r.return_date <= {{params.today}}::date
                 AND r.return_date <= (SELECT MAX(p.end_date) FROM periods p WHERE p.processed_at IS NOT NULL)) AS review_count,
             (SELECT count(*) FROM monday_requests r
               LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
               WHERE r.employee_id = e.id AND r.request_type IN ('PTO / Vacation','Floating Holiday')
                 AND r.deleted_on_monday = false AND a.id IS NULL
                 AND NOT (r.return_date >= r.start_date
                          AND r.return_date <= {{params.today}}::date
                          AND r.return_date <= (SELECT MAX(p.end_date) FROM periods p WHERE p.processed_at IS NOT NULL))) AS waiting_count,
```

(`{{params.today}}::date` — a cast on the parameter alone is fine; the failing
pattern was arithmetic on it.)

## 2. `loadPtoReviewCount.ts` — new

Same shape as `src/actions/loadDisciplinaryDueCount.ts` but on the
`'GAF Planilla DB'` datasource. Params: `today` (required), `manager`
(optional, the usual `({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})`).

```sql
SELECT COUNT(*)::int AS count
FROM monday_requests r
JOIN employees e ON e.id = r.employee_id AND e.active = true
LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
WHERE r.request_type IN ('PTO / Vacation','Floating Holiday')
  AND r.deleted_on_monday = false AND a.id IS NULL
  AND r.return_date >= r.start_date
  AND r.return_date <= {{params.today}}::date
  AND r.return_date <= (SELECT MAX(p.end_date) FROM periods p WHERE p.processed_at IS NOT NULL)
  AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
```

## 3. `PtoTable.tsx`

Only this: the `loadPtoBalancesInputs` call passes `today` (the prop it
already receives): `{ year, manager: manager || null, today }`. `RawRow`
gains `review_count` and `waiting_count` (number | string) and keeps
`pending_count` **for now** mapped as `pending: Number(r.review_count) || 0`
so the page keeps working until prompt 08 renames the column. Do not touch
anything else in the file.

## Acceptance

1. In the runner, `loadPtoBalancesInputs` with `year = '2026'`, `today =
   '2026-09-10'`, `manager = null`: Arelis Acosta `review_count 0 /
   waiting_count 1`; Ulla Hees `review_count 2 / waiting_count 2` (her two
   August requests are covered by payroll through Aug 24; the Aug 31 one and
   nothing else are not — report what you get, do not force it).
2. `loadPtoReviewCount` with the same `today` and `manager = null` equals the
   sum of `review_count` over all rows.
3. `/pto` renders; the Pending chips now show only the recordable ones.
4. Only the three files above changed; tests still green.
