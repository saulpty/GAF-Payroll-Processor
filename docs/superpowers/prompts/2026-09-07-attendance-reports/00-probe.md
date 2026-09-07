# Read-only probe: can an Attendance *Reports* tab be built on this data?

**Write no files. Create nothing. Modify nothing. Delete nothing.**

This is a **read-only investigation**. Do not create an action, a page, a
component, a migration or a lib module. Do not start building the Reports tab.
Run the queries below and report the results as tables in your reply.

If you believe a query needs a new saved action to run, say so and stop rather
than creating one.

All queries run against **`GAF Planilla DB`** unless stated otherwise.

## Why

A manager-facing **Reports** tab is about to be added under Attendance. It will
show, per employee per day: the punches, the minutes late, the Absence /
Tardiness form behind that day (type, reason, details), and whether the form was
submitted **before the shift started** — company policy is that it must be. It
will also flag days with no punches and nothing explaining them.

The design rests on six assumptions about the live data. Each one, if wrong,
would only surface as a silently incorrect verdict on screen — a manager reading
"submitted late" about someone who submitted on time. This probe tests all six
**before** any UI exists.

---

## Query 1 — the `documentation` strings (the suspected live bug)

`v_attendance_daily` derives `filed_gaf`, which drives the "Late — Reported" /
"Late — Unreported" KPIs and the Reporting Compliance donut, as:

```sql
TRIM(COALESCE(pe.documentation, '')) = 'Form Submitted'
```

But `classificationEngine.ts` appears to have stopped writing that string on
2026-08-27; it now writes `'Attendance Form'`, `'Permission Form'`,
`'Time Adjustment Form'` and `'Doctor Note – Pending'`.

```sql
SELECT COALESCE(NULLIF(TRIM(documentation), ''), '(empty)') AS documentation,
       COUNT(*) AS rows,
       MIN(LEFT(work_date, 10)) AS earliest,
       MAX(LEFT(work_date, 10)) AS latest
FROM payroll_entries
WHERE deleted_at IS NULL
GROUP BY 1
ORDER BY 2 DESC;
```

Then the same split by period, to see the changeover:

```sql
SELECT period_name,
       COUNT(*) FILTER (WHERE TRIM(COALESCE(documentation,'')) = 'Form Submitted')  AS old_string,
       COUNT(*) FILTER (WHERE TRIM(COALESCE(documentation,'')) = 'Attendance Form') AS new_string,
       COUNT(*) FILTER (WHERE COALESCE(late_minutes,0) > 0)                         AS late_rows,
       MIN(LEFT(work_date,10)) AS period_start
FROM payroll_entries
WHERE deleted_at IS NULL
GROUP BY period_name
ORDER BY period_start;
```

**Report whether any period contains both strings, and the date of the
changeover.** If `Attendance Form` rows exist and `filed_gaf` cannot see them,
every one of those days is currently displayed as "Late — Unreported" when a
form was in fact filed. State plainly whether that is happening.

## Query 2 — what `submitted_at` actually contains (the verdict depends on it)

The whole "submitted before the shift" verdict is a comparison between a
timestamp from Monday and a shift start time stored as US-Eastern wall clock. If
the Monday value is UTC and is compared raw, **every verdict shifts by four or
five hours** and the page is confidently wrong.

`syncAttendanceForms.ts` sets `submitted_at` to the *raw text* of the board's
Date column and `form_date` to the parsed date of the same column.

```sql
SELECT monday_item_id,
       employee_name_raw,
       form_type,
       form_date::text  AS form_date,
       submitted_at,
       raw -> 'column_values' AS column_values
FROM monday_attendance_forms
WHERE deleted_on_monday = false
  AND form_date >= '2026-09-01'
ORDER BY form_date DESC, monday_item_id DESC
LIMIT 12;
```

The board itself shows these rows (read off the Main table on 2026-09-07):

| employee | board Date column shows |
|---|---|
| Gisselle Ramos | Sep 7, 8:00 AM |
| Jennette Torrano | Sep 7, 7:52 AM |
| Carlos Aloma | Sep 7, 7:49 AM |
| Edwin Broce | Sep 7, 7:22 AM |
| Michael Jones | Sep 5, 10:43 AM |
| Charles Bush | Sep 4, 9:03 AM |
| Gabriela Jaen | Sep 4, 8:51 AM |
| JP Montfort | Sep 4, 8:04 AM |
| Alanis Chena | Sep 4, 8:01 AM |
| Jennette Torrano | Sep 4, 7:43 AM |
| Tanya Bedoya | Sep 4, 7:40 AM |
| Carlos Aloma | Sep 4, 7:36 AM |

**Report, as a table, for at least four of these people: what the board shows vs
what `submitted_at` holds vs what the `raw` JSON holds for the date column.**

