# Payroll Master: stop tearing the table down on every save (the "crash")

**Only `src/app/pages/PayrollMaster.tsx` may change, and only the two blocks below.**
No other line in that file, and no other file. Do not reformat, rename or reorder anything.
This is a high-blast-radius payroll file: make the smallest possible edit.

## Why

Tim reported that editing a row on Payroll Master and clicking **Save** "crashes the whole
thing". Reproduced on `/dev` (Q2-Sep-2026, 444 rows): after Save, `reload()` sets `loading`,
and the page swaps the entire table for "Loading…" and then rebuilds it: **2,223 selects,
28,458 options, ~48,000 elements**. The browser tab froze for over a minute. The save itself
succeeds; the rebuild is what hangs.

`useLoadAction` keeps the previous rows while it reloads (the "1 unsaved" counter stayed
visible during the freeze), so the table can stay on screen and update in place.

## Change 1: the loading block (currently around line 523)

Replace
```tsx
      {periodChosen && loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      )}
```
with
```tsx
      {periodChosen && loading && allRows.length === 0 && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      )}
      {periodChosen && loading && allRows.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs text-muted-foreground shadow">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />Refreshing…
        </div>
      )}
```

## Change 2: the table gate (the next line, currently around line 529)

Replace
```tsx
      {periodChosen && !loading && (
```
with
```tsx
      {periodChosen && !(loading && allRows.length === 0) && (
```

`allRows` is already defined above the `return` (`const allRows = rows as EntryRow[];`).
Nothing else changes: not the page size, not the save logic, not the CSV export.

## Report
- The two changed blocks as they now read, with line numbers.
- The byte size of `PayrollMaster.tsx` before and after.
- Confirm no other file changed.
