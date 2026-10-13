# Phone view, rows 5b: Disciplinary list and case file, part 2 of 2 (the page shows rows on a phone)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the Disciplinary page is the computer's eight-column table squeezed into the
screen: it slides sideways, the latest action's situation type sits in the open for anyone looking
over a shoulder, and an employee's file opens as a second table inside the first. This prompt
gives a phone its own layout: one row per employee (name, role and branch, status, highest level,
number of actions, and nothing about what happened), and a tap opens that employee's case file as
a full-height sheet, one row per action, each opening in place to the action as it is today. The
header gets a full-width "New Disciplinary Action" and the status buttons on one line that slides.

Nothing about the data changes: no new query, the same employees in the same order, the same
filters, the same counts, the same rules about who may see or do what.

**This is part 2 of 2.** Part 1 already added `src/app/pages/disciplinary/CaseFileSheet.tsx`, made five helpers in `DisciplinaryRow.tsx` and `CaseFile.tsx` exports, and added the phone classes to `src/app/pages/Disciplinary.tsx`: use them as they are and do not edit them. Write everything below exactly as given: do not adapt or shorten it.

If `src/app/pages/disciplinary/CaseFileSheet.tsx` does not exist, or `src/app/pages/disciplinary/DisciplinaryRow.tsx` has no `export function stateChip`, stop and say so. Do not write them.

**Only these files may change.** One new: `src/app/pages/disciplinary/DisciplinaryRows.tsx`. One edited: `src/app/pages/disciplinary/DisciplinaryTable.tsx`. **No other file may be touched.** No migration, no action file.

Rules:
- Only these files may change: the two listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Follow the Phone section of `src/DESIGN.md`.

Already in the app from earlier prompts. **Use them; do not create, edit or redefine them:**
- `src/app/lib/useIsPhone.ts` exports the hook `useIsPhone(): boolean` (a named export).
- `src/tailwind.config.js` has a screen named `phone`, so a class written `phone:px-4` applies
  only on a phone-sized screen. Do not replace any `phone:` class below with `sm:`, `md:` or
  `max-md:`.
- `src/app/components/mobile/MobileRow.tsx` (default export) is one row of a phone list.
- `src/app/components/mobile/MobileSheet.tsx` (default export) is the slide-up sheet.
- `src/index.css` already has the class `no-scrollbar`.

If `src/app/components/mobile/MobileRow.tsx` or `src/app/lib/useIsPhone.ts` does not exist, stop
and say so. Do not write either of them.

`ActionDetail.tsx`, `ActionPdfBar.tsx`, `EditActionForm.tsx`, `EditResultPanel.tsx`,
`CloseCaseDialog.tsx`, `DeleteActionDialog.tsx`, `useDisciplinaryAdmin.ts` and
`useSaveDisciplinaryEdit.ts` are **not** edited by this prompt. They must stay byte for byte as
they are.


## 4. New file `src/app/pages/disciplinary/DisciplinaryRows.tsx`

The whole file. It must not read what an action is about (the situation type, the answers, the
expectations, the consequences): the list shows who, how serious and what state, nothing else.

