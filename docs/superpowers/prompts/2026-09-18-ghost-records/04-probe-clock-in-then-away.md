# 04 — PROBE (read-only): "clock in, then away" pattern, last 90 days

**Do not create, edit or delete any file. Do not create an action. This is a read-only question.**
Run the SQL below once against the datasource **GAF Planilla DB** with your inspection/query tool and
paste the result rows back verbatim (both result sets). If your tool cannot run ad-hoc SQL, say so
and stop — do not build anything to work around it.

## Question (from the owner)

How many people clock in within 10 minutes of their scheduled start (before or after) and then
leave the laptop for 30 minutes or more right away — the "clock in, go for breakfast" behaviour?

## Definitions used by the SQL

- Clean Time Records only (`v_teramind_records`, `NOT is_ghost`), last 90 days, active employees.
- "Clocked in near the start": the day's first record starts within ±10 minutes of
  `schedules.standard_start` (compared as clock times; `started_et` is Eastern text).
- "Then away": within the first 15 minutes after that first start, a record ends and the next record
  of the day starts 30 minutes or more later.

```sql
WITH rec AS (
  SELECT v.employee_id, v.work_date, v.started_et::timestamp AS st, v.finished_et::timestamp AS fn,
         LEAD(v.started_et::timestamp) OVER (PARTITION BY v.employee_id, v.work_date ORDER BY v.started_et, v.finished_et, v.id) AS next_st,
         MIN(v.started_et::timestamp) OVER (PARTITION BY v.employee_id, v.work_date) AS day_st
  FROM public.v_teramind_records v
  WHERE NOT v.is_ghost AND v.work_date >= to_char(CURRENT_DATE - 90, 'YYYY-MM-DD')
),
day AS (
  SELECT r.employee_id, r.work_date, MIN(r.day_st) AS day_st,
         MAX(CASE WHEN r.next_st IS NOT NULL AND r.fn - r.day_st <= interval '15 minutes'
                   AND r.next_st - r.fn >= interval '30 minutes'
                  THEN EXTRACT(EPOCH FROM (r.next_st - r.fn)) / 60 END) AS away_min
  FROM rec r GROUP BY r.employee_id, r.work_date
),
j AS (
  SELECT d.*, e.display_name,
         (NULLIF(TRIM(s.standard_start::text), ''))::time AS sched
  FROM day d JOIN public.employees e ON e.id = d.employee_id AND e.active = TRUE
  LEFT JOIN public.schedules s ON s.id = e.schedule_id
),
near AS (
  SELECT *, ABS(EXTRACT(EPOCH FROM (day_st::time - sched)) / 60) AS off_min FROM j WHERE sched IS NOT NULL
)
SELECT 'totals' AS k, COUNT(*)::int AS employee_days,
       COUNT(*) FILTER (WHERE off_min <= 10)::int AS started_within_10_min,
       COUNT(*) FILTER (WHERE off_min <= 10 AND away_min IS NOT NULL)::int AS then_away_30_plus,
       COUNT(DISTINCT employee_id) FILTER (WHERE off_min <= 10 AND away_min IS NOT NULL)::int AS people
FROM near;
```

Second result set — who, how often, typical length (same CTEs, replace the final SELECT with):

```sql
SELECT display_name, COUNT(*)::int AS days, ROUND(AVG(away_min))::int AS avg_away_min, MAX(work_date) AS last_date
FROM near WHERE off_min <= 10 AND away_min IS NOT NULL
GROUP BY display_name ORDER BY days DESC, display_name LIMIT 25;
```

Note `standard_start` may be stored as text like `09:00` or `9:00 AM`; if the `::time` cast fails,
report the error text and the distinct values of `schedules.standard_start` instead of guessing.
