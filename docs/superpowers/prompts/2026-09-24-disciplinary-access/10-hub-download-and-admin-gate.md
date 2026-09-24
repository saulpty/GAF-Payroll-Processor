# 10 — Hub: Download PDF for everyone; Delete, Restore and the Deleted filter for Tim and Saul only

> **Goes into GAF Panama HR Hub** (the Hub), not the Disciplinary Actions Form.
> Run after 08, 08b and 09: it uses `render.ts`, `strings.ts`, `loadDisciplinaryAdmin` and
> `loadDisciplinaryPdf`.

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only these 8 files may change. No other file may be touched.**

- New: `src/app/pages/disciplinary/useDisciplinaryAdmin.ts`
- New: `src/app/pages/disciplinary/downloadPdf.ts`
- New: `src/app/pages/disciplinary/ActionPdfBar.tsx`
- Edit: `src/app/lib/disciplinary.ts` (the type only)
- Edit: `src/app/pages/disciplinary/ActionDetail.tsx`
- Edit: `src/app/pages/disciplinary/DisciplinaryTable.tsx`
- Edit: `src/app/pages/disciplinary/DeleteActionDialog.tsx`
- Edit: `src/app/pages/Disciplinary.tsx`

Do not touch `CaseFile.tsx`, `DisciplinaryRow.tsx`, `CloseCaseDialog.tsx`, any action, `ViewerContext.tsx`, `TopNav.tsx`, any payroll page or
`src/components/ui/`. Do not build the Edit form: that is the next prompt. Every file stays
under 15 KB.

**Parameters go flat.** `useLoadAction(action, default, { a, b })`, never
`useLoadAction(action, default, { params: { … } })`. The wrapper silently makes every
`{{params.x}}` undefined.

## Why

- Saul's decision: only **Tim and Saul** (the `disciplinary_admins` table) may delete or
  restore a warning, or see the Deleted filter. The other super users keep viewing, and lose
  Delete and Restore. The database already enforces this (prompt 09); this prompt makes the
  buttons match. While viewing the app **as someone else**, even Tim and Saul see no admin
  buttons.
- Everyone who can see a warning gets a **Download PDF** button. It downloads the stored PDF;
  older warnings have none stored, so the PDF is rebuilt from the row.
- After an edit (next prompt) the detail shows "Edited by … on …" and a
  **Download original PDF** button.

## 1. New file `src/app/pages/disciplinary/useDisciplinaryAdmin.ts` (verbatim)

```ts
// Is the signed-in person a disciplinary admin (Tim or Saul, the
// disciplinary_admins table)? Never true while viewAs points at someone else.
// Gates Edit, Delete, Restore and the Deleted filter. This is only the UI side:
// the database checks the same list again on every edit, delete and restore.
import { useLoadAction } from '@uibakery/data';
import loadDisciplinaryAdminAction from '@/actions/loadDisciplinaryAdmin';
import { useViewer } from '@/app/context/ViewerContext';

type AdminRow = { is_admin: boolean | string | null };

export function useDisciplinaryAdmin(): { isDisciplinaryAdmin: boolean; loading: boolean } {
  const { isViewingAs } = useViewer();
  const [rows, loading] = useLoadAction(loadDisciplinaryAdminAction, [] as AdminRow[]);
  const flag = (rows as AdminRow[])[0]?.is_admin;
  const isAdmin = flag === true || flag === 'true' || flag === 't';
  return { isDisciplinaryAdmin: isAdmin && !isViewingAs, loading };
}
```

## 2. New file `src/app/pages/disciplinary/downloadPdf.ts` (verbatim)

```ts
// Saves a base64 PDF as a file in the browser. Accepts bare base64 or a
// 'data:application/pdf;base64,...' string.
export function downloadBase64Pdf(base64: string, filename: string): void {
  const clean = base64.includes(',') ? base64.slice(base64.lastIndexOf(',') + 1) : base64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

## 3. New file `src/app/pages/disciplinary/ActionPdfBar.tsx` (verbatim)

```tsx
// Download buttons and edit history for one disciplinary action. Everyone who
// can see the action can download its PDF. The stored PDF is fetched on click
// (loadDisciplinaryPdf, about 250 KB); when none is stored (older rows, or a
// deleted row), the PDF is rebuilt from the row with buildDisciplinaryPdfBase64.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { fmtDate } from '@/app/lib/fmtDate';
import type { DisciplinaryRow } from '@/app/lib/disciplinary';
import loadDisciplinaryPdfAction from '@/actions/loadDisciplinaryPdf';
import { buildDisciplinaryPdfBase64 } from '@/app/lib/disciplinaryPdf/render';
import { pdfFilename } from '@/app/lib/disciplinaryPdf/strings';
import { downloadBase64Pdf } from './downloadPdf';

