# 07 — Action Required adopts the shared unsaved-edits hook; gets Discard all

## Files that may change

- `src/app/pages/ActionRequired.tsx`

No other file may be touched. Do not create, delete, rename or reformat
anything else. Do NOT edit `useRowEdits.ts` or `PayrollMaster.tsx`.

## Why

`src/app/lib/useRowEdits.ts` (already in the project, used by Payroll Master)
is the one place that keeps unsaved per-row edits and offers Discard. Action
Required still keeps its own `edits` state with no way to discard. Adopt the
hook here so both grids behave the same; the page's own `getEdit` and
`isDirty` go away.

## The edits

**1. Import.** Add `import { useRowEdits } from '@/app/lib/useRowEdits';`
next to the `punchMinutes` import. `RotateCcw` is already imported from
`lucide-react`; keep it.

**2. Module-level draft builder.** Before `export default function
ActionRequired`, add:

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

**3. State → hook.** Delete the line
`const [edits, setEdits] = useState<Record<number, EditState>>({});`.
Immediately after the line
`const [rows, loading, , reload] = useLoadAction(loadActionRequiredAction, [] as EntryRow[], params);`
add:
`const { getEdit, update, isDirty, discardAll, markSaved, dirtyCount } = useRowEdits<EntryRow, EditState>(toEditState, rows as EntryRow[]);`

**4. Period effect.** In the `useEffect` that syncs params when the global
period changes, replace `setEdits({});` with `discardAll();`.

**5. Delete the page's `getEdit`** (the `useCallback` that returns
`edits[row.id] ?? { ... }`); the hook provides it.

**6. `setEditField`.** Keep its broadcast behaviour, but write through the
hook. Replace the whole function with:

```ts
  const setEditField = useCallback((id: number, field: keyof EditState, value: string, row: EntryRow, allRows?: EntryRow[]) => {
    const isBroadcast = BROADCAST_FIELDS.includes(field) && selected.has(id) && selected.size > 1;
    const targetIds = isBroadcast ? Array.from(selected) : [id];
    const rowMap = new Map((allRows ?? []).map(r => [r.id, r]));

    for (const tid of targetIds) {
      const trow = rowMap.get(tid) ?? row;
      update(tid, trow, current => {
        const updated = { ...current, [field]: value };
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
    }
    // auto-select the touched row
    setSelected(prev => new Set(prev).add(id));
  }, [update, rulesMap, selected]);
```

**7. Delete the page's `isDirty`** (the `useCallback` that compares eight
fields); the hook provides an equivalent value comparison.

**8. `handleBulkCommit`.** After a row is saved successfully (the branch that
does `newCommitted.add(row.id);`), also call `markSaved(row.id);`.

**9. Commit-confirm list.** In the confirm dialog, the line
`const edit = edits[row.id];` becomes `const edit = getEdit(row);`. The two
lines after it (`event1`, `impact1`) stay as they are.

**10. Discard-all pill.** Immediately after the sticky commit bar's outer
`div` closes (just before the `{/* ── Work table ── */}` comment), add:

```tsx
          {dirtyCount > 0 && (
            <div className="shrink-0 flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={discardAll}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />{dirtyCount} unsaved · Discard all
              </Button>
            </div>
          )}
```

Nothing else changes: selection, range-select, broadcast, commit confirm,
revert, sorting and the committed table stay exactly as they are.

Then confirm every identifier used in the file is imported, `useState` and
`useCallback` are still imported (other code uses them), and `edits` /
`setEdits` are no longer referenced anywhere in ActionRequired.tsx.
