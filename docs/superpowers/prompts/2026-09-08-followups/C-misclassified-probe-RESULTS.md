# The 13 misclassified days — solved, 2026-09-08

Output of `C-misclassified-probe.md`. Read-only; nothing created, modified or
deleted.

**There is no engine bug. The engine found every form, raised each day for
review, and a human resolved it to an unjustified absence.**

## What the discriminator showed

`auto_notes` is written once by the engine and never touched by
`updatePayrollEntry`, so it survives whatever an operator later does to a row.
That makes it a provenance fingerprint. Four distinct strings exist across all
`Ausencia Injustificada` rows:

| `auto_notes` | len | rows | first created | periods |
|---|---|---|---|---|
| `NO DATA + NO FORM (Suggested: Unpaid)` | 37 | 42 | 2026-07-13 | 4 |
| `NO DATA + NO FORM — Ausencia Injustificada — verify` | 51 | 16 | 2026-06-11 | 4 |
| `Absence form. Reason: Accident/Emergency (Suggested: Paid – Exception)` | 70 | **4** | 2026-06-25 | 3 |
| `Absence form. Reason: Sick (Suggested: Incapacidad)` | 51 | **3** | 2026-07-27 | 1 |

**The seven unexplained rows carry the two `Absence form.` strings.** Those are
written by **Step 3** — the branch that fires when an absence form *is* found.
Step 5's "No data + no form" string is not on them.

So Step 3 did fire. The engine saw the form, classified the day as a justified
absence, marked it YELLOW and put it in front of an operator. The row then
carries `resolved_by` / `resolved_at`, and its `event_type_1` reads
`Ausencia Injustificada` with a full-day discount.

**Verbatim from the probe: "all 7 rows traced to engine Step 3 (form found,
YELLOW raised, operator resolved to Unpaid)."**

## The other candidates, killed by measurement

- **Not a hand-load.** All seven were inserted inside the same one-minute batch
  as the rest of their period: Medina 2026-06-25 at 20:11:41 within a 418-row
  batch across 37 employees; Luque 2026-07-10 at 15:07:58 within 341 rows; the
  five Q2-Jul rows between 15:39:57 and 15:39:59 within 335 rows. That is engine
  output, not a separate import.
- **Not a re-run artefact, not a Step 2 short-circuit, not a roster exclusion.**

## The correction this forces on the earlier finding

**The "6 of 13 explained by the Step 3 / Tardiness gap" figure was wrong.**

Three of those six — Ángela Rodgers 2026-04-08 and 2026-04-15, Carlos Aloma
2026-04-10 — carry the **seed** string
(`NO DATA + NO FORM — Ausencia Injustificada — verify`, 16 rows all created at
one instant on 2026-06-11). They are seed data from
`1781189300_gaf_planilla_initial.sql`. They were never engine output, so the
Step 3 explanation never applied to them and no engine behaviour produced them.

That leaves the Tardiness-form gap accounting for at most three rows, not six —
and it remains a genuine, if smaller, engine limitation: someone who files
*Tardiness* and never arrives has no punches and no *Absence* form, so they fall
past Step 3 into Step 5.

## What this means for the 85.83 hours

They were not docked by a bug. They were docked by a person, deliberately,
after the system showed them the form and suggested paying the day.

Whether those decisions were right is an HR question, not an engineering one.
Possible legitimate reasons: the form arrived after the fact, the reason was
judged insufficient, a medical note was never produced, or the absence was
already covered another way. The engine's own suggestions were
`Paid – Exception` (Accident/Emergency) and `Incapacidad` (Sick); an operator
chose Unpaid instead.

**Nothing should be re-run or reversed on engineering initiative.** The list of
seven, with dates, employees, the reason on the form and who resolved each row,
is what a person should review:

| Employee | Date | Form reason | Engine suggested |
|---|---|---|---|
| Osvaldo Medina | 2026-06-25 | Accident/Emergency | Paid – Exception |
| Monique Luque | 2026-07-10 | Accident/Emergency | Paid – Exception |
| Osvaldo Medina | 2026-07-13 | Accident/Emergency | Paid – Exception |
| Osvaldo Medina | 2026-07-17 | Accident/Emergency | Paid – Exception |
| Monique Luque | 2026-07-22 | Sick | Incapacidad |
| Monique Luque | 2026-07-23 | Sick | Incapacidad |
| Monique Luque | 2026-07-24 | Sick | Incapacidad |

Four of the seven belong to Monique Luque across three consecutive days
(07-22 → 07-24) with sick forms, and three to Osvaldo Medina. Two people, two
episodes. That pattern is worth a manager's eye regardless of the payroll
outcome.

## What changes in the app

**Nothing in the engine.** The Reports tab's
`recordedUnexplainedButFormOnFile` flag is still exactly right and becomes more
useful than first thought: it does not mark a bug, it marks *a day where an
operator overrode the system's own suggestion*. That is a legitimate thing for a
manager to be able to see, and there was previously no way to see it.

The flag's wording on screen should change from implying an error to describing
the fact. Something closer to *"recorded as an unjustified absence although a
form was filed"* rather than *"payroll recorded this as unexplained, but a form
is on file"*.
