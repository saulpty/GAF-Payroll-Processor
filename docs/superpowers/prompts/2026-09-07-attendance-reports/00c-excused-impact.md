# Cleanup + read-only: how big is the "Excused" mis-grouping?

Two unrelated things, in this order.

## Part 1 — the only file change allowed

Delete the folder `docs/` from this project, including
`docs/superpowers/prompts/2026-09-07-attendance-reports/00-probe-RESULTS.md`.

It was written here by mistake in the previous turn. This project's own file
tree is not where that document belongs — it lives in the git mirror outside
the app, where it has already been saved. Nothing in the app reads it.

**That deletion is the only file change permitted.** Do not create, modify or
delete any other file — no action, no page, no component, no migration, no
`AGENTS.md`. Do not create a new `docs/` folder afterwards.

## Part 2 — read-only queries. Create nothing.

`v_attendance_daily` classifies a day as excused with this list:

```
'PTO', 'Feriado', 'Compensatory Day', 'Birthday Day Off',
'Ausencia Justificada.', 'Ausencia Injustificada'
```

`Ausencia Injustificada` means the opposite of the other five: the engine
writes it at Step 5, "No data + no form" — nobody clocked in and nothing was
filed. Because the status expression tests `is_excused` first, such a day is
displayed as `Excused (PTO/FH/Perm)` and is dropped from every lateness bucket.

Before deciding whether to change that, the size of the effect needs to be
known. Report the results as markdown tables.

### Query 1 — how many days are affected

```sql
SELECT COALESCE(NULLIF(TRIM(event_type_1), ''), '(empty)') AS event_type_1,
       COUNT(*) AS rows,
       COUNT(*) FILTER (WHERE NULLIF(TRIM(entry_time), '') IS NULL) AS no_punches,
       MIN(LEFT(work_date, 10)) AS earliest,
       MAX(LEFT(work_date, 10)) AS latest
FROM payroll_entries
WHERE deleted_at IS NULL
GROUP BY 1
ORDER BY 2 DESC;
```

### Query 2 — the same split, but only the rows the dashboard actually shows

The view drops deleted rows, inactive and payroll-excluded employees, and any
day that is not in that employee's `work_days`. So the count that matters is
the one taken through the view itself.

```sql
SELECT status, COUNT(*) AS rows
FROM v_attendance_daily
GROUP BY status
ORDER BY 2 DESC;
```

```sql
SELECT COUNT(*) AS excused_total,
       COUNT(*) FILTER (WHERE pe.event_type_1 = 'Ausencia Injustificada') AS would_become_unexplained,
       COUNT(*) FILTER (WHERE pe.event_type_1 = 'Ausencia Justificada.')  AS stays_justified,
       COUNT(*) FILTER (WHERE pe.event_type_1 = 'PTO')                    AS stays_pto,
       COUNT(*) FILTER (WHERE pe.event_type_1 = 'Feriado')                AS stays_holiday,
       COUNT(*) FILTER (WHERE pe.event_type_1 = 'Compensatory Day')       AS stays_comp,
       COUNT(*) FILTER (WHERE pe.event_type_1 = 'Birthday Day Off')       AS stays_birthday
FROM v_attendance_daily v
JOIN employees e ON e.teramind_email = v.email
JOIN payroll_entries pe
  ON pe.employee_id = e.id
 AND LEFT(pe.work_date, 10)::date = v.date
 AND pe.deleted_at IS NULL
WHERE v.status = 'Excused (PTO/FH/Perm)';
```

**Report the exact number of dashboard rows that would move out of Excused.**

### Query 3 — who, and how recently

```sql
SELECT e.display_name, e.manager, COUNT(*) AS unexplained_days,
       MIN(LEFT(pe.work_date,10)) AS earliest,
       MAX(LEFT(pe.work_date,10)) AS latest
FROM payroll_entries pe
JOIN employees e ON e.id = pe.employee_id
WHERE pe.deleted_at IS NULL
  AND pe.event_type_1 = 'Ausencia Injustificada'
  AND e.active = true
  AND COALESCE(e.excluded_from_payroll, false) = false
GROUP BY e.display_name, e.manager
ORDER BY unexplained_days DESC, latest DESC
LIMIT 25;
```

```sql
SELECT period_name, COUNT(*) AS unexplained_days
FROM payroll_entries
WHERE deleted_at IS NULL AND event_type_1 = 'Ausencia Injustificada'
GROUP BY period_name
ORDER BY MIN(LEFT(work_date,10));
```

### Query 4 — is it really "nothing was filed"?

The name says unjustified, but the row may still have a form or a permission
behind it. If many do, the engine's Step 5 is firing on days that were in fact
explained, and that is a different problem from a display grouping.

```sql
SELECT COUNT(*) AS unexplained_rows,
       COUNT(f.id) AS with_an_attendance_form,
       COUNT(*) FILTER (WHERE COALESCE(NULLIF(TRIM(pe.documentation),''),'') <> '') AS with_documentation,
       COUNT(*) FILTER (WHERE pe.auto_notes ILIKE '%NO DATA + NO FORM%') AS stamped_no_data_no_form
FROM payroll_entries pe
LEFT JOIN monday_attendance_forms f
       ON f.employee_id = pe.employee_id
      AND f.form_date = LEFT(pe.work_date,10)::date
      AND f.deleted_on_monday = false
WHERE pe.deleted_at IS NULL
  AND pe.event_type_1 = 'Ausencia Injustificada';
```

---

## What to report

One section per query, results as markdown tables. Then a short closing
paragraph answering, in plain language: **if `Ausencia Injustificada` were
shown as its own status instead of as Excused, how many rows on the existing
Attendance dashboard would change, and over what date range?**

## Acceptance

1. The project's `docs/` folder is gone, and no other file was created,
   modified or deleted.
2. Every query ran, or the reply says why one could not.
3. The exact number of dashboard rows that would move out of Excused is stated.
4. Query 4 says whether these rows genuinely have no form behind them.
