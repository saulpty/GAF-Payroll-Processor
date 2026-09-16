# Disciplinary: super users can Delete (with a required reason) and Restore an action

The Disciplinary Actions Form app has already added three columns to
`disciplinary_actions` in the `SAUL Disciplinary Action Forms DB` datasource:
`deleted_at TIMESTAMPTZ`, `deleted_by TEXT`, `deletion_note TEXT`.
`deleted_at` NULL means not deleted. **Do not write a migration** — the table
belongs to the other app.

**Only these files may change:**

- New: `src/actions/updateDisciplinaryActionDeleted.ts`
- New: `src/actions/updateDisciplinaryActionRestored.ts`
- New: `src/app/pages/disciplinary/DeleteActionDialog.tsx`
- Edit: `src/actions/loadDisciplinaryActions.ts`
- Edit: `src/actions/loadDisciplinaryDueCount.ts`
- Edit: `src/app/lib/disciplinary.ts` (type only)
- Edit: `src/app/pages/Disciplinary.tsx`
- Edit: `src/app/pages/disciplinary/DisciplinaryTable.tsx`
- Edit: `src/app/pages/disciplinary/DisciplinaryRow.tsx`
- Edit: `src/app/pages/disciplinary/CaseFile.tsx`
- Edit: `src/app/pages/disciplinary/ActionDetail.tsx`

**No other file may be created, modified or deleted.** No migration. Do not touch
`TopNav.tsx`, any payroll page, or `src/components/ui/`. Every file stays under 15 KB.
Parameters are passed **flat** to `useLoadAction` / mutate calls (never `{ params: {…} }`).

## Behaviour

- Only **super users** (`useViewer().isSuper`) see Delete, Restore, and the Deleted filter.
  Managers never receive deleted rows at all.
- **Delete** opens a dialog: "Deleted By" (prefilled with the viewer's name) and a
  **required** "Reason". The Delete button stays disabled until both are filled.
- A deleted action disappears from the normal list, counts, Export, the status
  filters and the top-bar due badge.
- A new status filter button **Deleted** (super users only) lists employees with
  deleted actions, showing only those deleted actions. Each shows a grey bar
  "Deleted {date} by {name} — {reason}" and a **Restore** button that brings it
  back exactly as it was (closed stays closed, open stays open).

## 1. New file `src/actions/updateDisciplinaryActionDeleted.ts` (verbatim)

```ts
import { action } from '@uibakery/data';

// Soft-deletes one disciplinary action (super users only, enforced in the UI).
// The row stays; Restore clears these three columns. The `deleted_at IS NULL`
// guard stops a second click overwriting the first deletion's author or reason.
function updateDisciplinaryActionDeleted() {
  return action('updateDisciplinaryActionDeleted', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      UPDATE disciplinary_actions
      SET deleted_at    = NOW(),
          deleted_by    = {{params.deletedBy}},
          deletion_note = {{params.note}}
      WHERE id = {{params.id}}::bigint
        AND deleted_at IS NULL
      RETURNING id, ref, deleted_at::text AS deleted_at, deleted_by, deletion_note;
    `,
  });
}

export default updateDisciplinaryActionDeleted;
```

## 2. New file `src/actions/updateDisciplinaryActionRestored.ts` (verbatim)

```ts
import { action } from '@uibakery/data';

