# 05 — AGENTS.md: document the PTO reconciliation files

## Files you may change

- `src/AGENTS.md` — documentation only

**No other file.** No code changes.

## Changes

1. In the `/pto` paragraph (the one beginning "`/pto` is one table"), replace it with:

   `/pto` is one table (`PtoTracker.tsx` → `pto/PtoTable.tsx`, `PtoRow.tsx`,
   `PtoBreakdown.tsx`); a row expands into pending Monday requests and the
   recorded ledger — **all statuses, withdrawn rows dimmed with Restore** —
   loaded by `loadPtoEmployeeDetail`, which also returns the employee's payroll
   `days` (date, event type, pay impact, cycle, has-punch). `PtoBreakdown`
   runs `lib/ptoPayrollMatch.ts` per request; `pto/PtoPayrollCell.tsx` renders
   the "In payroll" column (cycle names, off-row counts, first day off → actual
   return, calendar days for PTO / off rows for FH, ✓ or ⚠ against the request).
   `RecordApprovalDialog.tsx` has record / edit / manual modes, shows
   `pto/RecordDialogPayrollPanel.tsx` (Requested vs In payroll, "Use payroll
   dates"), refuses a return date after today, and auto-fills weekday count for
   floating holidays and calendar span for PTO. `recorded_by` is `'app'` for new
   rows. Dates on this page use `lib/fmtDay.ts` (`Mon Aug 17`, year only when
   not the current one). `fh_used` in `loadPtoBalancesInputs` is
   `GREATEST(pto_floating_holidays.fh_used, SUM(total_days))` — days, not records.

2. In the pure-modules list (where `attendanceReport.ts` is described), add two
   bullets right after it:

   - **`ptoPayrollMatch.ts`** — reconciles one PTO / floating-holiday request
     with `payroll_entries`. No imports; `spanDays` is injected. A day off is an
     unpunched leave-type row; the return is the first punched non-leave row;
     PTO days are calendar days (weekends count), FH days are off rows. 20
     tests in `tests/ptoPayrollMatch.test.ts`.
   - **`fmtDay.ts`** — weekday-first date display and `weekdayCount`, integer
     arithmetic only, no `Date`. 4 tests in `tests/fmtDay.test.ts`.

3. In the components list (where `StatusChip` / `DataTable` are described),
   add: `EmployeeSearchInput.tsx` — the global filter bar's employee box with
   name suggestions; writes the exact display name so page filters keep their
   substring match.

4. Add one line to the hard-constraints / SQL rules section:
   **A `{{params.x}}` is a value, never an operand.** `(({{params.year}}::int - 1)::text || '-12-01')`
   fails at runtime with "Unknown error" although the SQL runs by hand; compute
   such values in the browser and pass them as their own param.
