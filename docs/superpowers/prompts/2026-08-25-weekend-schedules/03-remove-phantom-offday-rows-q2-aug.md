# Prompt 35 — Soft-delete the phantom off-day rows in Q2-Aug-2026

Sent to UIB on 2026-08-25. One coherent change: one new migration.

**Background for the reviewer, not part of the prompt.** Four employees on
weekend schedules (ids 46, 49, 50, 51 → schedules 11, 10, 10, 12) were mis-
assigned to the Mon–Fri Standard schedule until 2026-08-25. The engine built
entries for their days off, found no punches, and classified them
`Ausencia Injustificada` / RED with a 420-minute discount each.

Tim re-processed Q2-Aug-2026 after the assignment, which correctly added their
Saturday and Sunday rows. But `upsertPayrollEntries` is insert-or-update and
never deletes, so the original off-day rows survived untouched. 18 of them
remain, worth 126 discount hours — 40% of the period's 310.7h total.

**Scope is Q2-Aug-2026 only, by the owner's decision.** Q2-Jul-2026 and
Q1-Aug-20260 are deliberately left alone: they are historical, and Edwin Broce's
weekend schedule only began 2026-08-10 (confirmed by Tim), so his Thursday and
Friday work in those earlier periods is real and must not be reclassified.

The 18 rows, verified in Payroll Master before writing this:

| Employee | Dates (all with no clock-in, all RED `Ausencia Injustificada`) |
|---|---|
| Cemiriamiz Iglesias | 08-11 Tue, 08-12 Wed, 08-18 Tue, 08-19 Wed |
| Euclides Gonzalez | 08-10 Mon, 08-11 Tue, 08-17 Mon, 08-18 Tue, 08-24 Mon |
| Michael A. Jones Roye | 08-10 Mon, 08-11 Tue, 08-17 Mon, 08-18 Tue, + 1 more |
| Edwin Broce | 08-13 Thu, 08-14 Fri, 08-20 Thu, 08-21 Fri |

---

## The prompt

Create one migration that soft-deletes the phantom off-day payroll entries in
period `Q2-Aug-2026` — rows on days the employee's schedule says they do not
work, which have no clock-in and were auto-classified as unjustified absences.

**Create exactly one new file:**
`src/migrations/1781900200_soft_delete_phantom_offday_rows_q2_aug.sql`

**Do not modify any other file.** No action, no page, no existing migration.

### What the migration must do

Soft-delete only — set `deleted_at` and `deleted_by`. **Never issue a hard
`DELETE` on `payroll_entries`.** The row must remain restorable from Period Log.

Wrap the whole thing in a `DO $$ ... $$` block that **counts the matching rows
first and raises an exception if the count is not exactly 18**, before updating
anything. If the count differs, something has changed since this was written and
the migration must abort rather than guess:

```sql
DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
  FROM payroll_entries pe
  JOIN employees e ON e.id = pe.employee_id
  LEFT JOIN schedules s ON s.id = e.schedule_id
  WHERE pe.period_name = 'Q2-Aug-2026'
    AND pe.deleted_at IS NULL
    AND NULLIF(TRIM(pe.entry_time), '') IS NULL
    AND NULLIF(TRIM(pe.exit_time), '')  IS NULL
    AND pe.event_type_1 = 'Ausencia Injustificada'
    AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
          [EXTRACT(ISODOW FROM LEFT(pe.work_date, 10)::date)::int]
        <> ALL (string_to_array(
              COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri'), ','));

  IF n <> 18 THEN
    RAISE EXCEPTION 'Expected exactly 18 phantom off-day rows in Q2-Aug-2026, found %. Aborting without changes.', n;
  END IF;

  UPDATE payroll_entries pe
  SET deleted_at = NOW(),
      deleted_by = 'migration-1781900200-weekend-offday-cleanup'
  FROM employees e
  LEFT JOIN schedules s ON s.id = e.schedule_id
  WHERE e.id = pe.employee_id
    AND pe.period_name = 'Q2-Aug-2026'
    AND pe.deleted_at IS NULL
    AND NULLIF(TRIM(pe.entry_time), '') IS NULL
    AND NULLIF(TRIM(pe.exit_time), '')  IS NULL
    AND pe.event_type_1 = 'Ausencia Injustificada'
    AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
          [EXTRACT(ISODOW FROM LEFT(pe.work_date, 10)::date)::int]
        <> ALL (string_to_array(
              COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri'), ','));

  RAISE NOTICE 'Soft-deleted % phantom off-day rows in Q2-Aug-2026.', n;
END $$;
```

