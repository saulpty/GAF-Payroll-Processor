# Read-only probe: the 7 Absence forms Step 3 should have caught

**Write no files. Create nothing. Modify nothing. Delete nothing.**

This is a read-only investigation. Do not create or edit an action, page,
component, migration, lib module, test or document. Do not "fix" anything you
find. Do not run a migration. Run the queries and report the results.

**A previous prompt with these same instructions was disobeyed and three files
were edited.** That is why this paragraph exists. If at any point you believe a
file must change in order to answer a question here, **say so and stop** — name
the file, say what you would change and why, and wait. Do not change it. An
answer with an unwanted edit attached is worse than no answer.

Database: `GAF Planilla DB`.

---

## Why

13 days are stamped `event_type_1 = 'Ausencia Injustificada'` — the engine's
Step 5, *"No data + no form"* — while an attendance form exists for that
employee on that date. **5,150 discount minutes = 85.83 hours across 5
employees**, in periods that are already processed and paid.

Two rounds have already run. Read both before starting, and do not repeat them:

- `docs/superpowers/prompts/2026-09-07-attendance-reports/00d-misclassified-noshows-RESULTS.md`
- `docs/superpowers/prompts/2026-09-07-attendance-reports/00ef-absence-form-miss-RESULTS.md`

**6 of the 13 are explained.** `classificationEngine.ts:583` fires Step 3 only
when `absenceForms.length > 0`, and that array is filtered to `type ===
'Absence'` (~line 512). Someone who filed **Tardiness** and never arrived falls
past Step 3 and Step 4 into Step 5.

**7 are not.** They had an **Absence** form — the exact thing Step 3 exists to
catch.

**Two hypotheses are dead. Do not resurrect them:**

- **Email mismatch.** For the six Medina/Luque dates the snapshot emails matched
  the roster exactly.
- **ISO date format.** Every `date` value in every `run_snapshots` attendance
  snapshot measures `LENGTH() = 10`. No 24-character value exists. The earlier
  "confirmed" ISO diagnosis was read from the wrong column
  (`monday_attendance_forms.form_date`, a Postgres `DATE` that renders as an ISO
  timestamp).

The forms were present in the `Q2-Jul-2026` attendance snapshot with the right
person, the right day and the right type.

### The seven rows

| Employee | Work date | Form | Reason | Discount min |
|---|---|---|---|---|
| Osvaldo Medina | 2026-06-25 | Absence | Accident/Emergency | 480 |
| Osvaldo Medina | 2026-07-13 | Absence | Accident/Emergency | 480 |
| Osvaldo Medina | 2026-07-17 | Absence | Accident/Emergency | 480 |
| Monique Luque | 2026-07-10 | Absence | Accident/Emergency | **0** |
| Monique Luque | 2026-07-22 | Absence | Sick | 480 |
| Monique Luque | 2026-07-23 | Absence | Sick | 480 |
| Monique Luque | 2026-07-24 | Absence | Sick | 480 |

---

## Two corrections you must carry into this round

The last round produced a confident wrong answer by reasoning from a value it
had never measured. Two of the beliefs it left behind are themselves unmeasured.

### 1. `submitted_at` is not a submission time

`syncAttendanceForms.ts` sets it from the **same Monday column as the form
date**:

```ts
const formDate  = parseDate(item, k.monday_col_attendance_date);
// submitted_at: use date text as-is (may include time on some Monday column types)
const submittedAt = colText(item, k.monday_col_attendance_date);
```

So `monday_attendance_forms.submitted_at` is the date the absence is *for*,
rendered as text — not when anyone filed anything. **The claim "all 13 forms
were filed before the period was processed" rests on that column and is
therefore not established.** Timing is back on the table. Treat it as an open
candidate, not a closed one.

Nothing in the mirror records when a Monday item was created: `pullAllItems`
never requests `created_at`, so the `raw` JSONB does not contain it either. The
only evidence of what the board held at a given moment is a `run_snapshots` row.

### 2. `480` does not prove the row bypassed the engine

Step 5 sets `discount_total_minutes = cfg.full_day_absence_discount_minutes`
(**420** by default) and leaves `pay_impact_1` blank. `computeDiscount`'s
`fullDayMinutes` parameter defaults to **480**, and an operator saving the row
from Action Required or Payroll Master with pay impact `Unpaid` recomputes it to
480. `updatePayrollEntry` never touches `auto_notes` or `initial_status`.

So **480 + engine `auto_notes` = engine Step 5, later resolved by a human** —
which is entirely consistent with the engine having produced these rows. Do not
read 480 as evidence of a non-engine origin. Measure `pay_impact_1`,
`payroll_ready`, `created_at` and `updated_at` and say which story they fit.