```tsx
// Phone view of the Disciplinary list: one row per employee, from the same grouped, sorted and
// filtered list DisciplinaryTable gives its table. Prop-driven: no loader, no query.
// What an action is about is deliberately NOT shown here (it must not be readable over someone's
// shoulder). It is inside the case file, which opens as a sheet.
import { useEffect, useRef } from 'react';
import StatusChip from '@/app/components/StatusChip';
import MobileRow from '@/app/components/mobile/MobileRow';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { levelInfo, stateChip } from './DisciplinaryRow';
import type { DisciplinaryRowData } from './DisciplinaryRow';
import CaseFileSheet from './CaseFileSheet';

type StatusFilter = 'all' | 'open' | 'overdue' | 'closed' | 'deleted';

interface Props {
  /** Exactly the list the table would render: same employees, same order. */
  rows: DisciplinaryRowData[];
  asOf: string;
  statusFilter: StatusFilter;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** employeeName of the open case file, or null. The state lives in DisciplinaryTable. */
  openName: string | null;
  onOpen: (name: string | null) => void;
  onChanged: () => void;
}

const STATUS_WORD: Record<StatusFilter, string> = {
  all: 'All', open: 'Open', overdue: 'Overdue', closed: 'Closed', deleted: 'Deleted',
};

/** The nothing-found line names whatever is filtering the list. */
function nothingFound(statusFilter: StatusFilter, employee: string, role: string, manager: string): string {
  const parts: string[] = [];
  if (statusFilter !== 'all') parts.push(`Status: ${STATUS_WORD[statusFilter]}`);
  if (employee) parts.push(`Employee: ${employee}`);
  if (role) parts.push(`Title: ${role}`);
  if (manager) parts.push(`Manager: ${manager}`);
  return parts.length > 0 ? `No employees match ${parts.join(' · ')}` : 'No disciplinary actions on file.';
}

export default function DisciplinaryRows({
  rows, asOf, statusFilter, loading, failed, onRetry, openName, onOpen, onChanged,
}: Props) {
  const { employee, role, manager } = useGlobalFilters();

  // The open case file. While the list reloads (after Close Case, Reopen, Delete or an edit) the
  // sheet keeps the file it was showing instead of closing and opening again.
  const found = openName === null ? null : rows.find(r => r.employeeName === openName) ?? null;
  const last = useRef<DisciplinaryRowData | null>(null);
  if (found) last.current = found;
  const kept = last.current !== null && last.current.employeeName === openName;
  const sheetOpen = found !== null || (loading && kept);

  // The employee left the list (a filter changed, or the reload no longer returns them): forget
  // them, so the sheet does not come back by itself later.
  useEffect(() => {
    if (openName !== null && !loading && found === null) onOpen(null);
  }, [openName, loading, found, onOpen]);

  if (failed) {
    return (
      <div className="mx-4 mb-4 shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
        <p>Couldn&apos;t load disciplinary actions — loadDisciplinaryActions</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 h-11 w-full rounded-md border border-red-300 bg-white text-[14px] font-semibold text-red-700 active:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {rows.length > 0 ? (
        <div className="shrink-0 bg-white border-t border-slate-200">
          {rows.map(row => {
            const level = levelInfo(row.highestRank, row.latest.warning_level);
            const status = stateChip(row, asOf);
            // Same rule as the table: the outcome chip is left out when the Status chip already says it.
            const outcome = row.worstState === 'outcome'
              ? undefined
              : row.actions.find(a => a.final_outcome && a.final_outcome !== '' && !a.closed_at);
            const count = row.actions.length;
            return (
              <MobileRow
                key={row.employeeName}
                title={
                  <>
                    {row.displayName}
                    {!row.onRoster && <>{' '}<StatusChip tone="slate">Not on Roster</StatusChip></>}
                    {!row.active && <>{' '}<StatusChip tone="slate">Inactive</StatusChip></>}
                  </>
                }
                sub={[row.role, row.branch].filter(Boolean).join(' · ') || undefined}
                right={<StatusChip tone={status.tone}>{status.label}</StatusChip>}
                facts={
                  <>
                    <StatusChip tone={level.tone}>{level.label}</StatusChip>
                    {outcome && <StatusChip tone="red">{outcome.final_outcome}</StatusChip>}
                    <span>{count} {count === 1 ? 'action' : 'actions'}</span>
                  </>
                }
                muted={!row.active}
                chevron="right"
                onClick={() => onOpen(row.employeeName)}
              />
            );
          })}
        </div>
      ) : loading ? (
        <div className="shrink-0 bg-white border-t border-slate-200" role="status" aria-label="Loading">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-[60px] border-b border-slate-200 bg-white animate-pulse px-4 py-3">
              <div className="h-3.5 w-40 rounded bg-slate-200" />
              <div className="mt-2.5 h-3 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-[13px] text-slate-500">
          {nothingFound(statusFilter, employee, role, manager)}
        </p>
      )}
      <CaseFileSheet
        open={sheetOpen}
        row={found ?? last.current}
        asOf={asOf}
        onClose={() => onOpen(null)}
        onChanged={onChanged}
      />
    </>
  );
}
```


