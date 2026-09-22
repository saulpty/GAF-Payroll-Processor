# 02 — Freeze the headers on Contracts, PTO Tracker and Disciplinary too

**Only these three files may change. No other file may be touched.**

- `src/app/pages/contracts/ContractsTable.tsx`
- `src/app/pages/pto/PtoTable.tsx`
- `src/app/pages/disciplinary/DisciplinaryTable.tsx`

Do not create files. **Do not edit `src/app/components/DataTable.tsx`.** Do not touch any action or
lib. Do not change any column, sort, filter or expand behaviour.

## Why

Same fault as the Activity tables in prompt 01, same one-line fix. All three of these pages already
pass `stickyHeader` to `DataTable`, and it does nothing: the wrapper is `overflow-auto` with no
height limit, so the card grows as tall as the table, nothing ever scrolls *inside* it, and the whole
card scrolls away in the page instead. A sticky header only sticks within the box that actually
scrolls.

Scrolling past 44 people on the PTO Tracker leaves eight columns of bare numbers — Accrued, Taken,
Available, Paid PTO, FH left, WFH, Birthday, Review — with no titles above them. Contracts loses
Position / Start / Tenure / Contract End and the five milestone columns; Disciplinary loses Actions /
Highest Level / Escalation / Latest / Status.

## The change

In each of the three files, find the `<DataTable` element and add **one** prop line alongside the
existing ones, keeping `stickyHeader` exactly where it is:

```tsx
        className="max-h-[70vh]"
```

`DataTable` appends `className` to its wrapper, so this gives the card a height, which makes the
sticky header it already renders start working.

That is the entire change: one added line per file, three lines in total. Nothing else in any of the
three files changes — not the columns, not the sort handlers, not the expanded rows.

## How I will check it

- PTO Tracker: scroll to the bottom of the list; **Employee / Title / Start / Accrued / Taken /
  Available / Paid PTO / FH left / WFH / Birthday / Review stays pinned** at the top of the card.
  Expanding a row still works and its detail still appears under that row.
- Contracts: the same, including the centred milestone columns.
- Disciplinary: the same, and expanding an employee still shows their actions.
- Sorting by clicking a header still works on all three.
