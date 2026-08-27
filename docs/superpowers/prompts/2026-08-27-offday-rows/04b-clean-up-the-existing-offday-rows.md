# Soft-delete the 10 phantom off-day rows in Q2-Aug-2026

**One file: a new migration,
`src/migrations/1781986600_soft_delete_offday_rows_q2_aug_2026.sql`.**
No other file may be touched — not the engine, not a page, not an action.

## What these rows are

The engine was corrected earlier today so it can no longer create them, but
`upsertPayrollEntries` never deletes, so the ones already written survive. A
count run against the live database a few minutes ago found **exactly 10** in
`Q2-Aug-2026`, from four employees, all on Saturday 2026-08-22 and Sunday
2026-08-23 — days none of them work:

| Employee | Dates | event_type_1 | discount |
|---|---|---|---|
| Elizabeth Mootoo | 08-22, 08-23 | PTO | 0 |
| Juan Fonseca | 08-22, 08-23 | Permiso Remunerado | 0 |
| Tanya Bedoya | 08-22, 08-23 | PTO | 0 |
| Ulla Hees | 08-22, 08-23 | (none) | 0 |

Each came from a permission whose date range spanned the weekend. Every one
carries a zero discount, so **no money changes**. Eight of the ten had already
been resolved by the operator, which is the wasted work this removes.

**Only `Q2-Aug-2026`.** Five earlier periods hold 60 more such rows; those
periods have already been paid and are deliberately left alone.

## The migration

Model it directly on
`src/migrations/1781900200_soft_delete_phantom_offday_rows_q2_aug.sql`, which is
the proven pattern here — count first inside a `DO $$` block, `RAISE EXCEPTION`
unless the count is exactly what was measured, then soft-delete. That makes the
file safe to run twice and impossible to run against a database it does not fit.

Two differences from `1781900200`, both deliberate:

- **It must not filter on `event_type_1`.** `1781900200` required
  `Ausencia Injustificada`. Six of these ten are `PTO` or
  `Permiso Remunerado`, and two have no event type at all, so that filter would
  miss them.
- **The expected count is 10**, not 18.

The predicate — reuse it verbatim from `1781900200:24-32`, only dropping the
`event_type_1` condition:

```sql
  WHERE e.id = pe.employee_id
    AND pe.period_name = 'Q2-Aug-2026'
    AND pe.deleted_at IS NULL
    AND NULLIF(TRIM(pe.entry_time), '') IS NULL
    AND NULLIF(TRIM(pe.exit_time), '')  IS NULL
    AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
          [EXTRACT(ISODOW FROM LEFT(pe.work_date, 10)::date)::int]
        <> ALL (string_to_array(
              COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri'), ','));
```

Requirements:

- Both `entry_time` **and** `exit_time` must be empty, so a row holding real
  punch data can never be caught. This is the single most important guard.
- `LEFT(pe.work_date, 10)::date` — `work_date` is stored as
  `2026-08-22 (Sat)`, not a bare date.
- The literal `Mon..Sun` array indexed by `EXTRACT(ISODOW …)`. **Never
  `TO_CHAR(work_date, 'Dy')`** — it depends on `lc_time`.
- `LEFT JOIN schedules s ON s.id = e.schedule_id`, with the `COALESCE` fallback,
  because an employee with no schedule has NULL `work_days`.
- Soft delete only: `SET deleted_at = NOW(), deleted_by =
  'migration-1781986600-offday-form-rows-q2-aug'`. **Never `DELETE FROM`.**
- A header comment describing *this* change accurately, including a Rollback
  line naming *this* file. (`1781900300`'s header was copied from another
  migration and still describes the wrong change — do not repeat that.)

## Do not touch

- **No other file**, and no other migration.
- Do not touch any period other than `Q2-Aug-2026`.
- Do not restore, alter or renumber anything in `applied.txt` by hand.
- Do not change `entry_time`, `exit_time`, `discount_total_minutes`,
  `payroll_ready`, `status_current` or any other column — only `deleted_at` and
  `deleted_by`.

## Acceptance criteria

- Running it soft-deletes exactly 10 rows, and raises an exception rather than
  deleting anything if the count is not 10.
- Running it a second time is safe.
- Action Required on `Q2-Aug-2026` no longer shows Ulla Hees on 2026-08-22 or
  2026-08-23.
- Period Log → Deleted Entries lists all 10, attributed to
  `migration-1781986600-offday-form-rows-q2-aug`, and they can be restored.
- No row with a real entry or exit time is affected.

Then confirm the SQL references only columns that exist on `payroll_entries`,
`employees` and `schedules`.
