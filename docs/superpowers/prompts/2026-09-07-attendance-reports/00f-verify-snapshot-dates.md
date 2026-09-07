# Read-only: settle what the snapshot `date` values actually are

**Write no files. Create nothing. Modify nothing. Delete nothing.** Read-only.

Database: `GAF Planilla DB`.

## Why this needs one more query

The previous reply concluded that Step 3 fails because snapshot dates are ISO
timestamps (`"2026-07-13T00:00:00.000Z"`) compared against plain `YYYY-MM-DD`.

**That conflicts with the code.** `ProcessPayroll.tsx:251` builds the value as:

```ts
const dateRaw = colText(cols, COL_ATT_DATE).slice(0, 10)
             || (colValue(cols, COL_ATT_DATE) as Record<string,string> | null)?.date
             || '';
```

`.slice(0, 10)` cannot produce a 24-character string, and the `value` fallback
yields Monday's `date` field, itself `YYYY-MM-DD`. If every snapshot date were
a 24-character ISO string, `r.date === dateStr` would fail for **every** form
and no row would ever be stamped `Form Submitted` — yet 1,152 rows are.

So one of these is true, and the difference decides whether an engine change is
even warranted:

- **A.** The dates are plain `YYYY-MM-DD`; the ISO reading was a misinterpretation
  (for example reading `form_date` from `monday_attendance_forms`, which is a
  Postgres `DATE` and *does* render as `2026-07-13T00:00:00.000Z` through
  `::text` / JSON — a trap already recorded in `docs/LESSONS.md`).
- **B.** The dates really are ISO in the snapshot, which would mean the snapshot
  was written by an older build than the current `ProcessPayroll.tsx`, and the
  bug is elsewhere.

**Do not reason about this. Measure it.** Report raw values and their lengths.

## Query 1 — which periods have an attendance snapshot

```sql
SELECT period_name,
       jsonb_array_length(raw_data::jsonb) AS rows_in_snapshot,
       created_at::text
FROM run_snapshots
WHERE snapshot_type = 'monday_attendance'
ORDER BY created_at DESC;
```

List every one. Say plainly whether `Q2-Jul-2026` is among them.

## Query 2 — the exact `date` values, with their lengths

Run this for the **most recent** attendance snapshot, whatever its period, and
name that period in your answer.

```sql
SELECT r ->> 'date'                    AS date_value,
       LENGTH(r ->> 'date')            AS date_length,
       COUNT(*)                        AS rows
FROM run_snapshots s,
     LATERAL jsonb_array_elements(s.raw_data::jsonb) AS r
WHERE s.snapshot_type = 'monday_attendance'
  AND s.created_at = (SELECT MAX(created_at) FROM run_snapshots
                      WHERE snapshot_type = 'monday_attendance')
GROUP BY 1, 2
ORDER BY rows DESC
LIMIT 20;
```

**`date_length` is the whole answer.** 10 means option A. 24 means option B.
Report the distinct lengths present and the count at each.

## Query 3 — a named row, end to end

```sql
SELECT r ->> 'employeeName'  AS employee_name,
       r ->> 'employeeEmail' AS employee_email,
       r ->> 'date'          AS date_value,
       LENGTH(r ->> 'date')  AS date_length,
       r ->> 'type'          AS form_type,
       r ->> 'reason'        AS reason
FROM run_snapshots s,
     LATERAL jsonb_array_elements(s.raw_data::jsonb) AS r
WHERE s.snapshot_type = 'monday_attendance'
  AND (r ->> 'employeeName') ILIKE ANY (ARRAY['%Medina%', '%Luque%', '%Aloma%'])
ORDER BY employee_name, date_value
LIMIT 40;
```

Include the snapshot's `period_name` for each row if you can; if that makes the
query awkward, run it once per period instead.

**For Osvaldo Medina and Monique Luque specifically, on 2026-07-13, 07-14,
07-17, 07-22, 07-23 and 07-24:** state for each whether a row exists in any
snapshot, and if so its exact `employeeEmail`, `date_value` and `type`.

## Query 4 — the type values

Step 3 keys on `type === 'Absence'`. The parser sets that with
`typeText.toLowerCase().includes('absence') ? 'Absence' : 'Tardiness'`, so
anything unexpected becomes Tardiness silently.

```sql
SELECT r ->> 'type' AS type_value, COUNT(*) AS rows
FROM run_snapshots s,
     LATERAL jsonb_array_elements(s.raw_data::jsonb) AS r
WHERE s.snapshot_type = 'monday_attendance'
GROUP BY 1 ORDER BY rows DESC;
```

## Query 5 — is the email actually the discriminator?

For the 13 rows, compare the snapshot email against the roster email directly.

```sql
SELECT e.display_name,
       e.teramind_email,
       r ->> 'employeeEmail' AS snapshot_email,
       (LOWER(TRIM(r ->> 'employeeEmail')) = LOWER(e.teramind_email)) AS matches,
       r ->> 'date' AS date_value,
       r ->> 'type' AS form_type
FROM run_snapshots s,
     LATERAL jsonb_array_elements(s.raw_data::jsonb) AS r
JOIN employees e
  ON LOWER(e.display_name) = LOWER(r ->> 'employeeName')
WHERE s.snapshot_type = 'monday_attendance'
  AND e.display_name IN ('Osvaldo Medina','Monique Luque','Carlos Aloma',
                         'Ángela Rodgers','Jennette Torrano')
ORDER BY e.display_name, date_value
LIMIT 60;
```

If `matches` is false on the days in question, the email short-circuit in
`rowMatchesEmp` is the cause and the ISO-date theory is dead.

---

## What to report

Results as markdown tables, then a **"Verdict"** stating:

1. The distinct `date` lengths in the snapshots, with counts. **A or B.**
2. Whether the six Medina/Luque dates appear in a snapshot at all.
3. If they appear, whether their `employeeEmail` matched the roster.
4. Your single best-supported explanation for the 7 missed Absence forms —
   and say explicitly if the evidence does not support one.

**Do not restate the earlier ISO conclusion unless Query 2 shows length 24.**
If it shows 10, say the earlier conclusion was wrong.

## Acceptance

1. No file was created, modified or deleted.
2. Query 2 reports the distinct `date_length` values with counts.
3. Each of the six dates is addressed individually.
4. The verdict names one explanation, or states that the evidence supports none.
