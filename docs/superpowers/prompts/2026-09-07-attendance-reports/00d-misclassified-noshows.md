# Read-only probe: why do 13 "unjustified" absences have a form?

**Write no files. Create nothing. Modify nothing. Delete nothing.**

Read-only investigation. Do not create an action, page, component, migration or
lib module. Do not fix anything. Run the queries and report the results.

Database: `GAF Planilla DB`.

## Why

`00c` found that **13 of 66 `Ausencia Injustificada` rows have an attendance
form** for the same employee on the same date. The engine reached Step 5,
`"No data + no form"`, and applied a full-day discount while a form existed.

Before an Attendance Reports tab shows any of this to a manager, it has to be
known whether those 13 are a labelling problem or a real misclassification that
cost someone money.

## The hypothesis to test first

`classificationEngine.ts` Step 3 (line 583) fires **only** when
`absenceForms.length > 0`, and `absenceForms` is filtered to
`r.type === 'Absence'` (line 512-514). A **Tardiness** form is collected
separately (line 515) and is only consulted later, on the "normal day with
data" path.

So an employee who filed **Tardiness** ("I'll be late") and then never clocked
in at all has: no punches, no *Absence* form → falls past Step 3, past Step 4,
into Step 5 → `Ausencia Injustificada` + full-day discount, with `auto_notes`
reading `NO DATA + NO FORM` even though a form is on file.

Given the corpus is 1,164 Tardiness vs 146 Absence forms, this would account
for most or all of the 13.

**Query 1 tests exactly that.** Report whether it holds.

## Query 1 — what kind of form is behind each one?

```sql
SELECT f.form_type,
       COUNT(*) AS rows,
       COUNT(*) FILTER (WHERE NULLIF(TRIM(pe.entry_time), '') IS NULL) AS no_punches,
       MIN(LEFT(pe.work_date,10)) AS earliest,
       MAX(LEFT(pe.work_date,10)) AS latest
FROM payroll_entries pe
JOIN monday_attendance_forms f
  ON f.employee_id = pe.employee_id
 AND f.form_date = LEFT(pe.work_date,10)::date
 AND f.deleted_on_monday = false
WHERE pe.deleted_at IS NULL
  AND pe.event_type_1 = 'Ausencia Injustificada'
GROUP BY f.form_type
ORDER BY rows DESC;
```

## Query 2 — the 13 rows, one line each

```sql
SELECT e.display_name,
       e.manager,
       LEFT(pe.work_date,10)           AS work_date,
       pe.period_name,
       pe.entry_time,
       pe.discount_total_minutes,
       pe.auto_notes,
       f.form_type,
       f.reason,
       f.submitted_at,
       f.synced_at::text               AS form_synced_at,
       p.processed_at                  AS period_processed_at
FROM payroll_entries pe
JOIN employees e ON e.id = pe.employee_id
JOIN monday_attendance_forms f
  ON f.employee_id = pe.employee_id
 AND f.form_date = LEFT(pe.work_date,10)::date
 AND f.deleted_on_monday = false
LEFT JOIN periods p ON p.period_name = pe.period_name
WHERE pe.deleted_at IS NULL
  AND pe.event_type_1 = 'Ausencia Injustificada'
ORDER BY work_date;
```

**Report every row.** For each, state whether the form was submitted *before*
the work date (a genuine heads-up) or after it (filed retroactively).

## Query 3 — could the engine have seen the form when the period ran?

The engine pulls Monday **live** during a payroll run; it does not read the
mirror. But `synced_at` is the only timestamp available, and `submitted_at`
tells us when the employee filed. If a form was submitted *before* the period
was processed, the live pull should have contained it — and the
misclassification is a logic gap, not a timing accident.

```sql
SELECT COUNT(*) AS rows_with_form,
       COUNT(*) FILTER (WHERE f.submitted_at IS NOT NULL
                          AND LEFT(f.submitted_at,10) <= LEFT(p.processed_at,10)) AS filed_before_period_ran,
       COUNT(*) FILTER (WHERE f.submitted_at IS NOT NULL
                          AND LEFT(f.submitted_at,10) >  LEFT(p.processed_at,10)) AS filed_after_period_ran,
       COUNT(*) FILTER (WHERE p.processed_at IS NULL) AS period_never_processed
FROM payroll_entries pe
JOIN monday_attendance_forms f
  ON f.employee_id = pe.employee_id
 AND f.form_date = LEFT(pe.work_date,10)::date
 AND f.deleted_on_monday = false
LEFT JOIN periods p ON p.period_name = pe.period_name
WHERE pe.deleted_at IS NULL
  AND pe.event_type_1 = 'Ausencia Injustificada';
```

