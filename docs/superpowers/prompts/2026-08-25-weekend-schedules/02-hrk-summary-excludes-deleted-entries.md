# Prompt 34 — HRK Summary must exclude soft-deleted payroll entries

Sent to UIB on 2026-08-25. One coherent change: `loadHrkSummary.ts` only.

**Background for the reviewer, not part of the prompt.** Deletes on
`payroll_entries` are soft (`deleted_at`, `deleted_by`, migration `1781402100`).
`loadPayrollMaster.ts:15` and `countPayrollMaster.ts:11` both filter
`pe.deleted_at IS NULL`. `loadHrkSummary.ts` does not filter it anywhere — so a
row deleted by an operator disappears from Payroll Master while still counting
toward `total_discount_hours`, `pto_days`, `incapacidad_days` and
`constancia_hours` in the HRK export, which is the number that reaches payroll.

Found while cleaning up four weekend-schedule employees who had ~141 hours of
phantom absence discount between them in Q2-Aug-2026. Deleting those rows would
have looked like it worked and changed none of the money. The bug is
independent of that cleanup and applies to every operator delete ever made.

---

## The prompt

`src/actions/loadHrkSummary.ts` reads `payroll_entries` but never excludes
soft-deleted rows, so entries an operator has deleted still count toward the
HRK export totals. Add that filter.

**Modify exactly one file:** `src/actions/loadHrkSummary.ts`

**Do not modify any other file.** In particular do not touch
`src/actions/loadPayrollMaster.ts`, `src/actions/countPayrollMaster.ts`,
`src/actions/softDeletePayrollEntry.ts`, `src/app/pages/HrkSummary.tsx`, or any
migration.

### The change

There are exactly three places in the query that read `payroll_entries`
directly. Add `AND pe.deleted_at IS NULL` to the `WHERE` clause of each:

1. **`pto_raw`** (around line 36-43) — currently
   `WHERE pe.period_name = {{params.periodName}} AND pe.event_type_1 = 'PTO'`.
2. **`entries_filtered`** (around line 65-73) — currently filters on
   `pe.period_name` and the hire-date `GREATEST(...)` comparison.
3. **The `pe_exists` sub-select** in the final `FROM` clause (around line
   216) — `SELECT DISTINCT employee_id FROM payroll_entries WHERE period_name =
   {{params.periodName}}`. This one decides which employees appear in the export
   at all. Note it has no table alias, so write `deleted_at IS NULL` there
   rather than `pe.deleted_at IS NULL`.

Every other CTE — `entries_with_constancia`, `discount_agg`, `incapacidad_agg`,
`constancia_agg`, `notes_agg` — reads from `entries_filtered` or
`entries_with_constancia`, so they inherit the filter and must **not** be
changed.

### Constraints

- **Change nothing else in the query.** Do not touch the `base_hours`
  calculation, the `EXTRACT(DOW FROM d) BETWEEN 1 AND 6` test, the Friday PTO
  weekend expansion, the Constancia regex parsing, or any aggregate. Those are
  under separate review and must not move in this change.
- **Match the existing pattern exactly.** `loadPayrollMaster.ts:15` already
  writes `pe.deleted_at IS NULL`. Use the same form.
- Do not add a parameter, an option, or a way to include deleted rows. They are
  always excluded.
- The output column list must not change.

### Acceptance criteria — observable outcomes

1. HRK Summary for a period with no deleted entries shows **identical** numbers
   to before this change — same employee count, same Base Hrs, Worked Hrs,
   Discount Hrs, PTO Days for every row.
2. Deleting a payroll entry that carries discount minutes, then reloading HRK
   Summary, reduces that employee's Discount Hrs and the period's Total Discount
   Hours. Before this change it did not.
3. Restoring that entry from Period Log puts the hours back.
4. An employee whose every entry in a period is deleted drops out of the export
   entirely, rather than appearing with zeroes.
5. The HRK Summary page loads with no runtime error.

---

## After UIB reports done — our side

1. Export, sync, confirm the diff is **one file**.
2. `node --test "tests/*.test.ts"` — 96 must pass.
3. **Load HRK Summary.** Mandatory — this is an `src/actions/` change. Check
   criterion 1 first against Q2-Aug-2026: 45 employees, Total Discount Hours
   291.3h, Cemiriamiz Iglesias 42.1, Euclides Gonzalez 35.0, Michael A. Jones
   Roye 36.27, Edwin Broce 28.12. Those must be unchanged, because nothing is
   deleted yet.
4. Only after this lands is it safe to delete the phantom weekend rows and
   expect the money to move.
