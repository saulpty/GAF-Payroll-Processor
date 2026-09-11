# 01 — Payroll Master: forget the row's edit after a successful save

## Files that may change

- `src/app/pages/PayrollMaster.tsx`

No other file may be touched. Do not create, delete, rename or reformat
anything else.

## The bug

In `handleSave` (around lines 192-240) the row is written to the database and
`await reload()` is called, but the entry in the `edits` state for that row is
never removed. `isDirty` is `!!edits[row.id]`, so the row stays "dirty" forever:
the Save button never turns into the green ✓, the row keeps its dirty tint, and
further Save clicks return early from the `fieldsDirty` check.

## The change — one line

In `handleSave`, immediately after the existing `await reload();` line, add:

```ts
setEdits(prev => { const n = { ...prev }; delete n[row.id]; return n; });
```

Place it after `reload()`, not before, so the row keeps showing the edited
values until the fresh database row arrives.

Nothing else changes: `isDirty` becomes false for that row, the render shows
the ✓ (`saved && !dirty`), `getEdit` falls through to the reloaded row, and the
next edit already removes the id from `savedIds` in `setEditField`.

Do not touch `fieldsDirty`, the bulk-save path, the undo path, or any JSX.

Then confirm every identifier used in the file is imported.