// Restores one soft-deleted disciplinary action by clearing the three deletion
// columns. Closure columns are left untouched.
function updateDisciplinaryActionRestored() {
  return action('updateDisciplinaryActionRestored', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      UPDATE disciplinary_actions
      SET deleted_at    = NULL,
          deleted_by    = NULL,
          deletion_note = NULL
      WHERE id = {{params.id}}::bigint
      RETURNING id, ref;
    `,
  });
}

export default updateDisciplinaryActionRestored;
```

## 3. `loadDisciplinaryActions.ts`

- Add to the SELECT list, after `closure_note,`:
  `deleted_at::text AS deleted_at, deleted_by, deletion_note,`
- Add to the WHERE, as a new line:
  `AND (COALESCE({{params.includeDeleted}}::boolean, false) OR deleted_at IS NULL)`
- Nothing else changes.

## 4. `loadDisciplinaryDueCount.ts`

Add `AND deleted_at IS NULL` to the WHERE. Nothing else changes.

## 5. `src/app/lib/disciplinary.ts`

In `interface DisciplinaryRow`, add three optional fields next to the other optional ones:
`deleted_at?: string | null; deleted_by?: string | null; deletion_note?: string | null;`
**No other change to this file.**

## 6. New file `src/app/pages/disciplinary/DeleteActionDialog.tsx` (verbatim)

```tsx
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useMutateAction } from '@uibakery/data';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DisciplinaryRow } from '@/app/lib/disciplinary';
import { useViewer } from '@/app/context/ViewerContext';
import updateDisciplinaryActionDeletedAction from '@/actions/updateDisciplinaryActionDeleted';

interface Props {
  action: DisciplinaryRow | null;   // null = dialog closed
  onClose: () => void;
  onSaved: () => void;
}

export default function DeleteActionDialog({ action: da, onClose, onSaved }: Props) {
  const open = da !== null;
  const { name } = useViewer();

  const [deletedBy, setDeletedBy] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteAction] = useMutateAction(updateDisciplinaryActionDeletedAction);

  useEffect(() => {
    if (!da) return;
    setDeletedBy(name ?? '');
    setNote('');
    setError(null);
  }, [da, name]);

  const valid = deletedBy.trim() !== '' && note.trim() !== '';

  async function handleSubmit() {
    if (!da || !valid) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAction({ id: da.id, deletedBy: deletedBy.trim(), note: note.trim() });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Disciplinary Action</DialogTitle>
          {da && (
            <p className="text-[12px] text-slate-500 mt-0.5">
              {da.employee_name}
              <span className="text-slate-400"> · </span>
              <span className="font-mono">{da.ref}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-[12px] text-slate-600">
            The action is hidden from the list and no longer counts as a prior warning.
            A super user can restore it from the Deleted filter.
          </p>
          <div>
            <Label htmlFor="deletedBy" className="text-xs">Deleted By</Label>
            <Input
              id="deletedBy"
              value={deletedBy}
              onChange={e => setDeletedBy(e.target.value)}
              disabled={saving}
              className="mt-1 h-8 text-sm"
              placeholder="Your name"
            />
          </div>
          <div>
            <Label htmlFor="deletionNote" className="text-xs">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="deletionNote"
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={saving}
              rows={3}
              className="mt-1 text-sm resize-none"
              placeholder="e.g. Filed twice by mistake; the correct one is DA-0012."
            />
            {!note.trim() && (
              <p className="text-[11px] text-slate-400 mt-1">A reason is required to delete.</p>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving || !valid}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Deleting…</>
              : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## 7. `Disciplinary.tsx`

- `type StatusFilter = 'all' | 'open' | 'overdue' | 'closed' | 'deleted';`
- Import `useViewer` from `@/app/context/ViewerContext`; in the component read `const { isSuper } = useViewer();`.
- Render the status buttons from
  `STATUS_OPTIONS.concat(isSuper ? [{ value: 'deleted', label: 'Deleted' }] : [])`
  (keep `STATUS_OPTIONS` itself unchanged).
- In `activeClass`, add before the `// all` return:
  `if (value === 'deleted') return 'bg-slate-800 text-white border-slate-800 shadow-sm';`
- In `stateWord` / the Export, no change is needed.

## 8. `DisciplinaryTable.tsx`

- `statusFilter` prop type gains `'deleted'`.
- Read `isSuper` from `useViewer()` alongside `viewAs, allEmployees`.
- Pass `includeDeleted: isSuper` in the `loadDisciplinaryActions` params (flat, next to `manager: null, employeeName: null`).
- In Stage 1, before `groupByEmployee`, keep only the rows for the current view:
  `const inView = normalised.filter(r => statusFilter === 'deleted' ? !!r.deleted_at : !r.deleted_at);`
  and group `inView` instead of `normalised`. Add `statusFilter` to that `useMemo`'s dependencies.
- In Stage 2, `statusFilter === 'deleted'` applies no further status filtering (same as `'all'`).
- Nothing else changes.

## 9. `DisciplinaryRow.tsx`

At the very start of `stateChip`, return
`{ label: 'Deleted', tone: 'slate' }` when every action in `row.actions` has a `deleted_at`.

## 10. `CaseFile.tsx`

In the status chip cell, when `a.deleted_at` is set show
`<StatusChip tone="slate">Deleted</StatusChip>` instead of the state chip.

## 11. `ActionDetail.tsx`

- Import `Trash2, RotateCcw` from `lucide-react`, `useViewer` from `@/app/context/ViewerContext`,
  `DeleteActionDialog` from `./DeleteActionDialog`, and
  `updateDisciplinaryActionRestoredAction` from `@/actions/updateDisciplinaryActionRestored`.
- `const { isSuper } = useViewer();`, a `deleteOpen` state, a `restoring` state, and
  `const [restoreAction] = useMutateAction(updateDisciplinaryActionRestoredAction);`
  with `handleRestore` mirroring `handleReopen` (`await restoreAction({ id: action.id }); onChanged();`).
- **When `action.deleted_at` is set**, the status bar is replaced by a grey bar
  (`px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap`):
  left `<span className="text-[12px] text-slate-700">Deleted {fmtDate(action.deleted_at)} by {action.deleted_by}{action.deletion_note && <span className="text-slate-500 ml-1">— {action.deletion_note}</span>}</span>`;
  right, only if `isSuper`, an outline small `Button` with `RotateCcw` icon and text `Restore`
  (spinner while `restoring`). No Close Case / Reopen / Delete in this state.
- **When not deleted**, the existing closed / open bars stay as they are, and if `isSuper`
  add a small outline button **after** the Close Case button (open bar) and after Reopen (closed bar):
  `<Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="h-8 text-[12px] text-red-700 border-red-200 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button>`.
  Wrap the right-hand controls of each bar in `<div className="flex items-center gap-2 shrink-0">` so they sit together.
- Render `<DeleteActionDialog action={deleteOpen ? action : null} onClose={() => setDeleteOpen(false)} onSaved={() => { setDeleteOpen(false); onChanged(); }} />` next to `CloseCaseDialog`.
- The `deleted_at` date comes back as a full timestamp: pass `action.deleted_at.slice(0, 10)` to `fmtDate`.

## Acceptance

- `git status` shows only the files listed above.
- Confirm every identifier used in each file is imported.
- As a super user: Disciplinary page shows a **Deleted** filter; an action's detail shows **Delete**;
  the dialog's Delete button is disabled until a reason is typed.
- As a manager (view-as): no Deleted filter, no Delete or Restore buttons.
