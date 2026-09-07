# Wire the table's reload into the case file

**Modify exactly one existing file: `src/app/pages/disciplinary/DisciplinaryTable.tsx`.**

**No other file may be created, modified or deleted.** Do not touch
`DisciplinaryRow.tsx`, `CaseFile.tsx`, `CloseCaseDialog.tsx`, any action,
`app.tsx`, `TopNav.tsx`, `FilterBar.tsx`, or anything else.

## The defect

`CaseFile` calls `onChanged()` after a case is closed or reopened, and
`DisciplinaryRow` accepts an `onChanged` prop — but it defaults to a **no-op**
and `DisciplinaryTable` never passes one.

So today, closing a case writes to the database and **nothing on screen
changes**. The chip stays red, the status stays `review overdue`, the counts
stay wrong, and the row does not re-sort. The only way to see the truth is a
manual page reload. That is precisely the "verify before asserting" failure this
project keeps paying for: the write succeeded, the screen lied.

## The fix

`DisciplinaryTable` already has `reload` — it is the fourth element of the
`useLoadAction` tuple it destructures for `loadDisciplinaryActions`. Pass it
down where the rows are rendered:

```tsx
<DisciplinaryRow
  key={row.employeeName}
  row={row}
  asOf={asOf}
  expanded={expandedName === row.employeeName}
  onToggle={() => setExpandedName(expandedName === row.employeeName ? null : row.employeeName)}
  onChanged={reload}
/>
```

Add **only** the `onChanged={reload}` prop. Do not restructure the map, do not
rename anything, do not change the filter or sort pipeline, and do not alter how
`expandedName` works.

## Why not a local state update instead

Do not "optimise" this by mutating the row in place so the chip flips instantly.
A stale read from the database is a real bug class in this app, and a reload is
how it gets caught. The round trip is cheap — sixteen rows.

## Acceptance — observable outcomes

1. `DisciplinaryTable.tsx` is the only file that changed, and the diff is a
   single added prop.
2. Closing a case from the expanded file causes the table to re-fetch: the
   employee's status chip turns green, their row re-sorts toward the bottom, and
   the header counts update — **without a manual page reload**.
3. Reopening that same case restores the previous state the same way.
4. The file still contains no `{ params:`.