---

## Query 1 — the anchor: everything about the seven rows

Run this first. Several later questions are answered from its output.

```sql
WITH targets(emp_name, d) AS (VALUES
  ('Osvaldo Medina','2026-06-25'),
  ('Osvaldo Medina','2026-07-13'),
  ('Osvaldo Medina','2026-07-17'),
  ('Monique Luque','2026-07-10'),
  ('Monique Luque','2026-07-22'),
  ('Monique Luque','2026-07-23'),
  ('Monique Luque','2026-07-24')
)
SELECT e.display_name,
       t.d                              AS work_date,
       pe.id                            AS entry_id,
       pe.period_name,
       pe.event_type_1, pe.pay_impact_1, pe.event_type_2, pe.pay_impact_2,
       pe.documentation,
       pe.notes,
       pe.auto_notes,
       LENGTH(pe.auto_notes)            AS auto_notes_len,
       (pe.auto_notes = 'NO DATA + NO FORM (Suggested: Unpaid)') AS is_engine_step5_text,
       pe.discount_total_minutes,
       pe.payroll_ready, pe.initial_status, pe.status_current,
       pe.entry_time, pe.exit_time,
       pe.created_at::text              AS row_created_at,
       pe.updated_at::text              AS row_updated_at,
       pe.deleted_at::text              AS row_deleted_at,
       pe.resolved_by,
       pe.resolved_at::text
FROM targets t
JOIN employees e ON e.display_name = t.emp_name
LEFT JOIN payroll_entries pe
       ON pe.employee_id = e.id
      AND LEFT(pe.work_date, 10) = t.d
ORDER BY e.display_name, t.d;
```

**Do not filter `deleted_at`.** If a row is soft-deleted, say so. If a target
date returns more than one row (two periods claiming the same day) or no row at
all, say that too — either is a finding.

**Report `auto_notes` verbatim for all seven**, and report
`is_engine_step5_text` as a plain true/false per row.

---

## Candidate A — the rows are not engine output

If those days were loaded by the Excel import or the seed migration rather than
produced by a payroll run, no engine logic ever applied and there is nothing in
`classificationEngine.ts` to explain.

The engine's Step 5 stamps exactly `NO DATA + NO FORM (Suggested: Unpaid)`
(`classificationEngine.ts:649`). The hand-loaded rows stamp something else:
`1781189300_gaf_planilla_initial.sql` uses
`NO DATA + NO FORM — Ausencia Injustificada — verify`. Different strings, so
`auto_notes` is an exact-match provenance test.

### A1 — the census of `auto_notes` strings

```sql
SELECT auto_notes,
       LENGTH(auto_notes) AS len,
       COUNT(*)           AS rows,
       MIN(created_at)::text AS first_created,
       MAX(created_at)::text AS last_created,
       COUNT(DISTINCT period_name) AS periods
FROM payroll_entries
WHERE event_type_1 = 'Ausencia Injustificada'
GROUP BY auto_notes
ORDER BY rows DESC;
```

### A2 — the control group, which validates the test itself

Three of the six *explained* rows are April dates, and April is inside the seed
migration's range (`Q2-Mar-2026` … `Q2-May-2026`). If the discriminator works,
those rows should carry the **seed** string, not the engine one — which would
mean the Step 3 / Tardiness explanation was never the reason for them either.

```sql
SELECT e.display_name,
       LEFT(pe.work_date, 10) AS work_date,
       pe.period_name,
       pe.auto_notes,
       (pe.auto_notes = 'NO DATA + NO FORM (Suggested: Unpaid)') AS is_engine_step5_text,
       pe.discount_total_minutes, pe.pay_impact_1,
       pe.created_at::text AS row_created_at,
       pe.updated_at::text AS row_updated_at
FROM payroll_entries pe
JOIN employees e ON e.id = pe.employee_id
WHERE pe.event_type_1 = 'Ausencia Injustificada'
  AND LEFT(pe.work_date, 10) IN
      ('2026-04-08','2026-04-10','2026-04-15','2026-07-14','2026-07-22','2026-08-11')
  AND (e.display_name ILIKE '%Rodgers%' OR e.display_name ILIKE '%Aloma%'
    OR e.display_name ILIKE '%Medina%'  OR e.display_name ILIKE '%Luque%'
    OR e.display_name ILIKE '%Torrano%')
ORDER BY work_date, e.display_name;
```

### A3 — the second, independent provenance test: creation batches