Then answer these three questions explicitly:

1. **Does `submitted_at` carry a time at all**, or only a date? If only a date,
   the time must come from `raw` — say which JSON path holds it.
2. **Is the stored time UTC or Eastern wall clock?** Compare the stored value to
   the board display above. A four- or five-hour gap means UTC.
3. **Is `form_date` the same calendar day as the board's display**, or has a UTC
   conversion pushed an early-morning form onto the previous/next day?

This is the single most important result in this probe.

## Query 3 — is there a payroll row on days with no punches?

The Reports tab must flag "no punches, no form, nothing covering the day". Its
rows come from `payroll_entries`, not from `v_attendance_daily` (the view drops
punchless days entirely). So: does a punchless day produce a row at all?

```sql
SELECT COUNT(*)                                                     AS all_rows,
       COUNT(*) FILTER (WHERE NULLIF(TRIM(entry_time),'') IS NULL)  AS no_entry_time,
       COUNT(*) FILTER (WHERE NULLIF(TRIM(entry_time),'') IS NULL
                          AND COALESCE(NULLIF(TRIM(event_type_1),''),'') = '') AS no_entry_no_event,
       COUNT(*) FILTER (WHERE NULLIF(TRIM(scheduled_start),'') IS NULL) AS no_scheduled_start
FROM payroll_entries
WHERE deleted_at IS NULL;
```

```sql
SELECT LEFT(work_date,10) AS work_date, employee_id, entry_time, exit_time,
       scheduled_start, event_type_1, documentation, status_current, late_minutes
FROM payroll_entries
WHERE deleted_at IS NULL
  AND NULLIF(TRIM(entry_time), '') IS NULL
ORDER BY work_date DESC
LIMIT 15;
```

**Report whether punchless days exist as rows.** If they do not, the Reports tab
must generate the missing days itself from each employee's `work_days` — say so.
Also report **the exact format of `scheduled_start`** (e.g. `8:00 AM`), since
the on-time comparison uses it.

## Query 4 — how far the data reaches

```sql
SELECT period_name, start_date::text, end_date::text, processed_at,
       employee_count, day_count
FROM periods
ORDER BY start_date DESC
LIMIT 12;
```

```sql
SELECT COUNT(*)                                            AS forms,
       COUNT(*) FILTER (WHERE employee_id IS NULL)          AS unmatched,
       COUNT(*) FILTER (WHERE deleted_on_monday)            AS deleted,
       MIN(form_date)::text                                 AS earliest,
       MAX(form_date)::text                                 AS latest,
       MAX(synced_at)::text                                 AS last_synced
FROM monday_attendance_forms;
```

```sql
SELECT form_type, COUNT(*) FROM monday_attendance_forms
WHERE deleted_on_monday = false GROUP BY 1 ORDER BY 2 DESC;
```

```sql
SELECT COALESCE(NULLIF(reason,''),'(empty)') AS reason, COUNT(*)
FROM monday_attendance_forms
WHERE deleted_on_monday = false GROUP BY 1 ORDER BY 2 DESC;
```

**The report can only cover days that both have a processed period and have
forms synced.** Report the overlap: the latest processed period end vs the
latest form date. If forms are newer than the newest processed period, those
days will render as "not processed yet" — confirm how many.

## Query 5 — what covers a day besides a form

A day with no punches is only "unexplained" if nothing else covers it: an
approved absence, a permission, PTO, a floating holiday, or a company holiday.

```sql
SELECT request_type, COUNT(*),
       MIN(start_date)::text AS earliest,
       MAX(COALESCE(return_date, end_date, start_date))::text AS latest
FROM monday_requests
WHERE deleted_on_monday = false
GROUP BY 1 ORDER BY 2 DESC;
```

```sql
SELECT COALESCE(NULLIF(permission_type,''),'(empty)') AS permission_type, COUNT(*)
FROM monday_requests WHERE deleted_on_monday = false GROUP BY 1 ORDER BY 2 DESC;
```

```sql
SELECT monday_item_id, employee_name_raw, request_type, permission_type,
       start_date::text, end_date::text, return_date::text,
       start_datetime, end_datetime, total_days_requested
FROM monday_requests
WHERE deleted_on_monday = false AND start_date >= '2026-08-01'
ORDER BY start_date DESC LIMIT 15;
```

```sql
SELECT date::text, name FROM holidays WHERE date >= '2026-08-01' ORDER BY date;
```

Answer explicitly:

1. **Which `request_type` values mean "this person is legitimately away"** —
   list them by name, including the exact spelling of the PTO and floating
   holiday values.
2. **Is the away period `start_date` → `return_date` (return exclusive) or
   `start_date` → `end_date` (inclusive)?** Both columns exist. Show a real
   multi-day row and say which pair describes the days actually off. Getting
   this backwards adds or drops one day per request.
