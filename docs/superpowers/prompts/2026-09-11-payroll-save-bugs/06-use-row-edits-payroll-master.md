# 06 — Shared unsaved-edits hook; Payroll Master gets Discard

## Files that may change

- `src/app/lib/useRowEdits.ts` (new)
- `src/app/pages/PayrollMaster.tsx`

No other file may be touched. Do not create, delete, rename or reformat
anything else. Do NOT edit `ActionRequired.tsx` (it adopts the hook in the
next prompt).

## Why

Both editable grids (Payroll Master, Action Required) keep unsaved per-row
edits in their own `edits` state with no way to discard them: the only way to
undo a change is to switch pages. The app needs one shared behaviour. This
prompt creates it and adopts it on Payroll Master; the page's code shrinks
because `getEdit`, `isDirty` and `fieldsDirty` move into the hook.

## Part 1 — create `src/app/lib/useRowEdits.ts` exactly

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Unsaved per-row edits for an editable grid — one implementation for the
 * whole app (Payroll Master, Action Required) so Discard behaves the same
 * everywhere.
 *   getEdit(row)            the draft for a row, or its loaded values when untouched
 *   update(id, row, fn)     change the draft; fn receives the current draft
 *   isDirty(row)            the draft differs from the loaded row (value comparison)
 *   discard(id)             throw one row's draft away
 *   discardAll()            throw every draft away
 *   markSaved(id)           same as discard — after a save the loaded row is the truth
 *   dirtyCount              how many loaded rows have a differing draft
 * While dirtyCount > 0 the browser asks before unloading the page.
 * `toDraft` must be a stable function (module level), not an inline arrow.
 */
export function useRowEdits<Row extends { id: number }, Draft extends Record<string, string>>(
  toDraft: (row: Row) => Draft,
  rows: Row[],
) {
  const [edits, setEdits] = useState<Record<number, Draft>>({});

  const getEdit = useCallback((row: Row): Draft => edits[row.id] ?? toDraft(row), [edits, toDraft]);

  const isDirty = useCallback((row: Row): boolean => {
    const e = edits[row.id];
    if (!e) return false;
    const base = toDraft(row);
    return Object.keys(base).some(k => e[k] !== base[k]);
  }, [edits, toDraft]);

  const update = useCallback((id: number, row: Row, fn: (cur: Draft) => Draft) => {
    setEdits(prev => ({ ...prev, [id]: fn(prev[id] ?? toDraft(row)) }));
  }, [toDraft]);

  const discard = useCallback((id: number) => {
    setEdits(prev => {
      if (!(id in prev)) return prev;
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }, []);

  const discardAll = useCallback(() => setEdits({}), []);

  const dirtyCount = useMemo(() => rows.reduce((n, r) => n + (isDirty(r) ? 1 : 0), 0), [rows, isDirty]);

  useEffect(() => {
    if (dirtyCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyCount]);

  return { edits, getEdit, update, isDirty, discard, discardAll, markSaved: discard, dirtyCount };
}
```

## Part 2 — `src/app/pages/PayrollMaster.tsx`

**2a.** Add `import { useRowEdits } from '@/app/lib/useRowEdits';` next to the
`punchMinutes` import. Add `RotateCcw` to the `lucide-react` import list.

**2b.** Add a module-level function (after the `shortName` function, before
`export default function PayrollMaster`), whose body is the object the
current `getEdit` builds:

```ts
/** A row's loaded values in edit shape. Module level so useRowEdits sees a stable function. */
function toEditState(row: EntryRow): EditState {
  return {
    entry_time: row.entry_time || '',
    exit_time: row.exit_time || '',
    event_type_1: row.event_type_1 || '',
    pay_impact_1: row.pay_impact_1 || '',
    event_type_2: row.event_type_2 || '',
    pay_impact_2: row.pay_impact_2 || '',
    documentation: row.documentation || '',
    notes: row.notes || '',
  };
}
```

**2c.** Delete the line
`const [edits, setEdits] = useState<Record<number, EditState>>({});`.
Immediately after the line
`const [rows, loading, , reload] = useLoadAction(loadPayrollMasterAction, [] as EntryRow[], params);`
add:
`const { getEdit, update, isDirty, discard, discardAll, markSaved, dirtyCount } = useRowEdits<EntryRow, EditState>(toEditState, rows as EntryRow[]);`

**2d.** In the `useEffect` that syncs params when the global period or
employee changes, replace `setEdits({});` with `discardAll();`.

**2e.** Delete the whole `const getEdit = (row: EntryRow): EditState => edits[row.id] ?? { ... };`
definition (the hook provides `getEdit`).

**2f.** Replace the whole `setEditField` function with:

```ts
  const setEditField = (id: number, field: keyof EditState, value: string, row: EntryRow) => {
    update(id, row, current => {
      const updated = { ...current, [field]: value };
      // Auto-fill pay impact from rules when event type changes
      if (field === 'event_type_1' && value && rulesMap.has(value)) {
        const rule = rulesMap.get(value)!;
        if (!current.pay_impact_1 && rule.pay_impact) updated.pay_impact_1 = rule.pay_impact;
        if (!current.documentation && rule.doc_option) updated.documentation = rule.doc_option;
      }
      if (field === 'event_type_2' && value && rulesMap.has(value)) {
        const rule = rulesMap.get(value)!;
        if (!current.pay_impact_2 && rule.pay_impact) updated.pay_impact_2 = rule.pay_impact;
      }
      return updated;
    });
    setSavedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };
```

**2g.** Delete the line `const isDirty = (row: EntryRow) => !!edits[row.id];`.

**2h.** In `handleSave`, replace everything from
`const timesChanged = ...` down to and including `if (!fieldsDirty) return;`
with the single line `if (!isDirty(row)) return;`. Then replace the line
`setEdits(prev => { const n = { ...prev }; delete n[row.id]; return n; });`
(after `await reload();`) with `markSaved(row.id);`.

**2i.** In the Discount preview inside the row, the line
`const changed = liveDiscount !== row.discount_total_minutes && edits[row.id] !== undefined;`
becomes `const changed = liveDiscount !== row.discount_total_minutes && dirty;`.

**2j. Discard control per row.** In the Delete cell (the sticky `td` at
`left-[264px]` containing the trash button), when `dirty` render a discard
button instead of the trash:

```tsx
                        {dirty ? (
                          <button
                            title="Discard unsaved changes"
                            onClick={() => discard(row.id)}
                            className="p-1 rounded hover:bg-amber-100 text-amber-600 hover:text-amber-800 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            title="Delete entry"
                            ... the existing delete button, unchanged ...
                          </button>
                        )}
```

**2k. Page-level pill.** In the toolbar's `ml-auto` group, before the
`{undoSnapshot && (...Undo Bulk...)}` block, add:

```tsx
          {dirtyCount > 0 && (
            <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={discardAll}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />{dirtyCount} unsaved · Discard all
            </Button>
          )}
```

Nothing else changes: bulk edit, undo, delete dialog, export, sorting and
pagination stay exactly as they are. After the edit the file must be no
larger than before it (the hook removes more than the buttons add).

Then confirm every identifier used in each file is imported, and that
`useState` is still imported (other state uses it) and `edits` is no longer
referenced anywhere in PayrollMaster.tsx.
