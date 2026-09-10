# The period that was run twice: `Q1-Aug-2026` and `Q1-Aug-20260`

**Found 2026-09-09** by the PTO tracker's new In-payroll column: Gabriel Chu's
Jul 29–30 floating holiday listed *two* cycles, `Q1-Aug-2026, Q1-Aug-20260`.
Saul's period dropdown shows only `Q1-Aug-20260`.

## Probe (read-only, run 2026-09-10 through the UIB panel)

| | `Q1-Aug-2026` | `Q1-Aug-20260` |
|---|---|---|
| payroll rows | **205** | **437** |
| employees | 21 | 43 |
| work dates | Jul 26 → Aug 7 | Jul 26 → Aug 9 |
| soft-deleted | 0 | 0 |
| last update | 2026-08-10 18:23 | 2026-08-11 16:46 |
| `periods` row | **none** | Jul 26 → Aug 9, processed 2026-08-10 19:27, 43 employees, 15 days |
| `run_snapshots` | 3 | 9 |

Cross-check: **every one of the 205 orphan rows also exists under
`Q1-Aug-20260`** (`only_in_2026 = 0`); 232 rows exist only under `20260`;
**43 shared employee/day rows differ** in classification between the two
copies — the later run has newer outcomes.

## Reading

The period was first run as `Q1-Aug-2026` on Aug 10 at 18:23 and stopped part
way (21 of 43 employees, through Aug 7). It was then re-run about an hour
later under the typo'd name `Q1-Aug-20260`, completely. `upsertPeriod` is keyed
on `period_name`, so the second run created its own `periods` row; whatever
row the first run wrote is gone (or was never written because the run did not
reach that step). The first run's 205 payroll rows and 3 snapshots were left
behind, invisible to every page that joins through `periods`.

Nothing in the app could see this: `payroll_entries.period_name` has no
foreign key, the Payroll Master filters by the dropdown's names, and the
Attendance view groups by date, not period.

## Fix (needs Saul's go — it deletes rows)

1. `DELETE FROM payroll_entries WHERE period_name = 'Q1-Aug-2026'` — the 205
   orphan rows. A soft delete is not enough: the
   `UNIQUE (period_name, employee_id, work_date)` index includes soft-deleted
   rows, so the rename in step 3 would collide.
2. `DELETE FROM run_snapshots WHERE period_name = 'Q1-Aug-2026'` — the 3
   orphan snapshots.
3. Rename `Q1-Aug-20260` → `Q1-Aug-2026` in `periods`, `payroll_entries`,
   `run_snapshots`, `hrk_exports` (the same four statements as
   `src/actions/renamePeriod.ts`).

Expected after: `Q1-Aug-2026` with 437 rows, 43 employees, Jul 26 → Aug 9;
`20260` gone everywhere; Gabriel Chu Jul 29–30 lists one cycle.

## Prevention (built the same day)

`src/app/lib/periodName.ts` + three lines in `ProcessPayroll.tsx`: the name is
trimmed, must look like `Q1-Aug-2026`, and a near-miss of an existing name is
refused with *"looks like Q1-Aug-2026 — pick it from the re-run list"*. A
`NOT VALID` CHECK constraint on `periods.period_name` refuses badly shaped
names even if the UI is bypassed; the two legacy free-text names stay.
