# Prompt 37 — PTO day expansion must follow each employee's own days off

Sent to UIB on 2026-08-25. One coherent change: `loadHrkSummary.ts` only.

**Background for the reviewer, not part of the prompt.** `pto_raw` collects
payroll entries where `event_type_1 = 'PTO'`. Those rows only exist on an
employee's working days. The PTO ledger counts leave in *calendar* days
(`ptoAccrual.defaultTotalDays`), so the query pads a Friday PTO day with the
following Saturday and Sunday to reconcile the two.

That padding hardcodes `EXTRACT(DOW) = 5`. For an employee who works Wed–Sun,
Friday is a working day and Saturday and Sunday are too — their days off are
Monday and Tuesday. So the wrong days get appended, and the right ones never do.

**This is reporting-only.** `total_worked_hours` is
`base − discount − incapacidad − constancia`; PTO is not subtracted. Only the
`pto_days` and `pto_dates` columns of the HRK export are affected. Nobody's pay
changes.

Audited first: this is the *only* remaining PTO defect for weekend employees.
Every other piece of PTO code — all `loadPto*` / `upsertPto*` / `updatePto*`
actions, `ptoAccrual.ts`, and all five components under `src/app/pages/pto/` —
contains no day-of-week logic at all and is therefore already schedule-agnostic.

---

## The prompt

In `src/actions/loadHrkSummary.ts`, the PTO day count pads a Friday PTO entry
with the following Saturday and Sunday. That hardcodes a Monday–Friday week.
Make it follow each employee's own non-working days instead.

**Modify exactly one file:** `src/actions/loadHrkSummary.ts`
**Do not modify any other file.**

### The change

**1. Give `pto_raw` the employee's working days.** It currently selects only
`employee_id` and the parsed date from `payroll_entries`. Join through to the
schedule and add a `work_days` column:

```sql
JOIN employees e ON e.id = pe.employee_id
LEFT JOIN schedules s ON s.id = e.schedule_id
```

selecting `COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri') AS work_days`.
Keep its existing `WHERE` conditions — `period_name`, `event_type_1 = 'PTO'`,
and `deleted_at IS NULL` — exactly as they are.

**2. Replace the two Friday-hardcoded branches of `pto_with_weekends`.** They
currently read:

```sql
WHERE EXTRACT(DOW FROM pr.pto_date) = 5 AND pr.pto_date + 1 <= pb.end_date::date
...
WHERE EXTRACT(DOW FROM pr.pto_date) = 5 AND pr.pto_date + 2 <= pb.end_date::date
```

The `+ 1` branch must instead include the next day only when that day is **not**
a working day for this employee:

```sql
WHERE pr.pto_date + 1 <= pb.end_date::date
  AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
        [EXTRACT(ISODOW FROM pr.pto_date + 1)::int]
      <> ALL (string_to_array(pr.work_days, ','))
```

The `+ 2` branch must require that **both** the next day and the day after are
non-working, so a run of days off is only extended while it is unbroken:

```sql
WHERE pr.pto_date + 2 <= pb.end_date::date
  AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
        [EXTRACT(ISODOW FROM pr.pto_date + 1)::int]
      <> ALL (string_to_array(pr.work_days, ','))
  AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
        [EXTRACT(ISODOW FROM pr.pto_date + 2)::int]
      <> ALL (string_to_array(pr.work_days, ','))
```

Rename the CTE from `pto_with_weekends` to `pto_with_offdays` and update the one
reference to it in `pto_agg`. "Weekend" is no longer the right word — for these
employees the days off are mid-week.

### Constraints

- **Use the literal `Mon..Sun` array indexed by `ISODOW`.** Do not use
  `TO_CHAR(date, 'Dy')` — locale-dependent. This array matches `DOW_ABBR` in
  `classificationEngine.ts` and migrations `1781900100` / `1781900200`.
- **Behaviour for Mon–Fri employees must be identical.** For them the next day
  after a Friday is Saturday (not a working day → included) and the day after is
  Sunday (also not working → included); a PTO day on any other weekday is
  followed by a working day, so nothing is appended. That is exactly what the
  current code does.
- **Change nothing else in this file.** Specifically do not touch `base_hours`
  and its `EXTRACT(DOW FROM d) BETWEEN 1 AND 6` — that is the paid-rest-day rule
  and has been confirmed correct by the owner. Do not touch the Constancia regex
  parsing, `discount_agg`, `incapacidad_agg`, `notes_agg`, the `deleted_at`
  filters added earlier today, or the final `SELECT` list.
- **Timezone invariant.** All arithmetic here is on `date` values already derived
  by `TO_DATE(SUBSTRING(...))`. No `AT TIME ZONE`, no `NOW()`, no `timestamptz`.
- The output column list must not change.

### Acceptance criteria — observable outcomes

1. HRK Summary for a period is **unchanged for every Mon–Fri employee** — same
   PTO Days and same PTO Dates as before.
2. For an employee who works Wed–Sun, a PTO day on Sunday now extends into the
   following Monday and Tuesday (their days off), and a PTO day on Friday no
   longer pulls in Saturday and Sunday, which are days they work.
3. No employee's Base Hrs, Worked Hrs or Discount Hrs changes at all — this
   touches only the PTO columns.
4. The HRK Summary page loads with no runtime error.

---

## After UIB reports done — our side

1. Export, sync, confirm the diff is one file.
2. `node --test "tests/*.test.ts"` — 96 must pass.
3. **Load HRK Summary** and confirm criterion 3 against Q2-Aug-2026: total
   discount must still read 184.7h and all 45 employees must still be listed.
   None of the four weekend employees currently has recorded PTO in that period,
   so criterion 2 may not be observable there — say so plainly rather than
   claiming it was verified.