## 5. `src/app/pages/disciplinary/DisciplinaryTable.tsx`: three additions, nothing else

Every existing line of this file stays exactly as it is: the loaders and their parameters, the
`scopeNames` list, the three stages (group, filter, sort), the counts, the `<DataTable …>` and its
`className`. The phone rows are fed the same `sorted` list, the same `reload` and the same
`expandedName` state the table uses, so nothing new is stored and nothing new is loaded.

**5a.** Directly after the line `import DisciplinaryRow, { DisciplinaryRowData, DISCIPLINARY_COL_COUNT } from './DisciplinaryRow';` add:

```tsx
import DisciplinaryRows from './DisciplinaryRows';
import { useIsPhone } from '@/app/lib/useIsPhone';
```

**5b.** Inside `DisciplinaryTable`, directly after the line `  const { isDisciplinaryAdmin } = useDisciplinaryAdmin();` add:

```tsx
  const isPhone = useIsPhone();
```

**5c.** Near the end of the component, under the comment `// ── Render ──…`. Directly above the line

```tsx
  if (loading || !scopeReady) {
```

add this block, followed by one blank line

```tsx
  // Phone: rows instead of the table, from the same list. Only one of the two is ever rendered.
  if (isPhone) {
    return (
      <DisciplinaryRows
        rows={sorted} asOf={asOf} statusFilter={statusFilter}
        loading={loading || !scopeReady} failed={!!error} onRetry={reload}
        openName={expandedName} onOpen={setExpandedName} onChanged={reload}
      />
    );
  }
```

It must sit below every hook in the component (the last one is the `useEffect` that reports the
counts) and above the three existing `return`s, which stay exactly as they are. Do not move the
`<DataTable …>` into an `else`, and do not add a second `useState`.


## Acceptance — visible facts

On a phone-sized screen (375 × 667), signed in as a super user:
1. Disciplinary shows no table. Under the header there is one row per employee: the name, under
   it "role · branch", the status chip at the right ("Review Overdue 12 d", "Re-Eval 10-30-2026",
   "All Closed" …), and a second line with the highest-level chip and "1 action" / "3 actions".
   An inactive employee's name is grey with an "Inactive" chip.
2. **Nowhere on the list** is a situation type ("Attendance / Tardiness", "Calls / Lead
   Follow-up" …) or any sentence about what happened.
3. The same employees, in the same order, as the table on a computer with the same filters. The
   counts text in the header ("7 employees · 12 actions · 4 open") is the same as on a computer.
4. The header: "New Disciplinary Action" is one full-width button; under it All / Open / Overdue /
   Closed / Deleted sit on one line, each 44 px tall, and the line slides if it does not fit;
   under that the counts text and Export.
5. Tap Overdue with nobody overdue (or search a name nobody has): one centred line reads
   "No employees match Status: Overdue" (it names the filter). Tap All again.
6. Tap an employee: a sheet slides up over the page with the name as its title and, under it,
   "role · branch · 3 actions · 1 open". It lists that employee's actions, oldest first: the date,
   the status chip (Open / Overdue / Outcome / Closed), the level chip.
7. Tap an action: it opens in place, inside the sheet (no second sheet). First line: "Situation
   Type" and the full text, not cut off. Under it the action exactly as on a computer: the status
   bar, Download PDF, the six answers, the small line with the reference. Tap another action: the
   first one closes.
8. Tap Close Case, then **Cancel** in the pop-up: the pop-up closes and the sheet is still open
   on the same action. **Save nothing.**
9. Close the sheet with the ✕: the list is where it was.
10. Use View As a manager: the list holds only that manager's people, the same ones the computer
    shows for that manager, and no Deleted button, no Delete, no Edit, no Restore.
11. No console errors on load, on opening the sheet, or on opening an action.

On a computer nothing changes (1440 wide, mouse):
12. The table, its eight columns, the row that expands to the case file, the header buttons and
    their sizes are exactly as before. No sheet ever opens.

When done, reply with a one-line summary per file.
