# Read-only probe: why did Step 3 miss 7 Absence forms?

**Write no files. Create nothing. Modify nothing. Delete nothing.**

Read-only. Do not create an action, page, component, migration or lib module.
Do not fix anything. Run the queries and report.

Database: `GAF Planilla DB`.

## Why

`00d` found 7 days stamped `Ausencia Injustificada` that had an **Absence** form
on file, filed before the period ran. Step 3 of the engine
(`classificationEngine.ts:583`) exists to catch exactly those and did not fire.
85.83 discounted hours across 5 employees depend on the answer.

## The leading hypothesis

`rowMatchesEmp` (`classificationEngine.ts:391-405`):

```ts
if (rowEmail && rowEmail.trim()) {
  return rowEmail.trim().toLowerCase() === empEmail.toLowerCase();
}
// name / alias fallback only reached when rowEmail is empty
```

**When a form carries an email, the email is the only test.** There is no
fallback to the name or to `name_aliases`. So a form whose *Company Email*
differs from that person's `employees.teramind_email` — a personal address, a
second work domain, a typo, a changed surname — matches nothing, and the day
falls through to Step 5 as if no form existed.

This is testable directly. Queries 1 and 2 do it.

## The decisive evidence

`ProcessPayroll.tsx:344` saves a snapshot on every run:

```
saveSnapshot({ periodName, snapshotType: 'monday_attendance', rawData: JSON.stringify(attendance) })
```

`attendance` is the **parsed** array the engine was handed — not the mirror, the
real input. For `Q2-Jul-2026` it records precisely what the engine could see.
Query 3 reads it.

## Query 1 — do the form emails match the roster emails?

```sql
SELECT e.display_name,
       e.teramind_email,
       f.employee_email_raw,
       (LOWER(TRIM(f.employee_email_raw)) = LOWER(e.teramind_email)) AS email_matches,
       COUNT(*) AS forms
FROM monday_attendance_forms f
JOIN employees e ON e.id = f.employee_id
WHERE f.deleted_on_monday = false
  AND e.display_name IN ('Ángela Rodgers','Carlos Aloma','Osvaldo Medina',
                         'Monique Luque','Jennette Torrano')
GROUP BY e.display_name, e.teramind_email, f.employee_email_raw
ORDER BY e.display_name, forms DESC;
```

**Report any row where `email_matches` is false.** One such row for Osvaldo
Medina or Monique Luque would explain their days outright.

## Query 2 — the same test across the whole board

```sql
SELECT (LOWER(TRIM(f.employee_email_raw)) = LOWER(e.teramind_email)) AS email_matches,
       COUNT(*) AS forms,
       COUNT(DISTINCT e.id) AS employees
FROM monday_attendance_forms f
JOIN employees e ON e.id = f.employee_id
WHERE f.deleted_on_monday = false
GROUP BY 1
ORDER BY forms DESC;
```

```sql
SELECT e.display_name, e.teramind_email, f.employee_email_raw, COUNT(*) AS forms,
       MIN(f.form_date)::text AS earliest, MAX(f.form_date)::text AS latest
FROM monday_attendance_forms f
JOIN employees e ON e.id = f.employee_id
WHERE f.deleted_on_monday = false
  AND LOWER(TRIM(f.employee_email_raw)) <> LOWER(e.teramind_email)
GROUP BY e.display_name, e.teramind_email, f.employee_email_raw
ORDER BY forms DESC
LIMIT 30;
```

**This is the scope question.** The mirror resolves these people correctly
(`buildResolver` falls back to alias and name); the engine does not. Every form
in this list is invisible to a payroll run. Report the total.

Note the mirror stores the email lower-cased at sync (`syncAttendanceForms.ts`),
while the engine compares the *live* board value case-insensitively — so a
casing difference alone is not the cause. A genuinely different address is.

## Query 3 — what the engine actually saw on those days

```sql
SELECT period_name,
       snapshot_type,
       LENGTH(raw_data) AS raw_len,
       created_at::text
FROM run_snapshots
WHERE snapshot_type = 'monday_attendance'
ORDER BY created_at DESC
LIMIT 12;
```

Then, for the period that produced most of the bad rows:

```sql
SELECT r ->> 'employeeName'  AS employee_name,
       r ->> 'employeeEmail' AS employee_email,
       r ->> 'date'          AS form_date,
       r ->> 'type'          AS form_type,
       r ->> 'reason'        AS reason
FROM run_snapshots s,
     LATERAL jsonb_array_elements(s.raw_data::jsonb) AS r
WHERE s.snapshot_type = 'monday_attendance'
  AND s.period_name = 'Q2-Jul-2026'
  AND (r ->> 'date') IN ('2026-07-13','2026-07-14','2026-07-17',
                         '2026-07-22','2026-07-23','2026-07-24')
ORDER BY form_date, employee_name;
```

Answer three things:

1. **Were the Osvaldo Medina and Monique Luque Absence forms in the snapshot at
   all?** If absent, the live pull never fetched them and the problem is in
   `fetchAllBoardItems` / `parseMondayItems`, not in matching.
2. **If present, what `employeeEmail` did they carry?** Compare it to that
   person's `teramind_email` — this is the hypothesis, confirmed or killed.
3. **What `date` string did they carry?** It must equal `YYYY-MM-DD` exactly;
   Step 3 compares `r.date === dateStr` with no normalisation. A value with a
   time attached, or a different format, would also miss.

If `Q2-Jul-2026` has no snapshot, use whichever period does and say which.

## Query 4 — is the whole snapshot smaller than the board?

```sql
SELECT s.period_name,
       jsonb_array_length(s.raw_data::jsonb) AS rows_in_snapshot,
       s.created_at::text
FROM run_snapshots s
WHERE s.snapshot_type = 'monday_attendance'
ORDER BY s.created_at DESC
LIMIT 12;
```

The board holds 1,310 forms today. A snapshot holding far fewer would mean the
live pull is truncating — a different and larger defect than matching. Report
the counts and say whether they look complete for their date.

## Query 5 — how many people are exposed to this

```sql
SELECT COUNT(*) AS active_employees,
       COUNT(*) FILTER (WHERE teramind_email IS NULL OR TRIM(teramind_email) = '') AS no_teramind_email
FROM employees
WHERE active = true AND COALESCE(excluded_from_payroll, false) = false;
```

```sql
SELECT a.alias_text, e.display_name, e.teramind_email
FROM name_aliases a
JOIN employees e ON e.id = a.employee_id
WHERE e.display_name IN ('Ángela Rodgers','Carlos Aloma','Osvaldo Medina',
                         'Monique Luque','Jennette Torrano')
ORDER BY e.display_name, a.alias_text;
```

Aliases exist for name matching, but `rowMatchesEmp` never reaches them when an
email is present. Report which of the five have aliases — it shows what the
system *would* have matched had the email been absent.

---

## What to report

One section per query, results as markdown tables. Then a **"Verdict"**
answering:

1. Did the 7 Absence forms reach the engine at all?
2. If they did, was it an email mismatch, a date-format mismatch, or neither?
3. How many forms across the whole board carry an email that does not match the
   roster — i.e. how many are invisible to every payroll run?
4. Is this still happening today, or was it confined to a period?

## Acceptance

1. No file was created, modified or deleted.
2. Every query ran, or the reply says why one could not.
3. Query 3 states whether the forms were present in the snapshot, and with what
   email and date values.
4. The board-wide count of email-mismatched forms is stated as a number.