interface Props {
  action: DisciplinaryRow;
  children?: ReactNode;   // extra buttons on the right (Edit)
}

type StoredPdf = { pdf_en_base64: string | null; pdf_en_original_base64: string | null };

export default function ActionPdfBar({ action, children }: Props) {
  const [fetchPdf] = useMutateAction(loadDisciplinaryPdfAction);
  const [busy, setBusy] = useState<'current' | 'original' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(which: 'current' | 'original') {
    setBusy(which);
    setError(null);
    try {
      const res = await fetchPdf({ id: action.id });
      const stored = (Array.isArray(res) ? res[0] : null) as StoredPdf | null;
      if (which === 'original') {
        const original = stored?.pdf_en_original_base64 ?? '';
        if (!original) {
          setError('The original PDF could not be found.');
          return;
        }
        downloadBase64Pdf(original, pdfFilename(action.ref).replace(/\.pdf$/, '_ORIGINAL.pdf'));
        return;
      }
      const current = stored?.pdf_en_base64 || buildDisciplinaryPdfBase64(action);
      downloadBase64Pdf(current, pdfFilename(action.ref));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  const edited = action.edited_at
    ? `Edited by ${action.edited_by ?? 'unknown'} on ${fmtDate(action.edited_at.slice(0, 10))}`
    : null;

  return (
    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => download('current')}
          disabled={busy !== null}
          className="h-8 text-[12px]"
        >
          {busy === 'current'
            ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            : <FileDown className="w-3.5 h-3.5 mr-1" />}
          Download PDF
        </Button>
        {action.has_original && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => download('original')}
            disabled={busy !== null}
            className="h-8 text-[12px]"
          >
            {busy === 'original'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              : <FileDown className="w-3.5 h-3.5 mr-1" />}
            Download original PDF
          </Button>
        )}
        {edited && <span className="text-[11px] text-slate-500">{edited}</span>}
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
```

## 4. `src/app/lib/disciplinary.ts` — type only

In `interface DisciplinaryRow`, directly after the existing line
`  deletion_note?: string | null;` add:

```ts
  edited_at?: string | null;
  edited_by?: string | null;
  has_original?: boolean | null;
```

**No other change to this file.**

## 5. `src/app/pages/disciplinary/ActionDetail.tsx`

- Replace the line `import { useViewer } from '@/app/context/ViewerContext';` with these two:
  ```ts
  import { useDisciplinaryAdmin } from './useDisciplinaryAdmin';
  import ActionPdfBar from './ActionPdfBar';
  ```
- Replace `  const { isSuper } = useViewer();` with
  `  const { isDisciplinaryAdmin } = useDisciplinaryAdmin();`
- There are exactly **three** `{isSuper && (` in the JSX (Restore in the deleted bar, Delete in
  the closed bar, Delete in the open bar). Change each to `{isDisciplinaryAdmin && (`. The
  Reopen and Close Case buttons stay visible to everyone, as today.
- Directly before the line `      {/* Facts */}`, insert:
  ```tsx
      <ActionPdfBar action={action} />

  ```
- Change the second comment line from
  `// Prop-driven, no useLoadAction, no useGlobalFilters. Reusable by Employee 360.` to
  `// Prop-driven; its only load is useDisciplinaryAdmin. Reusable by Employee 360.`
- Afterwards the word `isSuper` must not appear in the file. Confirm every identifier used in
  the file is imported.

## 6. `src/app/pages/disciplinary/DisciplinaryTable.tsx`

- Add the import `import { useDisciplinaryAdmin } from './useDisciplinaryAdmin';` next to the
  `useViewer` import.
- Change `  const { viewAs, allEmployees, isSuper } = useViewer();` to
  `  const { viewAs, allEmployees } = useViewer();` and add directly below it:
  `  const { isDisciplinaryAdmin } = useDisciplinaryAdmin();`
- In the `loadDisciplinaryActionsAction` call, change `includeDeleted: isSuper` to
  `includeDeleted: isDisciplinaryAdmin`. The params object stays **flat**, and nothing else in
  it changes (`manager: null, employeeName: null, … allNames: allEmployees, names: scopeNames`,
  then `{ enabled: scopeReady }`).
- Nothing else changes. Afterwards `isSuper` must not appear in the file.

## 7. `src/app/pages/Disciplinary.tsx`

- Replace `import { useViewer } from '@/app/context/ViewerContext';` with
  `import { useDisciplinaryAdmin } from './disciplinary/useDisciplinaryAdmin';`
- Replace `  const { isSuper } = useViewer();` with
  `  const { isDisciplinaryAdmin } = useDisciplinaryAdmin();`
- In `STATUS_OPTIONS.concat(isSuper ? [{ value: 'deleted' as StatusFilter, label: 'Deleted' }] : [])`
  change `isSuper` to `isDisciplinaryAdmin`. Nothing else changes.
- Afterwards `isSuper` must not appear in the file. Confirm every identifier is imported.

## 8. `src/app/pages/disciplinary/DeleteActionDialog.tsx`

Since prompt 09 the database records who deleted from the login, so the "Deleted By" box goes.

- Delete the `Input` import, the `useViewer` import, the line `  const { name } = useViewer();`
  and the `deletedBy` state line.
- The `useEffect` becomes
  `useEffect(() => { if (!da) return; setNote(''); setError(null); }, [da]);`
- `const valid = note.trim() !== '';`
- In `handleSubmit`, replace
  `await deleteAction({ id: da.id, deletedBy: deletedBy.trim(), note: note.trim() });` and
  the `onSaved();` after it with:
  ```ts
      const res = await deleteAction({ id: da.id, note: note.trim() });
      if (!Array.isArray(res) || res.length === 0) {
        setError('Not allowed \u2014 only Tim and Saul can delete.');
        return;
      }
      onSaved();
  ```
  (`\u2014` is an em dash written as an escape; keep the six characters.)
- Delete the whole `<div>` that holds `<Label htmlFor="deletedBy" …>Deleted By</Label>` and
  `<Input id="deletedBy" … />`. Keep the Reason box exactly as it is.
- Change `A super user can restore it from the Deleted filter.` to
  `Tim or Saul can restore it from the Deleted filter. Your login is recorded as who deleted it.`
- `disabled={saving || !valid}` on the Delete button stays. `Label` and `Textarea` are still
  used; confirm every identifier used is imported and no import is left unused.

## Acceptance (load `/disciplinary` and look)

1. `git status` would show exactly the 8 files above.
2. **As Saul:** expand any employee, then any action. Directly under the coloured status bar
   there is a **Download PDF** button. Clicking it downloads
   `GAF_Disciplinary_Action_EN_<ref>.pdf`, and the file opens and shows that warning. The
   **Delete** button is still there, and the **Deleted** filter button is still in the header.
3. **A warning with no stored PDF** (an older one) also downloads, rebuilt: the same layout,
   with the ref and date in the header.
4. **View as a manager** (for example Leah Kessler): Download PDF is there; there is no
   Delete, no Restore and no Deleted filter.
5. No action shows "Download original PDF" or "Edited by" yet (nothing has been edited).
   As Saul, **Delete** opens a dialog with only a Reason box (no "Deleted By"). Cancel it.
6. `grep -rn "{ params:" src/app` returns nothing.

## Report back

1. The 8 file paths, and the size in bytes of each new or edited file.
2. What you saw for checks 2 to 5.
3. Anything in the existing files that did not match the lines quoted above.

---

## Operator notes (Claude, not UIB)

- This breaks `tests/disciplinaryDelete.test.ts` DD1 (`includeDeleted: isSuper`) on purpose;
  it must move to `includeDeleted: isDisciplinaryAdmin` in the same commit (DD4 is already
  updated).
- Byte-compare the three new files against the code blocks (sizes: useDisciplinaryAdmin.ts
  949, downloadPdf.ts 703, ActionPdfBar.tsx 3714 bytes).
