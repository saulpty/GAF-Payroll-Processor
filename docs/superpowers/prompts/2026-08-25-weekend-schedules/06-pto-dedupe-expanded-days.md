# Prompt 38 — PTO day count must not double-count days already recorded

Sent to UIB on 2026-08-25, immediately after prompt 37. Same file.

**Why this is needed.** Prompt 37 generalised the PTO off-day expansion from a
hardcoded Friday to each employee's own `work_days`. Verifying it on
Q2-Aug-2026 showed the period total move from 30 to 33 — but the true number of
distinct PTO days is **24**.

Prompt 37 rested on an assumption that turned out to be false: that PTO rows
only exist on an employee's working days. They do not. A multi-day leave request
is recorded on **every calendar day it spans**, weekends included:

| Employee | Actual PTO rows | True distinct days | Old rule | After prompt 37 |
|---|---|---|---|---|
| Elizabeth Mootoo | Mon 17 → Mon 24, inclusive | 8 | 10 | 11 |
| Tanya Bedoya | Mon 17 → Sun 23 | 7 | 9 | 10 |
| Ulla Hees | Mon 17 → Mon 24 | 8 | 10 | 11 |
| Jeanine Puyol | Thu 20 only | 1 | 1 | 1 |
| **total** | | **24** | **30** | **33** |

So the expansion appends a Saturday or Sunday that is *already* a PTO row, and
`pto_agg` counts it twice because it does `COUNT(*)` over a `UNION ALL`. The
old Friday-only rule already had this defect; prompt 37 widened it by one day
per affected employee, because a Saturday PTO row now also expands into Sunday.

The generalisation in prompt 37 is still correct and should stay. It just needs
to stop counting the same day more than once.

---

## The prompt

In `src/actions/loadHrkSummary.ts`, the `pto_with_offdays` CTE can produce the
same `(employee_id, work_date)` pair more than once, because a PTO day expanded
into a following off-day may already be a recorded PTO row in its own right. A
multi-day leave is recorded on every calendar day it spans, so this happens
whenever leave covers a weekend. `pto_agg` then counts that day twice.

**Modify exactly one file:** `src/actions/loadHrkSummary.ts`
**Do not modify any other file.**

### The change

In the `pto_with_offdays` CTE, change the two `UNION ALL` operators to `UNION`
so identical `(employee_id, work_date)` pairs collapse to one.

That is the entire change — two words. Do not restructure the CTE, do not
change the three `SELECT` branches, do not change the off-day predicates added
by prompt 37, and do not touch `pto_agg`.

### Constraints

- **Do not change anything else in this file.** In particular do not touch
  `base_hours` and its `EXTRACT(DOW FROM d) BETWEEN 1 AND 6` — that is the
  paid-rest-day rule, confirmed correct by the owner. Leave the Constancia regex
  parsing, `discount_agg`, `incapacidad_agg`, `notes_agg`, the `deleted_at`
  filters and the final `SELECT` list exactly as they are.
- `UNION` is correct rather than `SELECT DISTINCT` in `pto_agg`, because the
  duplication is created by the set union itself and should be resolved there.
- The output column list must not change.

### Acceptance criteria — observable outcomes

1. **HRK Summary for Q2-Aug-2026 shows PTO Days = 24**, down from the current 33.
2. Per employee in that period: Elizabeth Mootoo 8, Ulla Hees 8, Tanya Bedoya 7,
   Jeanine Puyol 1. Each equals the number of days that person actually has a
   PTO row for.
3. The PTO Dates column for those employees lists each date **once**, in order,
   with no repeats.
4. Total Discount Hours is still **184.7h**, employee count still **45**, and
   every Base Hrs still **104** — this change touches only the PTO columns.
5. The HRK Summary page loads with no runtime error.