`payroll_entries.created_at` is written once on INSERT and never updated
(`upsertPayrollEntries` sets `updated_at = NOW()` on conflict, not `created_at`).
A payroll run inserts a whole period's rows within a minute or two. A migration
inserts them all at one instant. So the seven rows should sit in the *same*
creation batch as their period-mates.

```sql
SELECT pe.period_name,
       date_trunc('minute', pe.created_at)::text AS created_minute,
       COUNT(*) AS rows,
       COUNT(DISTINCT pe.employee_id) AS employees,
       COUNT(*) FILTER (WHERE e.display_name IN ('Osvaldo Medina','Monique Luque')) AS target_employee_rows
FROM payroll_entries pe
JOIN employees e ON e.id = pe.employee_id
WHERE pe.period_name IN ('Q2-Jun-2026','Q1-Jul-2026','Q2-Jul-2026')
GROUP BY 1, 2
ORDER BY 1, 2;
```

Use whichever `period_name` values Query 1 actually returned; the three above
are what the earlier results file recorded. **Do not assume them — confirm.**

### A4 — is the work date even inside its period's window?

The engine only emits rows for dates between the run's `startDate` and
`endDate`. A row whose `work_date` falls outside its period's window cannot be
that period's engine output.

```sql
SELECT period_name, start_date::text, end_date::text, processed_at,
       employee_count, day_count, green_count, yellow_count, red_count
FROM periods
WHERE period_name IN ('Q2-Jun-2026','Q1-Jul-2026','Q2-Jul-2026')
ORDER BY start_date;
```

State, per target row, whether its work date lies inside its period's
`start_date … end_date`.

**What kills Candidate A:** all seven carry `auto_notes` exactly equal to
`NO DATA + NO FORM (Suggested: Unpaid)`, sit in the same creation minute as
their period-mates, and fall inside their period's window. Then they are engine
output and the question moves on.

**What confirms it:** any of the seven carries a different `auto_notes` string,
or was created at an instant when nothing else in the period was created, or
falls outside its period's date window.

---

## Candidate B — a re-run left them behind

`ProcessPayroll.tsx` has a single-employee mode. It runs the engine over
everyone, then filters: `allEntries.filter(e => singleEmpIds.includes(...))`.
`excludedIds` removes people before the engine loop
(`classificationEngine.ts:427`). `upsertPayrollEntries` never deletes, and
`softDeleteStaleEntries` is scoped to `processedIds` — so in single-employee
mode it cannot touch anyone else. A row can therefore survive from an earlier
run while a later run fixed everyone else.

The signature is a row whose `updated_at` is **older** than its period-mates'.

### B1 — the update batches, per period

```sql
SELECT pe.period_name,
       date_trunc('minute', pe.updated_at)::text AS updated_minute,
       COUNT(*) AS rows,
       COUNT(DISTINCT pe.employee_id) AS employees,
       COUNT(*) FILTER (WHERE e.display_name IN ('Osvaldo Medina','Monique Luque')) AS target_employee_rows
FROM payroll_entries pe
JOIN employees e ON e.id = pe.employee_id
WHERE pe.period_name IN ('Q2-Jun-2026','Q1-Jul-2026','Q2-Jul-2026')
GROUP BY 1, 2
ORDER BY 1, 2;
```

### B2 — each target row against its own period's last write

```sql
WITH targets(emp_name, d) AS (VALUES
  ('Osvaldo Medina','2026-06-25'), ('Osvaldo Medina','2026-07-13'),
  ('Osvaldo Medina','2026-07-17'), ('Monique Luque','2026-07-10'),
  ('Monique Luque','2026-07-22'), ('Monique Luque','2026-07-23'),
  ('Monique Luque','2026-07-24')
), rows AS (
  SELECT pe.*, e.display_name
  FROM targets t
  JOIN employees e ON e.display_name = t.emp_name
  JOIN payroll_entries pe ON pe.employee_id = e.id AND LEFT(pe.work_date,10) = t.d
)
SELECT r.display_name,
       LEFT(r.work_date,10) AS work_date,
       r.period_name,
       r.updated_at::text                       AS row_updated_at,
       agg.period_max_updated::text             AS period_last_write,
       (agg.period_max_updated - r.updated_at)  AS behind_by,
       agg.rows_in_period,
       agg.rows_updated_later
FROM rows r
JOIN LATERAL (
  SELECT MAX(p2.updated_at) AS period_max_updated,
         COUNT(*)           AS rows_in_period,
         COUNT(*) FILTER (WHERE p2.updated_at > r.updated_at) AS rows_updated_later
  FROM payroll_entries p2
  WHERE p2.period_name = r.period_name
) agg ON true
ORDER BY r.display_name, work_date;
```

