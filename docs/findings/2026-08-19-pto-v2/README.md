# PTO Tracker v2 — what shipped, 2026-08-19

Spec: `docs/superpowers/specs/2026-08-19-pto-tracker-v2-design.md`
Plan: `docs/superpowers/plans/2026-08-19-pto-tracker-v2.md`
Prompts: `docs/superpowers/prompts/2026-08-19-pto-v2/20…26`

## The page

`/pto` is now **one table**, one row per active employee, no tabs. Columns:
Employee · Title · Start · Accrued · Taken · Available · Paid PTO · FH left ·
WFH · Birthday · Pending. TFT hours is gone, as asked.

- Header row is sticky; every column header sorts three-state (A→Z, Z→A, off).
- Search over name and title, **Only with pending**, **Show withdrawn**.
- A tooltip on each numeric header explains the rule behind the number.
- Clicking a row expands it in place into three blocks:
  - **Pending from Monday** — each request with its dates, the days the
    employee asked for, and a **Record** button.
  - **Recorded PTO** — the ledger, with the total taken, a source chip
    (Monday / Excel / Manual) and **Edit** / **Withdraw** buttons.
  - **Floating holidays** — used-of-2 with a − / + stepper, or the eligibility
    date for anyone inside their first 90 days.
- Every write refreshes that row's numbers without a page reload.

The Record dialog shows **Requested on Monday** above **Recording**, so you see
what the employee asked for and what you are entering. The "Recorded by" field
is gone; new rows are stamped `recorded_by = 'app'`, edits keep whatever was
there.

Nav: the **People** group is gone. **PTO Tracker** is a top-level section.

## The data fix

Migration `1781804100_link_excel_approvals_to_monday` stamped the Excel-imported
PTO rows with the `monday_item_id` of the request they correspond to (same
employee, same leave date).

| | before | after |
|---|---|---|
| `pto_approvals` rows | 50 | **50** (nothing inserted or deleted) |
| Excel rows with no Monday link | 48 | 6 |
| Pending from Monday | 55 | 13 |
| Recorded days total | 327.00 | 327.00 |

**42 rows linked.** Saul expected only two requests to survive (Navvad Owusu and
Elizabeth Mootoo). Thirteen did — but every one of them has *no* Excel
counterpart at all, so none is a duplicate. They are requests submitted after
the spreadsheet was last updated:

| Employee | Monday dates |
|---|---|
| Diana Rodriguez | 2026-07-06 → 07-09 |
| Domingo Cruz | 2026-09-01 → 09-07, 09-24 → 09-28, 12-07 → 12-11 |
| Elizabeth Mootoo | 2026-08-17 → 09-07 |
| Gabriela Jaen | 2026-06-16 → 06-23 |
| Jeanine Puyol | 2026-08-20 → 08-21, 08-27 → 09-03 |
| Juan Molina | 2026-08-10 → 08-24 |
| Navvad Owusu | 2026-08-26 → 08-27 |
| Ulla Hees | 2026-08-17 → 08-24, 08-24 → 08-31, 08-31 → 09-07 |

Eleven of those belong to active employees and show on the page; Diana Rodriguez
and Juan Molina are not in the active list, which is why the page reads
**11 pending** and the database says 13. Each needs recording in the app, or
deleting on Monday so the next sync drops it.

## Two bugs found and fixed during the build

1. **The breakdown was empty for everyone.** `useLoadAction` was called with the
   parameter object wrapped in a second `params` key, so `{{params.employee_id}}`
   was undefined. Fixed to the flat form every other load uses.
2. **The Start column printed `2026-02-02T00:00:00.000Z`.** Postgres returns
   `start_date::text` as a timestamp; the display now slices to 10 characters.
   No `Date` is ever constructed from a date string.

## Verification

- **87/87 node tests pass**, including the new `ptoSort` suite and H5, which now
  fails the build if any of the seven deleted files reappears.
- Every touched file is well under the 15 KB cap (largest: `RecordApprovalDialog`
  at 11.5 KB).
- No Monday board, column or group id in code.
- **No payroll file was touched** — `git diff d482fb1..HEAD` over
  `ProcessPayroll`, `PayrollMaster`, `ActionRequired`, `classificationEngine`,
  `AdminLookups`, `teramindParser` and `src/components/ui/` is empty.
- Live checks: Domingo Cruz's breakdown shows 3 pending and "taken 11.00 d"
  matching his Taken column (2 + 9); the Record dialog shows his Monday request
  and rejects a reversed date pair with *"Return date must be on or after the
  leave date."*; "Only with pending" narrows to the right six people.

## Not done

- Withdraw and the floating-holiday stepper are wired and render, but were not
  clicked through on live data — doing so would alter a real employee's balance.
  Try Withdraw on a row you can re-Edit if you want to see it work.
- No before/after screenshots were saved to this folder; the visual record is in
  the session transcript.

## Correction to the attendance finding

`docs/findings/2026-08-19-attendance-zero-rows.md` concluded the "0 attendance"
reports were only a date-range effect. That is incomplete. On the Attendance
page, Maria Alejandra De Urriola over a 90-day window shows **DAYS TRACKED 0**
with 5 excused and 15 permission — her rows exist but *none of them is a worked
day*. So for at least some new hires the Teramind side is not landing, only
their Monday permission requests are. Worth a proper look; it is not a PTO
issue.
