# 01 — PROBE (read-only): which days are missing from the saved Teramind copy?

**Do not create, edit or delete any file. Do not create an action. This is a read-only question.**
Run the three queries below once against the datasource **GAF Planilla DB** with your
inspection/query tool and paste all three result sets back verbatim. If your tool cannot run ad-hoc
SQL, say so and stop — do not build anything to work around it.

## Why

A manager reports that Euclides Gonzalez (Teramind account `javier.g@passiontocarehc.com`) shows
"No Records" for Sat Sep 19 on the Today board, while Teramind itself shows him working that day.
The keep-fresh sync only ever pulls **yesterday and today**, and only while a super user has the Hub
open — so a weekend with nobody logged in would leave a permanent hole. These queries measure the
hole.

### A. Rows per day in the saved copy, last 16 days

```sql
SELECT work_date,
       COUNT(*)::int                        AS records,
       COUNT(DISTINCT employee_id)::int     AS employees,
       MIN(synced_at)                       AS first_synced,
       MAX(synced_at)                       AS last_synced
FROM public.teramind_sessions
WHERE source = 'time_record'
  AND work_date >= to_char(CURRENT_DATE - 16, 'YYYY-MM-DD')
GROUP BY work_date
ORDER BY work_date;
```

### B. The four people on weekend schedules, per day, same window

```sql
SELECT e.display_name, t.work_date, COUNT(*)::int AS records,
       MIN(t.started_et) AS first_start, MAX(t.finished_et) AS last_finish
FROM public.teramind_sessions t
JOIN public.employees e ON e.id = t.employee_id
WHERE t.source = 'time_record'
  AND t.work_date >= to_char(CURRENT_DATE - 16, 'YYYY-MM-DD')
  AND e.display_name IN ('Euclides Gonzalez', 'Michael Antonio Jones Roye', 'Edwin Broce', 'Cemiriamiz Iglesias')
GROUP BY e.display_name, t.work_date
ORDER BY e.display_name, t.work_date;
```

### C. Every pull ever recorded, newest first (what the log believes it covered)

```sql
SELECT id, date_from, date_to, trigger, pulled_at, row_count, truncated, error
FROM public.teramind_pull_log
ORDER BY pulled_at DESC
LIMIT 40;
```

Paste the rows exactly as the tool returns them. Do not summarise, do not round, do not skip rows.
