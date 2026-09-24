# 12 — Hub: four review fixes to the disciplinary edit

> **Goes into GAF Panama HR Hub** (the Hub), not the Disciplinary Actions Form.

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

Only these five files may change. **No other file may be created, changed or deleted.**

- `app/pages/disciplinary/ActionDetail.tsx`
- `app/pages/disciplinary/EditActionForm.tsx`
- `app/pages/disciplinary/useSaveDisciplinaryEdit.ts`
- `app/pages/disciplinary/ActionPdfBar.tsx`
- `actions/loadDisciplinaryActions.ts`

Keep every `useLoadAction` params object **flat** (never `{ params: {...} }`), never put
`{{ }}` inside quotes, and keep every file under 15 KB.

---

## Fix 1 — a saved edit must reach the list even if the row is closed before "Done"

**Bug:** after Tim saves an edit, the list only reloads when he clicks **Done** on the
result panel. If he closes the action row instead, the reload never happens. When he reopens
it, the old values are shown, and a second edit starts from them — saving would put the old
text back.

**Fix:**

1. `EditActionForm.tsx`: add an optional prop `onSaved?: () => void` to `Props`. Call it
   **once**, as soon as `result` becomes non-null (i.e. the database update succeeded), with a
   `useEffect` on `result`. Do not change anything else in the file. (`useEffect` must be
   added to the existing `import { useState } from 'react';` line.)

2. `ActionDetail.tsx`:
   - Add `useRef` and `useEffect` to the existing `import { useState } from 'react';` line.
   - Add a ref `savedUnreloaded = useRef(false)` and a ref that always holds the latest
     `onChanged` (`const onChangedRef = useRef(onChanged); onChangedRef.current = onChanged;`).
   - Pass `onSaved={() => { savedUnreloaded.current = true; }}` to `<EditActionForm>`.
   - Change the existing
     `onDone={() => { setEditing(false); onChanged(); }}`
     to
     `onDone={() => { savedUnreloaded.current = false; setEditing(false); onChanged(); }}`
   - Add an unmount effect: `useEffect(() => () => { if (savedUnreloaded.current) onChangedRef.current(); }, []);`
     so that closing the row after a save still reloads the list.

## Fix 2 — "Edited on" must be the Panama date, not the UTC date

In `actions/loadDisciplinaryActions.ts`, replace

```
edited_at::text AS edited_at
```

with

```
(edited_at AT TIME ZONE 'America/Panama')::text AS edited_at
```

Nothing else in that file changes. (`ActionPdfBar` keeps taking the first 10 characters.)

## Fix 3 — no "Download original PDF" on a deleted warning

`loadDisciplinaryPdf` never returns deleted rows, so that button can only fail there.
In `ActionPdfBar.tsx`, change `{action.has_original && (` to
`{action.has_original && !action.deleted_at && (`. Nothing else changes.

## Fix 4 — honest message when the update changed no row

In `useSaveDisciplinaryEdit.ts`, replace the string
`'Not allowed — only Tim and Saul can edit.'`
with
`'Not saved — only Tim and Saul can edit, and a deleted warning cannot be edited. Reload the page and try again.'`
Keep the `—` escape exactly as written. Nothing else changes.

---

## Acceptance

1. Only the five files above changed.
2. `EditActionForm` calls `onSaved` once after a successful save; `ActionDetail` reloads the
   list on Done **and** on unmount after a save.
3. The loader selects `(edited_at AT TIME ZONE 'America/Panama')::text AS edited_at`.
4. TypeScript is clean; every file under 15 KB; no `{ params:` anywhere.

## Report back

List every file you changed with its size in bytes.
