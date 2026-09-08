# Seven docked days with a form on file — for review

**2026-09-08. Not an engineering document.** Nothing here is a system fault and
nothing has been changed. These are seven days where an employee filed a form,
the system classified the day as a justified absence and suggested paying it,
and an operator recorded it as an **unjustified absence** with a full-day
deduction instead.

That may well have been the right call each time. The point of this sheet is
that until now there was no way to see that the decision had been made.

## How these were found, and why they are certain

`payroll_entries.auto_notes` is written once by the classification engine and is
never modified afterwards — `updatePayrollEntry` does not touch it. So it
records what the engine concluded, even after a person changes the row.

All seven carry **Step 3** text — the branch that runs *when an absence form is
found*:

- `Absence form. Reason: Accident/Emergency (Suggested: Paid – Exception)`
- `Absence form. Reason: Sick (Suggested: Incapacidad)`

None carries Step 5's `NO DATA + NO FORM`. The engine was not confused and did
not miss anything. Each row was raised YELLOW for an operator, and each carries
`resolved_by` / `resolved_at`.

Full technical trail:
`docs/superpowers/prompts/2026-09-08-followups/C-misclassified-probe-RESULTS.md`.

---

## Monique Luque — four days

Manager: Chaya Lichy. Schedule: Mon–Fri, 9:00 AM–4:00 PM (her own schedule, not
the standard one).

| Date | Form | Reason given | Engine suggested | Recorded as | Docked |
|---|---|---|---|---|---|
| 2026-07-10 (Fri) | Absence | Accident / Emergency | Paid – Exception | Ausencia Injustificada | **0 min** |
| 2026-07-22 (Wed) | Absence | Sick | Incapacidad | Ausencia Injustificada | 480 min |
| 2026-07-23 (Thu) | Absence | Sick | Incapacidad | Ausencia Injustificada | 480 min |
| 2026-07-24 (Fri) | Absence | Sick | Incapacidad | Ausencia Injustificada | 480 min |

**Three consecutive sick days**, 22–24 July, each with a form filed on the day
(11:51, 11:21 and 09:13 respectively). Treated as unjustified.

Two things worth a second look:

- A run of three consecutive days with sick forms is the shape of a genuine
  illness. If a doctor's note was expected and never arrived, that is a
  documentation gap rather than an absence that never happened — and the
  engine's own suggestion was `Incapacidad`.
- **2026-07-10 was docked 0 minutes** while the other three were docked 480.
  Same employee, same classification, different outcome. Either the July 10
  decision was different in kind, or one of the four is inconsistent with the
  others. Worth asking which.

She also filed a **Tardiness** form on 2026-07-22 at 08:47 — before her 9:00
shift — and an Absence form later the same day at 11:51. That reads like someone
who intended to come in late and then could not come at all.

## Osvaldo Medina — three days

Manager: Jessica Crivelli. Note he is currently `active = false` on the roster.

| Date | Form | Reason given | Engine suggested | Recorded as | Docked |
|---|---|---|---|---|---|
| 2026-06-25 (Thu) | Absence | Accident / Emergency | Paid – Exception | Ausencia Injustificada | 480 min |
| 2026-07-13 (Mon) | Absence | Accident / Emergency | Paid – Exception | Ausencia Injustificada | 480 min |
| 2026-07-17 (Fri) | Absence | Accident / Emergency | Paid – Exception | Ausencia Injustificada | 480 min |

All three cite Accident / Emergency. The 2026-07-17 form was submitted at 15:04
— well after the shift began, which is a plausible reason an operator treated it
as unjustified. The other two were filed at 09:41 and earlier.

He also filed a **Tardiness** form on 2026-07-14 and did not arrive; that day is
one of the separate group caused by a genuine engine limitation (a Tardiness
form on a day with no punches falls through to "no form"), not by an operator
decision.

---

## Totals

**Six days docked at 480 minutes each = 2,880 minutes = 48 hours**, across two
people. The seventh day carries no deduction.

The wider figure quoted earlier — 85.83 hours across five employees — covered
thirteen rows. Three of those turned out to be seed data from the initial
migration rather than real payroll decisions, and the remainder split between
these operator decisions and the Tardiness-form gap.

## What to ask

1. Were Monique Luque's three consecutive sick days (22–24 July) meant to be
   unpaid, and was a medical note requested?
2. Why was 2026-07-10 treated differently from the other three?
3. For Osvaldo Medina, was late submission the reason, and does that policy apply
   equally to 2026-06-25 and 2026-07-13, which were filed on time?

## What changes in the app either way

Nothing automatic. The Attendance → Reports tab now flags any day recorded as an
unjustified absence that has a form on file, so this stays visible from now on
without anyone having to go looking.
