# "Reported" had two sources: 25 late days showed as not reported though a form was on file

Written 2026-10-16. Measured read-only on /dev; no data changed. Fix: prompt
`superpowers/prompts/2026-10-16-punctuality/05-reported-from-forms.md`.

## In plain words

The app answered "did they report this late day?" in two places, from two sources:

- **Reports and the Why tags** look at the attendance forms themselves.
- **The List and the employee panel** looked at a note payroll writes on each day
  ("Attendance Form" in the Documentation column) **at the moment the period is processed**.

That note is a snapshot. It never updates afterwards, so it misses:

1. forms filed after payroll ran, and
2. forms payroll could not match to the person when it ran: before 2026-09-08 a form sent from
   an email one letter off matched nobody (`2026-09-08-form-email-mismatch.md`). The engine was
   fixed then, but periods already processed kept their old note — "fixing the engine never
   cleans up" (LESSONS).

Pay is not affected by this fix: payroll's note is left as it is. Only what the List and the panel
*show* changes, so they agree with Reports and the tags.

## Evidence (/dev, Dates 09/01/2026 → 10/15/2026)

| | Late days | Reported | Not reported | Absent: reported · not |
|---|---|---|---|---|
| List (payroll's note) | 462 | 196 | 266 | 0 · 10 |
| Reports (the forms) | 462 | 221 | 241 | 2 · 8 |

Same days, 25 apart, always the same way: a form on file but counted as not reported. 12 people:

| Person | Not reported (List) | Not reported (forms) |
|---|---|---|
| Aleka Papatsoris | 8 | 7 |
| Arelis Acosta | 10 | 1 |
| Charis Dixon | 1 | 0 |
| Daniel Escruceria | 6 | 4 |
| Elizabeth Mootoo | 1 | 0 |
| Gisselle Ramos | 8 | 7 |
| Jean Pierre Montfort | 8 | 7 |
| Jeanine Puyol | 7 | 6 |
| Monique Luque | 2 | 1 |
| Nichole Harris | 4 | 0 |
| Sarah Mora | 4 | 3 |
| Yessenia Moran | 21 | 19 |

Arelis's days are the clearest case: most of her "unreported" days have a Tardiness form sent
**before** her shift ("Reported Ahead" on Reports), so this is not only late filing.

## The fix (prompt 05)

- `reportedFromForms` (new, `src/app/lib/formReporting.ts`): a late or absent day is reported when
  a form exists for that employee id and that date — the rule Reports and the Why tags use.
- The List and the panel load the forms for the range and run payroll's rows through it.
- The Absent card counts an absence with a form as reported (it used to count every absence as not).
