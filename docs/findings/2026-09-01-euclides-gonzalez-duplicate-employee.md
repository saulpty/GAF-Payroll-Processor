# Euclides Gonzalez exists twice, and his contract is attached to the dead one

Found 2026-09-01, by the new Contracts page, immediately after Saul re-synced
the Monday mirrors. He was the only employee showing a
*"Not on Onboarding board"* chip.

## What the data says

`employees` holds **two records for the same person**:

| id | email | active |
|---|---|---|
| 47 | `javierqvistgaard@hotmail.com` | **false** |
| 49 | `javier.g@passiontocarehc.com` | **true** |

Same name, same role (`Intake 1`), same manager (`Marcela Gordon`), same start
date (`2026-07-21`). A personal email replaced by a company one — the record
looks to have been **recreated rather than edited**.

His Onboarding board row is fine and matched:

```
monday_item_id 12557908351, employee_id 47, deleted_on_monday false,
state GA, start 2026-07-21, contract_end 2027-01-21
```

**It points at 47 — the deactivated record.** The Contracts page lists 49,
the active one, which has no board row. Hence the chip.

The mirror itself is healthy: 45 rows, 0 flagged deleted, **0 unmatched**.
Nothing is broken in the sync. The duplicate is in `employees`.

## Why it matters beyond a chip

`monday_contracts.employee_id` is how every join reaches contract data. While it
points at an inactive record:

- Euclides's contract end (**2027-01-21**) is attached to an employee nobody
  queries, so he would never appear in a "contracts ending soon" count.
- Anything else keyed the same way — Employee 360 when it is built — inherits
  the same blind spot.
- Two records for one person is exactly the shape that produced the
  wrong-manager incident in `BACKLOG.md` #3.

He is also the employee from the 2026-08-25 weekend-schedule incident, who read
as a chronic absentee until his schedule was assigned. Worth checking which of
the two ids carries his `schedule_id` and his payroll history.

## What is NOT wrong

- The Contracts page behaved correctly: it showed the chip rather than silently
  dropping him or inventing data. This was the first live instance of an edge
  case that had zero occurrences when the page was built.
- The name-matching worked. The board row matched a real employee — just the
  older one, which is the only one that existed when it first matched.

## What to do — a decision for Saul, not a migration to run

The safe fix is to merge, not delete: decide which id survives (49 is active and
has the company email), repoint `monday_contracts.employee_id` at it, and make
sure no payroll or PTO history is stranded on 47.

**Do not simply delete 47.** Check first what references it — `payroll_entries`,
`pto_approvals`, `monday_requests`, `monday_attendance_forms`, `schedule_id`.

A name alias will not fix this: aliasing maps a board name to an employee, and
both records carry the same name.

## Open question, unrelated to the duplicate

Saul reports Johann Morante's State is visible on the board in column
`color_mkpt5gk4`. Our read after the re-sync shows the **mirror**
(`lookup_mktc2x46`) holding `GA` and `color_mkpt5gk4` **empty** for him. Worth
confirming what each column is titled on the board before anyone changes
`monday_col_onboarding_state`, which currently points at the mirror and is now
producing correct values for all 45.

---

# RESOLVED — merged 2026-09-02, migration `1781992000`

Saul authorised the merge. **49 survives; 47 is gone.**

The collision check ran first and found **zero** date-level duplicates between
the two records, so all 10 `Q2-Jul-2026` payroll rows moved cleanly. Both
`pto_employees` rows were `NULL` / `0`, so collapsing them lost nothing.

**The already-paid period's totals did not move.** Those 10 rows were
re-attributed to 49, not deleted. The whole merge ran as one transaction with
the `RESTRICT` foreign key on `payroll_entries` left in place — the final
`DELETE FROM employees WHERE id = 47` could only succeed once every reference
had moved, which is what made it safe to run at all.

Verified on the page rather than only in SQL:

- Euclides Gonzalez reads `Intake 1`, `GA`, start `07-21-2026`, tenure `1m`,
  contract end `01-21-2027` — attached to the live record.
- The *"1 employee is not on the Onboarding board"* notice is gone.
- All 45 employees have a State; zero blanks.

**Not reversible.** Once 47 was deleted the original attribution could not be
reconstructed from the data alone. Recorded in the migration header.

## The durable lesson

The board row matched 47 because `syncContracts` resolves `employee_id` **by
name**, and both records carried the same `display_name`. With one record left
the ambiguity is gone, but the *mechanism* is untouched: **any future duplicate
with a shared name will re-create this.** Making name resolution prefer the
active record is still worth doing, and is the only fix that addresses the class
rather than the instance.