### B3 — how many runs each period actually had

Every run writes three snapshots (`teramind`, `monday_attendance`,
`monday_permissions`) **before** the engine executes — and before the mapping
and warnings gates, either of which the operator can abandon. So a snapshot
proves a run was *started*, not that it finished.

```sql
SELECT id, period_name, snapshot_type,
       created_at::text,
       LENGTH(raw_data) AS raw_bytes,
       CASE WHEN snapshot_type IN ('monday_attendance','monday_permissions')
            THEN jsonb_array_length(raw_data::jsonb) END AS rows_in_snapshot
FROM run_snapshots
WHERE period_name IN ('Q2-Jun-2026','Q1-Jul-2026','Q2-Jul-2026')
ORDER BY period_name, created_at, snapshot_type;
```

**What kills Candidate B:** every target row's `updated_at` equals its period's
last write batch — nothing was left behind, the final run produced these rows as
they stand.

**What confirms it:** `behind_by` is non-zero on the target rows while the rest
of the period moved on.

---

## Candidate C — Step 2 short-circuited on a permission

Full-day permission is evaluated before Step 3, so a permission covering the
date would exit earlier. Weak — it would produce `PTO` / `Permiso Remunerado` /
`Permiso No remunerado`, not `Ausencia Injustificada` — but cheap to settle.

### C1 — the mirror

```sql
SELECT e.display_name, r.monday_item_id, r.board_group,
       r.request_type, r.permission_type,
       r.start_date::text, r.end_date::text, r.return_date::text,
       r.reason, r.deleted_on_monday
FROM monday_requests r
JOIN employees e ON e.id = r.employee_id
WHERE e.display_name IN ('Osvaldo Medina','Monique Luque')
  AND r.start_date <= DATE '2026-07-24'
  AND r.end_date   >= DATE '2026-06-25'
ORDER BY e.display_name, r.start_date;
```

### C2 — what the run actually saw

The engine reads the live Permissions board, not the mirror, so test the
permissions snapshot as well.

```sql
SELECT s.period_name, s.created_at::text,
       x ->> 'employeeName'  AS employee_name,
       x ->> 'employeeEmail' AS employee_email,
       x ->> 'requestType'   AS request_type,
       x ->> 'startDate'     AS start_date,
       x ->> 'endDate'       AS end_date
FROM run_snapshots s,
     LATERAL jsonb_array_elements(s.raw_data::jsonb) AS x
WHERE s.snapshot_type = 'monday_permissions'
  AND (LOWER(COALESCE(x ->> 'employeeEmail','')) IN
        ('ozzy.m@avondalecaregrouppa.com','monique.l@passiontocarehc.com')
       OR x ->> 'employeeName' ILIKE '%Medina%'
       OR x ->> 'employeeName' ILIKE '%Luque%')
  AND (x ->> 'startDate') <= '2026-07-24'
  AND (x ->> 'endDate')   >= '2026-06-25'
ORDER BY s.created_at, employee_name;
```

**What kills Candidate C:** no permission row of any kind covers any of the
seven dates in either the mirror or the snapshots. Say so and close it.

---

## Candidate D — the form was not on the board when the run happened

This is the candidate the broken `submitted_at` column was hiding. Snapshots are
the only record of what the board actually held, and they are timestamped, so
they can be lined up against each row's `created_at` / `updated_at`.

### D1 — is the form in each snapshot, in time order

```sql
WITH targets(emp_name, email, d) AS (VALUES
  ('Osvaldo Medina','ozzy.m@avondalecaregrouppa.com','2026-06-25'),
  ('Osvaldo Medina','ozzy.m@avondalecaregrouppa.com','2026-07-13'),
  ('Osvaldo Medina','ozzy.m@avondalecaregrouppa.com','2026-07-17'),
  ('Monique Luque','monique.l@passiontocarehc.com','2026-07-10'),
  ('Monique Luque','monique.l@passiontocarehc.com','2026-07-22'),
  ('Monique Luque','monique.l@passiontocarehc.com','2026-07-23'),
  ('Monique Luque','monique.l@passiontocarehc.com','2026-07-24')
)
SELECT t.emp_name,
       t.d                    AS form_date,
       s.id                   AS snapshot_id,
       s.period_name          AS snapshot_period,
       s.created_at::text     AS snapshot_created_at,
       EXISTS (
         SELECT 1 FROM jsonb_array_elements(s.raw_data::jsonb) x
         WHERE  x ->> 'date' = t.d
           AND  x ->> 'type' = 'Absence'
           AND  LOWER(TRIM(COALESCE(x ->> 'employeeEmail',''))) = t.email
       ) AS absence_form_present_by_email,
       EXISTS (
         SELECT 1 FROM jsonb_array_elements(s.raw_data::jsonb) x
         WHERE  x ->> 'date' = t.d
           AND (x ->> 'employeeName' ILIKE '%' || split_part(t.emp_name,' ',2) || '%')
       ) AS any_form_present_by_name
FROM targets t
CROSS JOIN run_snapshots s
WHERE s.snapshot_type = 'monday_attendance'
ORDER BY t.emp_name, t.d, s.created_at;
```