**If most were filed before the run, timing is not the explanation** and the
Step 3 gap above is. Say which.

## Query 4 — how much money is involved

```sql
SELECT COUNT(*) AS rows,
       SUM(COALESCE(pe.discount_total_minutes,0))              AS total_discount_minutes,
       ROUND(SUM(COALESCE(pe.discount_total_minutes,0))/60.0, 2) AS total_discount_hours,
       COUNT(DISTINCT pe.employee_id)                          AS employees_affected
FROM payroll_entries pe
JOIN monday_attendance_forms f
  ON f.employee_id = pe.employee_id
 AND f.form_date = LEFT(pe.work_date,10)::date
 AND f.deleted_on_monday = false
WHERE pe.deleted_at IS NULL
  AND pe.event_type_1 = 'Ausencia Injustificada';
```

**State the total discounted hours and how many people they belong to.** These
rows are in already-processed periods, so if the discount was wrong, it was
already paid that way.

## Query 5 — the reverse case, for scope

How often does a Tardiness form land on a day with **no punches at all**,
regardless of how the row was classified? This is the size of the pattern, not
just the part that became `Ausencia Injustificada`.

```sql
SELECT COALESCE(NULLIF(TRIM(pe.event_type_1),''),'(empty)') AS event_type_1,
       COUNT(*) AS rows
FROM payroll_entries pe
JOIN monday_attendance_forms f
  ON f.employee_id = pe.employee_id
 AND f.form_date = LEFT(pe.work_date,10)::date
 AND f.deleted_on_monday = false
 AND f.form_type = 'Tardiness'
WHERE pe.deleted_at IS NULL
  AND NULLIF(TRIM(pe.entry_time), '') IS NULL
GROUP BY 1
ORDER BY rows DESC;
```

## Query 6 — the two long stretches

`00c` showed Cemiriamiz Iglesias (10 days) and Euclides Gonzalez (9 days), both
2026-07-27 → 2026-08-07. Consecutive multi-week absences look more like a
departure, a leave, or a Teramind outage than ten separate no-shows.

```sql
SELECT e.display_name, e.active, e.start_date::text, e.excluded_from_payroll,
       LEFT(pe.work_date,10) AS work_date, pe.event_type_1, pe.entry_time,
       pe.discount_total_minutes, pe.auto_notes
FROM payroll_entries pe
JOIN employees e ON e.id = pe.employee_id
WHERE pe.deleted_at IS NULL
  AND e.display_name IN ('Cemiriamiz Iglesias', 'Euclides Gonzalez')
  AND LEFT(pe.work_date,10)::date BETWEEN '2026-07-20' AND '2026-08-14'
ORDER BY e.display_name, work_date;
```

```sql
SELECT r.employee_name_raw, r.request_type, r.permission_type,
       r.start_date::text, r.end_date::text, r.return_date::text, r.reason
FROM monday_requests r
JOIN employees e ON e.id = r.employee_id
WHERE r.deleted_on_monday = false
  AND e.display_name IN ('Cemiriamiz Iglesias', 'Euclides Gonzalez')
ORDER BY r.start_date DESC
LIMIT 20;
```

**Say whether a request covers those stretches.** If one does, the engine's
permission handling missed it and that is a third, separate defect.

---

## What to report

One section per query, results as markdown tables. Then a closing section
headed **"Verdict"** answering, in plain language:

1. Is the Step 3 / Tardiness-form hypothesis correct?
2. Were the forms filed before or after the period was processed?
3. How many discounted hours are attached to these rows, and for whom?
4. Are the two long stretches genuine absences?

## Acceptance

1. No file was created, modified or deleted.
2. Every query ran, or the reply says why one could not.
3. Query 1 states the form-type split, which confirms or kills the hypothesis.
4. Every one of the rows in Query 2 is listed individually.
5. The total discounted hours is stated as a number.
