# Read-only: count the phantom off-day rows that still exist

**This is a question, not a change. Do not edit, create or delete any file.**
Run the two queries below against `GAF Planilla DB` and report the results as
tables in your reply. Change nothing.

A phantom off-day row is a live row on a day the employee is not scheduled to
work, carrying no punches at all. The predicate is the one already used by
migration `1781900200`.

## Query 1 — how many, per period

```sql
SELECT pe.period_name,
       COUNT(*) AS phantom_rows
FROM payroll_entries pe
JOIN employees e ON e.id = pe.employee_id
LEFT JOIN schedules s ON s.id = e.schedule_id
WHERE pe.deleted_at IS NULL
  AND NULLIF(TRIM(pe.entry_time), '') IS NULL
  AND NULLIF(TRIM(pe.exit_time), '')  IS NULL
  AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
        [EXTRACT(ISODOW FROM LEFT(pe.work_date, 10)::date)::int]
      <> ALL (string_to_array(
            COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri'), ','))
GROUP BY pe.period_name
ORDER BY pe.period_name;
```

## Query 2 — the Q2-Aug-2026 detail

```sql
SELECT e.display_name,
       LEFT(pe.work_date, 10) AS work_date,
       COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri') AS work_days,
       pe.event_type_1,
       pe.documentation,
       pe.initial_status,
       pe.status_current,
       pe.payroll_ready,
       pe.discount_total_minutes
FROM payroll_entries pe
JOIN employees e ON e.id = pe.employee_id
LEFT JOIN schedules s ON s.id = e.schedule_id
WHERE pe.deleted_at IS NULL
  AND pe.period_name = 'Q2-Aug-2026'
  AND NULLIF(TRIM(pe.entry_time), '') IS NULL
  AND NULLIF(TRIM(pe.exit_time), '')  IS NULL
  AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
        [EXTRACT(ISODOW FROM LEFT(pe.work_date, 10)::date)::int]
      <> ALL (string_to_array(
            COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri'), ','))
ORDER BY e.display_name, work_date;
```

Report both result sets in full. Do not summarise away rows, and do not write
any file.
