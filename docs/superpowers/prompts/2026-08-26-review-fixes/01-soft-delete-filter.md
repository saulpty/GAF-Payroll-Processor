# Ignore soft-deleted payroll entries in every action that reads them

`payroll_entries` has a `deleted_at` column (migration `1781402100`). A deleted
row is marked, never removed. Some actions filter it out and some do not, so the
same period reports two different totals depending on which screen you open.

Measured on `Q2-Aug-2026`, 2026-08-26: the Summary Dashboard reports **308.2**
discount hours while HRK Summary reports **182.2** for the same period. The
126.0-hour difference is exactly the 18 rows soft-deleted by migration
`1781900200`. `loadHrkSummary` filters `deleted_at IS NULL`; the actions below do
not.

## Change

Add a `deleted_at IS NULL` condition to the `payroll_entries` read in each of
these eight files, and change nothing else in them.

1. **`src/actions/loadSummaryDashboard.ts`** — in the `WHERE` clause, after
   `pe.period_name = {{params.periodName}}`, add `AND pe.deleted_at IS NULL`.
2. **`src/actions/loadSummaryAllPeriods.ts`** — the query has no `WHERE` clause
   at all. Add one between the `LEFT JOIN periods …` line and the `GROUP BY`
   line: `WHERE pe.deleted_at IS NULL`.
3. **`src/actions/loadActionRequired.ts`** — after `AND pe.payroll_ready = 'NO'`,
   add `AND pe.deleted_at IS NULL`.
4. **`src/actions/loadCommittedEntries.ts`** — after
   `AND pe.payroll_ready = 'YES'`, add `AND pe.deleted_at IS NULL`.
5. **`src/actions/loadUnresolvedCount.ts`** — the table is unaliased. After
   `AND payroll_ready = 'NO'`, add `AND deleted_at IS NULL`.
6. **`src/actions/loadUnresolvedPerPeriod.ts`** — unaliased. After
   `AND payroll_ready = 'NO'`, add `AND deleted_at IS NULL`.
7. **`src/actions/loadActionRequiredCounts.ts`** — unaliased. Add
   `AND deleted_at IS NULL` to the `WHERE` clause. **Also**, in the same clause,
   change `({{params.periodName}} = '' OR period_name = {{params.periodName}})`
   to `(COALESCE({{params.periodName}}, '') = '' OR period_name = {{params.periodName}})`.
   Four sibling actions already use this `COALESCE` form —
   `countPayrollMaster.ts`, `loadPayrollMaster.ts`, `loadDeletedEntries.ts` and
   `loadAttendanceDaily.ts`. Without it, a NULL parameter makes the whole `WHERE`
   match nothing and the counts silently vanish.
8. **`src/actions/loadPtoEmployeeDetail.ts`** — there are **two** identical
   `payroll_entries` sub-selects, one inside the `pending` block and one inside
   the block after it. In **both**, after the
   `AND LEFT(pe.work_date,10)::date < GREATEST(...)` line, add
   `AND pe.deleted_at IS NULL`.

## Do not touch

- `src/actions/loadDeletedEntries.ts` — it deliberately selects
  `deleted_at IS NOT NULL`. It is correct as it stands.
- `src/actions/loadHrkSummary.ts`, `loadPayrollMaster.ts`,
  `countPayrollMaster.ts` — they already filter correctly.
- Any view or migration. `v_attendance_daily` has the same gap and is being
  handled in a separate change.
- **No other file may be touched.** Do not reformat the SQL, do not rename
  columns, do not reorder conditions, and do not change any other part of these
  queries. Each of these files should show a diff of one added line, except
  `loadActionRequiredCounts.ts` (one added line plus the `COALESCE` edit) and
  `loadPtoEmployeeDetail.ts` (two added lines).

## Acceptance criteria

> **The discount-hours figures above are historical.** Between measuring them
> and writing this prompt, an operator resolved roughly 18 entries in Action
> Required — `Committed to GREEN` moved 58 → 74 and the nav badge 91 → 73 — which
> zeroed those rows' discounts. The Dashboard now reads 182.2h for
> `Q2-Aug-2026` **without this fix**. Do not use 308.2 → 182.2 as the test; the
> number moved for an unrelated reason. The defect itself is unchanged and still
> visible in the first criterion below.

- On Action Required for `Q2-Aug-2026`, **Cemiriamiz Iglesias no longer appears
  on 2026-08-11, 08-12, 08-18 or 08-19.** Those four rows are listed under
  Period Log → Deleted Items, deleted by
  `migration-1781900200-weekend-offday-cleanup`, yet they still render in the
  queue today — verified 2026-08-26. Her rows on 08-14, 08-15, 08-16 and 08-24
  are genuine and must still appear.
- Dashboard `DISCOUNT HOURS` for `Q2-Aug-2026` still equals HRK Summary's
  `Total Discount Hours` for the same period. Record both numbers immediately
  before the change and confirm they are unchanged by it, rather than expecting
  a specific value.
- The RED and YELLOW tab counts on Action Required still render for both a
  selected period and "All periods". They must not disappear.
- Period Log → Deleted Items still lists all 20 deleted rows and they can still
  be restored.
- Payroll Master and HRK Summary figures for `Q2-Aug-2026` are unchanged.

Then confirm every identifier used in each file is imported.