Use that SQL as written. The predicate is deliberately narrow and every clause
is load-bearing:

- **`period_name = 'Q2-Aug-2026'`** — hardcoded on purpose. This is a one-off
  data repair for one period, not a general rule. Do **not** generalise it to
  all periods or parameterise it.
- **`deleted_at IS NULL`** — makes the migration idempotent and stops it
  re-stamping rows an operator already deleted.
- **`entry_time` and `exit_time` both empty** — the hard safety rail. A row with
  any clock-in represents real work and must never be removed by this migration,
  whatever the schedule says.
- **`event_type_1 = 'Ausencia Injustificada'`** — only auto-classified absences.
  Anything an operator has touched or that carries a form is left alone.
- **The day-of-week test** — the literal `Mon..Sun` array indexed by `ISODOW`,
  matching `DOW_ABBR` in `classificationEngine.ts` and migration `1781900100`.
  Do **not** use `TO_CHAR(work_date, 'Dy')`; it is `lc_time`-dependent.
- **`COALESCE(..., 'Mon,Tue,Wed,Thu,Fri')`** — an employee with no schedule
  keeps Mon–Fri semantics.

### Constraints

- **Timezone invariant.** `work_date` is TEXT in the form `2026-08-11 (Tue)`.
  Take the date with `LEFT(pe.work_date, 10)::date` exactly as above. No
  `AT TIME ZONE`, no `NOW()` for date maths, no `timestamptz`. `NOW()` appears
  only as the `deleted_at` stamp, which is correct.
- Do not touch `discount_total_minutes`, `status_current`, or any other column
  on these rows. Soft delete is the whole change; the discount stops counting
  because `loadHrkSummary` now filters `deleted_at IS NULL` (migration landed
  earlier today).
- Do not add an index, constraint, or trigger.
- Do not touch periods `Q2-Jul-2026` or `Q1-Aug-20260`.

### Acceptance criteria — observable outcomes

1. The migration applies without raising. If it raises the 18-row exception,
   stop and report the count it found — do not adjust the number to make it pass.
2. **HRK Summary for Q2-Aug-2026: Total Discount Hours falls from 310.7h to
   184.7h** (18 × 420 min = 126h). Employee count stays 45.
3. Per employee in that period: Cemiriamiz Iglesias 63.08 → 35.08, Euclides
   Gonzalez 35.18 → 0.18, Michael A. Jones Roye 36.68 → 1.68, Edwin Broce
   31.93 → 3.93.
4. Payroll Master for Q2-Aug-2026 no longer shows those 18 red rows, and each of
   the four still shows their Saturday and Sunday rows with real clock-ins.
5. Period Log lists the 18 deleted entries and can restore them.
6. HRK Summary for `Q2-Jul-2026` and `Q1-Aug-20260` is completely unchanged.

---

## After UIB reports done — our side

1. Export, sync, confirm the diff is one added migration plus the `applied.txt`
   line.
2. `node --test "tests/*.test.ts"` — 96 must pass.
3. **Load HRK Summary and Payroll Master.** Criterion 2 is the one that proves
   both this migration *and* prompt 34's `deleted_at` fix actually work. If the
   total does not move to 184.7h, the soft-delete filter is not doing its job and
   that must be investigated before anything is paid.
