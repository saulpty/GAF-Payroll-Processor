# Timothy Moore's four disciplinary actions — test data, deleted 2026-09-07

Saul: *"delete from the DB all TImothy Moore cases those are tests i made."*

Captured before deletion so they can be re-entered if one turns out to matter.
The `pdf_*_base64` columns were deliberately **not** captured — roughly 250 KB
each — but their presence was recorded.

## The four rows

| id | ref | document_date | re-eval | warning_level | scenario | submitted_at (UTC) | PDF EN | PDF ES |
|---|---|---|---|---|---|---|---|---|
| 12 | GAF-DA-2026-5763 | 2026-07-01 | 2026-07-29 | Verbal Warning | Calls / Lead Follow-up | 2026-07-01 16:18 | ✓ | ✓ |
| 13 | GAF-DA-2026-7033 | 2026-07-01 | 2026-07-30 | First Written Warning | Calls / Lead Follow-up | 2026-07-01 16:45 | ✓ | ✓ |
| 14 | GAF-DA-2026-9269 | 2026-07-01 | 2026-07-30 | Second Written Warning | Calls / Lead Follow-up | 2026-07-01 19:35 | ✓ | ✓ |
| 17 | GAF-DA-2026-5106 | 2026-07-09 | 2026-07-16 | Verbal Warning | Operational Instructions | 2026-07-09 16:44 | ✓ | ✗ |

All four: `employee_name` **Timothy Moore**, `employee_role` Operations Manager,
`employee_branch` GAF, `manager_name` **Saul Fallenbaum**, `final_outcome`
empty.

## Two independent signs these really are tests

1. **Saul filed them under his own name**, and he says he made them.
2. **The narrative does not match the employee.** Row 12's *what happened* reads
   *"**She** only did 43 calls on may 23 and a bunch of **her** leads havent been
   touched since march…"*, and its *what was expected* reads *"**She** was
   supposed to do at least 90 calls a day"*. That text is about a different
   person and was clearly pasted in while trying the form out. Timothy Moore is
   the Jr Operations Manager, not an intake caller.

Three of the four were filed within about three hours of each other on
2026-07-01, walking the escalation ladder Verbal → First Written → Second
Written on the same scenario. That is someone exercising the form, not a real
sequence of warnings.

## What deleting them changes

| | before | after |
|---|---|---|
| actions | 16 | **12** |
| employees with a record | 10 | **9** |
| Second Written Warnings in the data | 1 | **0** |
| highest level anywhere | Second Written | **First Written** |

**No other employee has a Second Written Warning**, so that rung of the
escalation ladder now has no live instance anywhere. The ladder still renders it
— the form can still produce one at any time — but it is proved by unit test
rather than on screen, joining Final Written, Suspension/Termination, a closed
case, a null re-evaluation date and an unresolvable name.

It also costs the page its clearest demonstration: Timothy was the only row
where *highest level* and *latest action* disagreed. **Juan Molina takes over**
as the multi-action example — three actions, escalating to First Written, and
critically **two of his share a `document_date` with an identical
`submitted_at`**, so he still exercises the `id DESC` tiebreak. Timothy's rows
had distinct submission times and were never the test of that.
