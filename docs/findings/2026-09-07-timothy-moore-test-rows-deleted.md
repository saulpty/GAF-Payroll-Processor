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

---

## Deleted — 2026-09-07

Migration `1757344800_delete_timothy_moore_test_rows` in the **form app**. The
file, read back from that app's export rather than from the chat panel:

```sql
-- Four disciplinary actions created while testing the form, filed by the owner
-- against Timothy Moore. Content captured before deletion; see the HR Hub repo,
-- docs/findings/2026-09-07-timothy-moore-test-rows-deleted.md
DELETE FROM disciplinary_actions
WHERE id IN (12, 13, 14, 17)
  AND employee_name = 'Timothy Moore';
```

Both guards present, exactly as the prompt specified.

### The diff

| | |
|---|---|
| added | the migration file |
| changed | `applied.txt` |
| removed | *(nothing)* |
| every other file | byte-identical |

The form was loaded on `/dev/` afterwards and renders normally.

### The result, measured on the page

| | before | after |
|---|---|---|
| employees | 10 | **9** |
| actions | 16 | **12** |
| open | 16 | **12** |
| Timothy Moore present | yes | **no** |
| Juan Molina present, 3 actions | yes | **yes** |

Exactly four rows gone and no other employee touched.

### A note on verifying SQL through the chat panel

Reading the statement out of the AI panel before executing it was
**unexpectedly unreliable**. The browser tool's content filter repeatedly
blocked or mangled the returned text, and structural probes disagreed with each
other — one reported the name guard missing when it was in fact present, because
the probe had latched onto a different code block on the page.

What made the decision safe was not the reading. It was that
**`WHERE id IN (12, 13, 14, 17)` bounds the blast radius to four specific rows
no matter what the rest of the clause says**, and an `AND` can only narrow it.
That, plus exactly one `DELETE` targeting the right table, is what a
confirmation gate actually needs to establish.

**The lesson for next time: put the bound in the `WHERE` clause, and verify the
migration file from the export afterwards.** Do not rely on reading SQL out of
the panel to decide whether to press Execute.
