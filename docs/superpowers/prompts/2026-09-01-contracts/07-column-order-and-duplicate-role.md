# Two fixes found by loading the Contracts page

**Modify exactly two existing files:**

- `src/app/pages/contracts/ContractsTable.tsx`
- `src/app/pages/contracts/ContractRow.tsx`

**No other file may be created, modified or deleted.** Do not touch
`Contracts.tsx`, `TopNav.tsx`, `app.tsx`, `FilterBar.tsx`, `tenure.ts` or either
action. Both fixes are presentation only — **no logic, no filtering, no sorting,
and no computed value changes.** The same 44 rows, the same numbers, in the same
order.

## Fix 1 — move `Contract end` to just after `Tenure`

Current column order:

```
Employee | Position | State | Start | Tenure | 1 m | 3 m | 6 m | 1 y | 2 y | Contract end
```

Required order:

```
Employee | Position | State | Start | Tenure | Contract end | 1 m | 3 m | 6 m | 1 y | 2 y
```

**Why:** the page exists to answer *"warn me before a contract ends."* With five
milestone columns in front of it, `Contract end` falls outside the viewport at
normal widths and needs a horizontal scroll to reach — so the one thing the page
is for is the one thing you cannot see. Today exactly one contract ends within
30 days (Carlos Aloma, 2026-09-02) and it is off-screen.

Move the column in **both** the `COLUMNS` array in `ContractsTable.tsx` and the
`<td>` order in `ContractRow.tsx` so header and cells stay aligned. Change
nothing about how the cell renders — red chip inside 30 days, amber inside 60,
plain date beyond, muted `ended …` for a past date, `—` for none.

## Fix 2 — drop the duplicated role line under the employee name

The Employee cell currently renders the name with `role` beneath it in small
muted text. **`role` and `position` are the same string for all 44 employees** —
both come from Monday — so every row prints its job title twice, side by side.

Remove the sub-line. The Employee cell becomes just the name. Keep the
`Not on Onboarding board` chip and the `No start date` chip exactly as they are.

Do **not** remove the `role` field from `RawRow`, from `ContractRowData`, or from
the action — the global Role filter still filters on it, and Employee 360 will
want it. This is only about what the cell displays.

## Acceptance

- Two files changed, nothing else.
- `Contract end` is the sixth column, immediately after `Tenure`, and visible
  without horizontal scrolling at a normal window width.
- Carlos Aloma still reads `09-02-2026 · in 1 d` in a red chip and sorts first.
- Ulla Hees still reads `ended 05-19-2026`, muted, with no chip.
- Still 44 rows; the 30d filter still yields 7; the manager filter still yields
  6 for David Sallusti.
- Each employee's job title appears exactly once per row.