Note the snapshot stores Osvaldo Medina as **"Ozzy Medina"** — that is why the
name test matches on surname only.

### D2 — read the alignment off explicitly

Put D1 next to Query 1 and state, **for each of the seven rows**:

- the `created_at` and `updated_at` of the payroll row,
- the latest `monday_attendance` snapshot at or before that `updated_at`,
- and whether the form was present in **that** snapshot.

That is the decisive statement. If the form is missing from the snapshot the run
used but present in later ones, the board did not have it when the row was
written and the engine never had anything to find.

**What kills Candidate D:** the form is present in every snapshot taken at or
before the row's own `updated_at`. Then the engine was handed the form and still
reached Step 5, and the defect is in the code path, not the data or the clock.

---

## Candidate E — the person was not in the run's roster

`loadEmployees` returns only `active = TRUE AND excluded_from_payroll = FALSE`,
and `runClassificationEngine` skips `excludedEmployeeIds` before the date loop.
Osvaldo Medina is reported inactive today. If he was inactive or excluded when
the period ran, the engine produced no rows for him at all — and whatever wrote
these rows was not that run.

```sql
SELECT e.id, e.display_name, e.teramind_email, e.company_domain,
       e.active, e.excluded_from_payroll, e.is_grace_list, e.is_macbook_swap,
       e.start_date::text, e.end_date::text,
       s.schedule_name, s.work_days, s.grace_minutes
FROM employees e
LEFT JOIN schedules s ON s.id = e.schedule_id
WHERE e.display_name ILIKE '%Medina%' OR e.display_name ILIKE '%Luque%'
ORDER BY e.display_name;
```

```sql
SELECT a.alias_text, a.employee_id, e.display_name
FROM name_aliases a
JOIN employees e ON e.id = a.employee_id
WHERE e.display_name ILIKE '%Medina%' OR e.display_name ILIKE '%Luque%'
ORDER BY e.display_name, a.alias_text;
```

**Report the number of employee rows returned.** More than one row for either
person is itself a finding — employee ids have been merged before
(`1781992000_merge_employee_47_into_49.sql`), and a duplicate roster row would
mean forms resolve to one id while payroll rows live under another.

`active` and `excluded_from_payroll` are current values, not historical ones, so
they cannot prove what the roster looked like in July. Say that plainly rather
than over-reading them. What they *can* do is contradict: if Medina is inactive
now and his rows were created inside the period's normal creation batch, he was
active then and something changed since.

---

## Verdict

Close with a section headed **Verdict** that does four things:

1. States, for **each** of Candidates A, B, C, D and E, one word — **dead**,
   **alive**, or **confirmed** — and the single measurement that decided it.
2. Names **one** cause for the seven rows, or says explicitly that the evidence
   supports none. Do not offer a ranked list of maybes dressed up as an answer.
   If the measurements do not settle it, say which further measurement would.
3. Says whether the April control rows (A2) carry the seed string — and if they
   do, states that the Step 3 / Tardiness explanation does not account for them
   either, and that the "6 of 13 explained" figure needs revising.
4. Says whether the `submitted_at` correction changes the earlier conclusion
   that timing was ruled out.

**Prefer measurements to inference throughout.** Where a claim can be settled by
`LENGTH()`, a `COUNT`, an exact string comparison, or printing a raw value, run
that and quote the number. If you find yourself writing "presumably", "likely"
or "would have", stop and write the query instead — and if the query cannot be
written, say the question is unanswered.

**Do not propose a code fix, and do not apply one.** Payroll is protected:
`ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
`classificationEngine.ts` and `AdminLookups.tsx` are not to be touched. Whatever
this finds, no engine change and no data repair follows without Saul's explicit
approval — including the 85.83 hours, which stay exactly as they are.

## Acceptance

1. No file was created, modified or deleted.
2. Every query ran, or the reply says which one could not and why.
3. All seven rows are addressed individually, with `auto_notes` quoted verbatim.
4. Each of Candidates A–E has a stated verdict and the measurement behind it.
5. The Verdict names one cause, or states that the evidence supports none.
6. No code fix is proposed or applied.
