# 01 — Freeze the Activity table headers while scrolling

**Only these two files may change. No other file may be touched.**

- `src/app/pages/attendance/activity/ActivityByEmployee.tsx`
- `src/app/pages/attendance/activity/ActivityByDay.tsx`

Do not create files. **Do not edit `src/app/components/DataTable.tsx`** — Contracts, PTO and
Disciplinary share it and must not change. Do not touch any action or lib.

## Why

Scrolling down the Activity tab loses every column label. Deep inside one employee's expanded day
list you see a wall of times with no idea which column is Entry, Exit, Active or Breaks, and no
reminder of whose days you are reading.

`DataTable` already renders its header as `sticky top-0 z-10`, so why doesn't it stick? Because its
wrapper is `overflow-auto` with no height limit: the card grows as tall as the table, nothing ever
scrolls *inside* it, and the whole card scrolls away in the page instead. A sticky header only
sticks within the box that actually scrolls. Give the card a height and the header it already has
starts working.

## 1. `src/app/pages/attendance/activity/ActivityByEmployee.tsx`

**a.** Make the card its own scroll area. `DataTable` appends `className` to its wrapper, so pass a
height limit — change the opening tag from

```tsx
      <DataTable
        columns={COLUMNS}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      >
```

to

```tsx
      <DataTable
        columns={COLUMNS}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        className="max-h-[70vh]"
      >
```

**b.** Freeze the Date / Entry / Exit header of an expanded employee just under the main header.
`SUBTH` already carries an opaque background, so it only needs the sticky position. Replace:

```ts
const SUBTH = 'px-3 py-1.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap bg-slate-100';
```

with:

```ts
const SUBTH = 'sticky top-[33px] z-[9] px-3 py-1.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap bg-slate-100';
```

`33px` is the height of the main header row it sits below; `z-[9]` keeps it under that header
(`z-10`) and above the rows. Nothing else in the file changes.

## 2. `src/app/pages/attendance/activity/ActivityByDay.tsx`

Same height limit so the By Day table behaves identically — add one line to its `<DataTable>`:

```tsx
        className="max-h-[70vh]"
```

Nothing else in the file changes.

## How I will check it

- Activity → By Employee: scroll deep into an expanded employee. **Employee / Days With Work / Avg
  Active / Avg Entry / Avg Exit / Needs A Look / Away Days stays pinned at the top**, and **Date /
  Entry / Exit / Active / Breaks / Why / Source stays pinned directly beneath it**, with no gap or
  overlap between the two.
- Sorting, expanding and the employee-name link still work.
- Activity → By Day: its header stays pinned the same way.
