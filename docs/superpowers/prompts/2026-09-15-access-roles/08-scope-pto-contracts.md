# 08 — Managers see only their own employees on PTO Tracker and Contracts (and in the badges)

## Files that may change

- `src/actions/loadPtoBalancesInputs.ts`
- `src/actions/loadPtoEmployeeDetail.ts`
- `src/actions/loadPtoReviewCount.ts`
- `src/actions/loadPendingPtoRequests.ts`
- `src/actions/loadContractMilestones.ts`
- `src/actions/loadContractsExpiringCount.ts`
- `src/app/pages/pto/PtoTable.tsx` — one import, one hook line, one call site
- `src/app/pages/pto/PtoBreakdown.tsx` — one import, one hook line, one call site
- `src/app/pages/contracts/ContractsTable.tsx` — one import, one hook line, one call site
- `src/app/TopNav.tsx` — two call sites and one line in `sectionBadge`

No other file may be touched. Do not reformat. Do not change any other SQL line,
any accrual or tenure calculation, or any date handling. No time or date value
is changed; timezone invariant unaffected.

## Why

Same rule as the Attendance round: filter in SQL through `v_employee_access`
with `access_viewer({{ user.email }}, {{params.viewAs}}::text)`. Super users
still see everyone. The existing `manager` name filters stay.

## 1. Actions — add lines, keep every existing line

The clause, written `SCOPE(x)` below, is:
```sql
x IN (SELECT a.employee_id FROM public.v_employee_access a
       WHERE a.email = access_viewer({{ user.email }}, {{params.viewAs}}::text))
```
Write it out in full each time. `{{params.viewAs}}` is never inside quotes.

- **`loadPtoBalancesInputs.ts`**: after the `manager` line in the outer `WHERE`, add `AND SCOPE(e.id)`.
- **`loadPtoReviewCount.ts`**: after the `manager` line, add `AND SCOPE(e.id)`.
- **`loadPendingPtoRequests.ts`**: after the `manager` line, add `AND SCOPE(r.employee_id)`.
- **`loadContractMilestones.ts`**: after the `manager` line, add `AND SCOPE(e.id)`.
- **`loadContractsExpiringCount.ts`**: in the outer `WHERE e.active = true`, add `AND SCOPE(e.id)` on the next line.
- **`loadPtoEmployeeDetail.ts`**: this action has several parts. In **every**
  `WHERE` that filters by `{{params.employee_id}}` (requests, approvals, the
  employee row, payroll days), add on the next line
  `AND SCOPE({{params.employee_id}}::bigint)`.

## 2. Call sites — pass `viewAs`, flat

In `PtoTable.tsx`, `PtoBreakdown.tsx` and `ContractsTable.tsx` add
`import { useViewer } from '@/app/context/ViewerContext';` and
`const { viewAs } = useViewer();` next to the existing `useGlobalFilters()` call.

- `PtoTable.tsx`: `{ year, manager: manager || null, today }` → `{ year, manager: manager || null, today, viewAs }`.
- `PtoBreakdown.tsx`: `{ employee_id: row.employee_id, year, manager: null, daysFrom: … }` gains `, viewAs` (keep `daysFrom` exactly as it is).
- `ContractsTable.tsx`: the `loadContractMilestonesAction` params gain `, viewAs`.

`TopNav.tsx` already calls `useViewer()`; add `viewAs` to that destructuring, then:
- `useLoadAction(loadContractsExpiringCountAction, [] as { count: number }[])` gains a third argument `{ viewAs }`.
- `{ today: asOf, manager: null }` for `loadPtoReviewCountAction` → `{ today: asOf, manager: null, viewAs }`.
- In `sectionBadge`, replace `if (!isSuper) return null;` with
  `if (!isSuper && id === 'disciplinary') return null;` (Contracts and PTO badges
  are now scoped; Disciplinary is scoped in a later round).

Never wrap params as `{ params: { … } }`.

## Acceptance — run and paste raw results

1. Run each of the six actions with its page's parameters plus `viewAs: ''` and
   report row counts (`loadContractMilestones` must equal the count before this
   change).
2. Run `loadPtoBalancesInputs` and `loadContractMilestones` with
   `viewAs: 'nobody@example.com'` → 0 rows; the two count actions → 0.
3. Lint clean. Report the byte size of `TopNav.tsx`.
4. Then confirm every identifier used in each changed file is imported, in
   particular `useViewer`.

Do not build anything else. Do not offer to scope other pages.
