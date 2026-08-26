# Payroll Master: the Exit column needs an inline width, not a Tailwind class

**`src/app/pages/PayrollMaster.tsx` is a protected file.** Visual-only, approved.
This is a follow-up to the previous change, which did not work.

## Why the last attempt failed

Entry and Exit were changed from `w-24` to `w-28`. Measured on the live page
afterwards, the inputs are still the wrong size:

| Column | input width | content width | clipped |
|---|---|---|---|
| Entry | 64px | 63px | no |
| Exit | **50px** | **54px** | **yes** |

Both cells carry the identical `w-28` class, yet they render 14px apart. The
table is `w-full` with `style={{ minWidth: 1400 }}` and 19 columns, so the
browser uses **auto table layout**: a Tailwind width class is only a hint, and
the real widths come from content. The header word "Entry" is longer than "Exit",
so the Entry column wins space and Exit gets squeezed below what `5:00 PM` needs.

`5:00 PM` still renders as `5:00 PI`.

## The change

Use the mechanism this table already relies on for its fixed columns. The sticky
Employee / Save / Delete / Date columns all use an inline style object —
`style={{ width: 192, minWidth: 192, maxWidth: 192 }}` and similar — because
that is what auto layout actually respects.

Add `style={{ width: 112, minWidth: 112 }}` to **all four** Entry / Exit
elements, keeping the `w-28` class as well:

- the Entry header `<th>` (~line 616)
- the Exit header `<th>` (~line 619)
- the Entry cell `<td>` (~line 688)
- the Exit cell `<td>` (~line 697)

112px is `w-28` expressed in pixels, giving the 54px of content plus the input's
padding and border and the cell's `px-1`, with room to spare.

Change nothing else about those four elements — keep every existing class,
including `bg-blue-50`, `text-blue-700`, `bg-blue-50/50`, the `Edit2` icon, and
the `TimeInput` with all its props.

## Do not touch

- **No other file.**
- Do not change `minWidth: 1400` on the table, any `sticky` class, the
  `left-[224px]` / `left-[264px]` offsets, or the 192 / 40 / 32 / 100 widths.
- Do not change any other column's width, any query, sort comparator, edit
  handler, save path, bulk-edit logic, undo snapshot, delete confirm or
  pagination.
- Do not add or remove an import.
- Do not change the three header labels or `tabular-nums`; they are correct.

The diff should be four added `style` attributes and nothing else.

## Acceptance criteria

- On Payroll Master with `Q2-Aug-2026`, **exit times read `5:00 PM` in full.**
  The check that matters: for every visible mono time input, `scrollWidth` must
  not exceed `clientWidth`.
- Entry times still read in full.
- The Employee, Save and Delete columns are still frozen when scrolling
  horizontally and still align with their headers.
- Row values, counts and status colours unchanged.
- No console errors.

Then confirm every identifier used in the file is imported.
