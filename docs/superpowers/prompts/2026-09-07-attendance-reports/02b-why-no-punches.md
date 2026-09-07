# Read-only: why does the Reports tab show every day as unexplained?

**Write no files. Create nothing. Modify nothing. Delete nothing.** Read-only.

## The symptom

`/attendance/reports` renders, but every employee shows every day from
2026-08-10 to 2026-08-24 as **Unexplained absence** — 440 absent, 0 on-time,
across all 45 people. Days from 2026-08-25 onward correctly show
*Not processed*, so the `periods` and `holidays` data and the date logic are
all working.

Only the things keyed by **employee id** are empty: no punches, no forms. That
points at either the queries returning nothing, or an id that does not match
between queries.

## Query 1 — does `loadAttendanceReportDays` return anything?

Run its exact SQL with `dateFrom = '2026-08-10'`, `dateTo = '2026-08-24'`,
`manager = ''`:

```sql
SELECT DISTINCT ON (pe.employee_id, LEFT(pe.work_date, 10))
       pe.employee_id,
       LEFT(pe.work_date, 10)                       AS work_date,
       NULLIF(TRIM(pe.entry_time), '')              AS entry_time,
       NULLIF(TRIM(pe.scheduled_start), '')         AS scheduled_start,
       GREATEST(0, COALESCE(pe.late_minutes, 0))    AS late_minutes
FROM public.payroll_entries pe
JOIN public.employees e ON e.id = pe.employee_id
WHERE pe.deleted_at IS NULL
  AND LEFT(pe.work_date, 10) >= '2026-08-10'
  AND LEFT(pe.work_date, 10) <= '2026-08-24'
  AND e.active = true
  AND COALESCE(e.excluded_from_payroll, false) = false
ORDER BY pe.employee_id, LEFT(pe.work_date, 10), pe.period_name DESC
LIMIT 10;
```

**Report the row count and the first few rows.** If this returns nothing, the
`WHERE` clause is wrong and the id theory is dead.

## Query 2 — the id types, side by side

This is the main suspicion. The report indexes punches in a `Map` keyed by
`employee_id` and looks them up by the employee's `id`. If one side is the
number `12` and the other the string `"12"`, every lookup misses silently and
every day becomes an unexplained absence — exactly what is on screen.

```sql
SELECT 'employees'      AS source, pg_typeof(id)          AS id_type FROM public.employees LIMIT 1;
SELECT 'payroll_entries' AS source, pg_typeof(employee_id) AS id_type FROM public.payroll_entries LIMIT 1;
SELECT 'forms'           AS source, pg_typeof(employee_id) AS id_type FROM public.monday_attendance_forms LIMIT 1;
```

Then, more usefully than the Postgres type: **run
`loadAttendanceEmployees` and `loadAttendanceReportDays` through the app and
report what JavaScript type each id arrives as** — `typeof row.id` and
`typeof row.employee_id`. A `bigint` column commonly arrives as a **string**
in JavaScript, and if the two queries disagree, that is the bug.

## Query 3 — do the ids actually intersect?

```sql
SELECT COUNT(DISTINCT pe.employee_id) AS employees_with_punches
FROM public.payroll_entries pe
JOIN public.employees e ON e.id = pe.employee_id
WHERE pe.deleted_at IS NULL
  AND LEFT(pe.work_date, 10) BETWEEN '2026-08-10' AND '2026-08-24'
  AND e.active = true
  AND COALESCE(e.excluded_from_payroll, false) = false;
```

```sql
SELECT LEFT(pe.work_date, 10) AS work_date, COUNT(*) AS rows,
       COUNT(*) FILTER (WHERE NULLIF(TRIM(pe.entry_time),'') IS NOT NULL) AS with_punches
FROM public.payroll_entries pe
WHERE pe.deleted_at IS NULL
  AND LEFT(pe.work_date, 10) BETWEEN '2026-08-10' AND '2026-08-24'
GROUP BY 1 ORDER BY 1;
```

**Report whether 2026-08-10 to 2026-08-24 has punch data at all.** The last
processed period is Q2-Aug-2026, which ended 2026-08-24 — so it should.

## Query 4 — the parameter types

`loadAttendanceReportDays` compares `LEFT(pe.work_date, 10)` (text) against
`{{params.dateFrom}}`. If the parameter arrives as a **date** rather than a
string, Postgres has to coerce, and with prepared statements enabled that can
fail or silently match nothing.

Run the action itself — not the raw SQL — with
`{ dateFrom: '2026-08-10', dateTo: '2026-08-24', manager: '' }` and report:

1. the row count it returns,
2. any error text,
3. the JavaScript type of `employee_id` and of `work_date` in the first row.

---

## What to report

Results per query, then a **Verdict** naming the single cause. Do not propose a
fix in code — just say what the data shows. If the queries return rows and the
ids match on both sides and the types agree, say so plainly; the fault is then
in the module, not the data, and that is worth knowing too.

## Acceptance

1. No file was created, modified or deleted.
2. The row count from Query 1 is stated.
3. The JavaScript type of the id on both sides is stated.
4. The verdict names one cause, or says the data is fine.
