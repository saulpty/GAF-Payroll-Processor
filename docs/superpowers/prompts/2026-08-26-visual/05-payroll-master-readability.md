# Payroll Master: stop clipping the exit time, and say what the columns mean

**`src/app/pages/PayrollMaster.tsx` is a protected file.** Saul approved
visual-only changes to it. This change touches **class names, column widths and
three header labels — nothing else.** No logic, no hooks, no action calls, no
data flow, no imports added or removed, no structural JSX beyond what is listed.

Tim spends most of his time on this screen and it currently reads as a raw
spreadsheet.

## 1. The Exit column clips its own value

The Entry and Exit columns are `w-24`. The input inside is `text-xs font-mono`
with `px-1` on both the cell and the input, and the value does not fit: on the
live page an exit time renders as **`5:00 PI`** — the "M" is cut off. An operator
cannot read the time they are checking.

Change `w-24` to `w-28` in **four** places:

- the Entry header `<th>` (line ~616)
- the Exit header `<th>` (line ~619)
- the Entry cell `<td>` (line ~688)
- the Exit cell `<td>` (line ~697)

Change nothing else about those elements — keep `bg-blue-50`, `text-blue-700`,
`bg-blue-50/50`, the `Edit2` icon, the `TimeInput` and all its props.

## 2. Three headers are abbreviated to the point of being cryptic

There is no legend anywhere in the app explaining them. Change only the `label`
prop on these three `Th` elements (lines ~623-625):

| Current | New |
|---|---|
| `Late m` | `Late min` |
| `Early m` | `Early min` |
| `Disc m` | `Discount min` |

Keep each `col` prop exactly as it is — `late_minutes`, `early_leave_minutes`,
`discount_total_minutes`. Sorting must keep working. Do not touch any other
header.

## 3. Make the figures line up

On the `<table>` element at line ~600, add `tabular-nums` to the existing
className, so it becomes `w-full text-xs border-collapse tabular-nums`. Keep
`style={{ minWidth: 1400 }}` exactly as it is.

Tabular figures make a column of minutes readable at a glance because every digit
occupies the same width. It affects nothing else.

## Do not touch

- **No other file.**
- Do not change `minWidth: 1400`, any `sticky` class, any `left-[224px]` /
  `left-[264px]` offset, or the sticky column widths of 192 / 40 / 32 / 100.
  The frozen-column layout is load-bearing and fragile.
- Do not change any query, sort comparator, edit handler, save path, bulk-edit
  logic, undo snapshot, delete confirm, or pagination.
- Do not change the row tint colours, the status chips, or any other column's
  width or alignment.
- Do not add or remove an import.

The diff should be four `w-24` → `w-28`, three `label` strings, and one added
class on the table. Nothing else.

## Acceptance criteria

- Load Payroll Master with period `Q2-Aug-2026`. **Exit times read `5:00 PM` in
  full**, not `5:00 PI`.
- The three headers read `Late min`, `Early min`, `Discount min`, and clicking
  each still sorts.
- Row counts, values and the status colours are unchanged.
- The Employee, Save and Delete columns are still frozen when scrolling
  horizontally, and still line up with their headers.
- No console errors.

Then confirm every identifier used in the file is imported.
