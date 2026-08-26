# Action Required: the same readability fixes Payroll Master just got

**`src/app/pages/ActionRequired.tsx` is a protected file.** Saul approved
visual-only changes. **Class names, inline widths and two header labels only** —
no logic, no hooks, no action calls, no data flow, no imports added or removed,
no structural JSX.

This page has the identical structure and the identical defects Payroll Master
had, and the fix that worked there is known. Apply it here.

## 1. Entry and Exit clip their values

Both columns are `w-24` with a `text-xs font-mono` input inside. The table is
`w-full` with `style={{ minWidth: 1120 }}` across many columns, so the browser
uses **auto table layout** — a Tailwind width class is only a hint and real
widths come from content, which is why the header word "Entry" wins space and
"Exit" gets squeezed until `5:00 PM` renders as `5:00 PI`.

A width class alone does **not** fix this; that was tried on Payroll Master and
failed. Add an inline style, which is what auto layout respects, to **all four**
elements — keep the existing `w-24` class on each:

- Entry header `<th>` (line ~424) — add `style={{ width: 112, minWidth: 112 }}`
- Exit header `<th>` (line ~425) — same
- Entry cell `<td>` (line ~468) — same
- Exit cell `<td>` (line ~473) — same

Keep every existing class on those elements, including `bg-blue-50`,
`text-blue-700`, `bg-blue-50/40`, the `Edit2` icon and the `TimeInput` with all
its props.

## 2. Two headers are cryptic

Change only the `label` prop on these two `Th` elements (lines ~427-428):

| Current | New |
|---|---|
| `Late m` | `Late min` |
| `Early m` | `Early min` |

Keep both `col` props exactly as they are — `late_minutes`,
`early_leave_minutes` — so sorting keeps working. Touch no other header.

## 3. Tabular figures on both tables

Add `tabular-nums` to the existing className on **both** `<table>` elements:

- line ~409, the main queue: becomes `w-full text-xs border-collapse tabular-nums`
- line ~558, the Committed to GREEN table: same addition

Keep both `style={{ minWidth: … }}` values exactly as they are — 1120 and 900.

## Do not touch

- **No other file.**
- Do not change `minWidth: 1120` or `minWidth: 900`, any `sticky` class, or any
  sticky offset. The frozen-column layout is load-bearing.
- Do not change the broadcast-select behaviour, the row selection, the commit
  action, the revert button, the status chips or the row tint colours.
- Do not add or remove an import.

The diff should be four added `style` attributes, two `label` strings and two
added classes. Nothing else.

## Acceptance criteria

- On Action Required with `Q2-Aug-2026`, **exit times read `5:00 PM` in full.**
  The check that matters: for every visible mono time input, `scrollWidth` must
  not exceed `clientWidth`.
- Headers read `Late min` and `Early min`, and clicking each still sorts.
- The RED and YELLOW tab counts still render, and the Committed to GREEN table
  still lists its rows.
- Row values and status colours unchanged.
- No console errors.

Then confirm every identifier used in the file is imported.