3. **Are permissions partial-day?** If `start_datetime` / `end_datetime` carry
   times, a permission may cover only part of a day — in which case the employee
   was still expected at some point and the day is not simply "away".

## Query 6 — schedules, and whether shift start is knowable per day

```sql
SELECT s.id, s.schedule_name, s.standard_start, s.standard_end,
       s.dst_start, s.dst_end, s.grace_minutes,
       COALESCE(NULLIF(TRIM(s.work_days),''), '(null → defaults Mon–Fri)') AS work_days,
       COUNT(e.id) AS employees
FROM schedules s
LEFT JOIN employees e ON e.schedule_id = s.id
     AND e.active = true AND COALESCE(e.excluded_from_payroll,false) = false
GROUP BY s.id, s.schedule_name, s.standard_start, s.standard_end,
         s.dst_start, s.dst_end, s.grace_minutes, s.work_days
ORDER BY employees DESC;
```

```sql
SELECT COUNT(*) AS active_employees,
       COUNT(*) FILTER (WHERE schedule_id IS NULL) AS no_schedule,
       COUNT(*) FILTER (WHERE start_date IS NULL)  AS no_start_date,
       COUNT(*) FILTER (WHERE manager IS NULL OR TRIM(manager) = '') AS no_manager
FROM employees
WHERE active = true AND COALESCE(excluded_from_payroll, false) = false;
```

```sql
SELECT year, us_dst_start::text, us_dst_end::text FROM dst_calendar ORDER BY year;
```

**Report how many active employees have no schedule and how many have no
manager.** An employee with no manager never appears under a manager filter; an
employee with no schedule has no shift start, so "before the shift" is
undefined for them. Both need a decided fallback, and the numbers decide whether
it matters.

## Query 7 — the join that the whole feature depends on

Do the forms actually line up with the punch data, on the same day, for the same
person?

```sql
SELECT LEFT(pe.work_date,10)          AS work_date,
       e.display_name,
       pe.entry_time,
       pe.scheduled_start,
       pe.late_minutes,
       pe.documentation,
       f.form_type,
       f.reason,
       f.submitted_at
FROM payroll_entries pe
JOIN employees e ON e.id = pe.employee_id
LEFT JOIN monday_attendance_forms f
       ON f.employee_id = pe.employee_id
      AND f.form_date = LEFT(pe.work_date,10)::date
      AND f.deleted_on_monday = false
WHERE pe.deleted_at IS NULL
  AND COALESCE(pe.late_minutes,0) > 0
  AND LEFT(pe.work_date,10)::date >= '2026-08-15'
ORDER BY work_date DESC, e.display_name
LIMIT 25;
```

```sql
SELECT f.form_date::text, f.employee_name_raw, f.form_type, f.reason
FROM monday_attendance_forms f
LEFT JOIN payroll_entries pe
       ON pe.employee_id = f.employee_id
      AND LEFT(pe.work_date,10)::date = f.form_date
      AND pe.deleted_at IS NULL
WHERE f.deleted_on_monday = false
  AND f.employee_id IS NOT NULL
  AND pe.id IS NULL
  AND f.form_date >= '2026-08-01'
ORDER BY f.form_date DESC
LIMIT 20;
```

**Report how many late days have a matching form and how many do not**, and
separately **how many forms have no payroll day at all** (the second query).
A form with no payroll day is either a punchless absence, a non-work day, or a
period not yet processed — say which, for each row returned.

Also report **how many of the same person's forms land on one day** — two forms
on one day is a case the design must break deterministically:

```sql
SELECT employee_id, form_date::text, COUNT(*) AS forms,
       STRING_AGG(form_type || ' @ ' || COALESCE(submitted_at,'?'), ' | ') AS all_forms
FROM monday_attendance_forms
WHERE deleted_on_monday = false AND employee_id IS NOT NULL
GROUP BY employee_id, form_date
HAVING COUNT(*) > 1
ORDER BY form_date DESC
LIMIT 15;
```

---

## What to report

A markdown reply with one section per query, results as tables. End with a
section headed **"What this changes about the design"** listing any assumption
the data contradicted. If the data matches everywhere, say that explicitly.

## Acceptance

1. No file was created, modified or deleted anywhere in the project.
2. Every query above ran, or the reply says exactly why one could not.
3. Query 1 states whether `filed_gaf` is currently blind to filed forms, and
   from which date.
4. Query 2 answers all three numbered questions — time present, time zone,
   and whether `form_date` matches the board's day.
5. Query 3 states whether punchless days exist as rows, and the exact format of
   `scheduled_start`.
6. Query 5 names the "legitimately away" request types and says whether the
   away window is return-exclusive or end-inclusive.
7. Counts of active employees with no schedule and with no manager are reported.
