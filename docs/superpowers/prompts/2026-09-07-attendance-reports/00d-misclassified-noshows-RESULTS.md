# The 13 misclassified no-shows — 2026-09-07

Output of `00d-misclassified-noshows.md`. Read-only; nothing created, modified
or deleted. Database `GAF Planilla DB`.

**Headline: 85.83 hours of discounts sit on 13 days that had a form on file,
across 5 employees. Every one of those forms was filed before the period ran.**

## Query 1 — what kind of form is behind each row

| Form type | Rows | No punches | Earliest | Latest |
|---|---|---|---|---|
| Absence | **7** | 7 | 2026-06-25 | 2026-07-24 |
| Tardiness | **6** | 5 | 2026-04-08 | 2026-08-11 |

**The hypothesis was half right.** The 6 Tardiness rows are the predicted Step 3
gap. The 7 Absence rows are not explained by it — Step 3 exists precisely for
those and should have fired. That is a second, separate defect.

## Query 2 — every row

| Employee | Manager | Work date | Period | Entry | Discount min | Form | Reason | Submitted |
|---|---|---|---|---|---|---|---|---|
| Ángela Rodgers | Lily Beasly | 2026-04-08 | Q1-Apr | — | 420 | Tardiness | — | 04-08 11:54 |
| Carlos Aloma | Marcela Gordon | 2026-04-10 | Q1-Apr | **11:50 AM** | 170 | Tardiness | — | 04-10 … |
| Ángela Rodgers | Lily Beasly | 2026-04-15 | Q2-Apr | — | 240 | Tardiness | — | 04-15 08:50 |
| Osvaldo Medina | Jessica Crivelli | 2026-06-25 | Q2-Jun | — | 480 | Absence | Accident/Emergency | 06-25 … |
| Monique Luque | Chaya Lichy | 2026-07-10 | Q1-Jul | — | **0** | Absence | Accident/Emergency | 07-10 … |
| Osvaldo Medina | Jessica Crivelli | 2026-07-13 | Q2-Jul | — | 480 | Absence | Accident/Emergency | 07-13 09:41 |
| Osvaldo Medina | Jessica Crivelli | 2026-07-14 | Q2-Jul | — | 480 | Tardiness | — | 07-14 08:47 |
| Osvaldo Medina | Jessica Crivelli | 2026-07-17 | Q2-Jul | — | 480 | Absence | Accident/Emergency | 07-17 15:04 |
| Monique Luque | Chaya Lichy | 2026-07-22 | Q2-Jul | — | 480 | Absence | Sick | 07-22 11:51 |
| Monique Luque | Chaya Lichy | 2026-07-22 | Q2-Jul | — | 480 | Tardiness | — | 07-22 08:47 |
| Monique Luque | Chaya Lichy | 2026-07-23 | Q2-Jul | — | 480 | Absence | Sick | 07-23 11:21 |
| Monique Luque | Chaya Lichy | 2026-07-24 | Q2-Jul | — | 480 | Absence | Sick | 07-24 09:13 |
| Jennette Torrano | Marcela Gordon | 2026-08-11 | Q2-Aug | — | 480 | Tardiness | — | 08-11 08:47 |

Three things stand out:

- **Carlos Aloma, 2026-04-10, punched in at 11:50 AM.** He was there. The row
  says `Ausencia Injustificada` with a 170-minute discount while a Tardiness
  form is on file. This one is not a no-show at all.
- **Monique Luque, 2026-07-22 appears twice** — an Absence form at 11:51 and a
  Tardiness form at 08:47, the duplicate-form pattern from `00c`.
- **Monique Luque, 2026-07-10 carries a 0-minute discount** while the other
  twelve carry 170–480. Worth knowing why before assuming the discount rule is
  uniform.

## Query 3 — timing is not the explanation

| Metric | Count |
|---|---|
| Rows with a form | 13 |
| **Filed before the period was processed** | **13** |
| Filed after the period was processed | 0 |
| Period never processed | 0 |

The engine pulls Monday live during a run, and in all 13 cases the form already
existed. It had the data and did not use it.

## Query 4 — the cost

| Metric | Value |
|---|---|
| Rows | 13 |
| Total discounted minutes | **5,150** |
| Total discounted hours | **85.83** |
| Employees affected | **5** |

Ángela Rodgers, Carlos Aloma, Osvaldo Medina, Monique Luque, Jennette Torrano.
These periods are already processed, so the deduction was applied as it stands.

## Query 6 — the two long stretches are genuine

**No requests exist on file for Cemiriamiz Iglesias or Euclides Gonzalez** —
none at all. Their ten- and nine-day stretches (2026-07-27 → 08-07) have no
form, no permission, no PTO. They are real unexplained absences, not a data
gap, and they are *not* among the 5 employees above.

## Two defects, one confirmed and one not

**1. The Tardiness gap — confirmed by reading the code.** Step 3
(`classificationEngine.ts:583`) fires only when `absenceForms.length > 0`, and
`absenceForms` filters to `type === 'Absence'` (`:512-514`). Someone who filed
Tardiness and then never arrived has no punches and no Absence form, so they
fall past Step 3 and Step 4 into Step 5's "No data + no form". 6 rows.

**2. The Absence rows — mechanism unknown.** 7 rows had an Absence form that
Step 3 should have caught. The probe does not explain these and I will not
guess at a cause I have not evidenced. Candidates, all unverified:

- `rowMatchesEmp` failed at run time for these people (Osvaldo Medina is
  inactive with a null roster role; both he and Monique Luque are among the
  employees whose names have needed aliases before).
- The live pull in `ProcessPayroll.tsx` parses the Monday Date column
  differently from the mirror's `parseDate`, so `r.date === dateStr` missed.
  The mirror's `form_date` is known correct; the live path is a separate
  implementation and was not checked.
- The form was outside the period window the run pulled.

Distinguishing these needs a probe against the live pull path, not the mirror.

## What this does and does not change

**It does not change the Reports tab's design.** The tab reads stored rows, so
it must show what the payroll actually did — and flag the contradiction rather
than hide it. A day stamped `Ausencia Injustificada` that has a form behind it
gets its own treatment: *"recorded as unexplained, but a form is on file"*.
That is a manager-visible discrepancy, not something to silently correct.

**Payroll is untouchable without Saul's say-so** (CLAUDE.md). The engine is not
being changed here, and the 85.83 hours are not being re-run. Both are decisions
for Saul, recorded and raised.
