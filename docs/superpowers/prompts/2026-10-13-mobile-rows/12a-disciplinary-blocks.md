# Phone view, rows 5a: Disciplinary list and case file, part 1 of 2 (the case-file sheet and the header)

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

**This is part 1 of 2.** It makes five helpers importable, adds the case-file sheet as a new file that nothing uses yet, and adds the phone classes to the page header. The table stays on every screen after this part. Part 2 follows as a separate prompt. Write everything exactly as given: do not adapt it, shorten it, or wire the new file into anything.

**Only these files may change.** One new: `src/app/pages/disciplinary/CaseFileSheet.tsx`. Three edited: `src/app/pages/disciplinary/DisciplinaryRow.tsx`, `src/app/pages/disciplinary/CaseFile.tsx`, `src/app/pages/Disciplinary.tsx`. **No other file may be touched.** No migration, no action file.

Rules:
- Only these files may change: the four listed above. No other file may be touched. No action file, no migration.
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


## 1. `src/app/pages/disciplinary/DisciplinaryRow.tsx`: two helpers become exports, nothing else

The phone rows must show the same Highest Level chip and the same Status chip the table shows, so
they import the two functions that decide them instead of copying them. Only the word `export` is
added, twice. The body of each function, and everything else in the file, stays exactly as it is.

**1a.** Replace

```tsx
function levelInfo(rank: number, rawLevel: string | null): LevelInfo {
```

with

```tsx
export function levelInfo(rank: number, rawLevel: string | null): LevelInfo {
```

**1b.** Replace

```tsx
function stateChip(row: DisciplinaryRowData, asOf: string): { label: string; tone: ChipTone } {
```

with

```tsx
export function stateChip(row: DisciplinaryRowData, asOf: string): { label: string; tone: ChipTone } {
```


## 2. `src/app/pages/disciplinary/CaseFile.tsx`: three helpers become exports, nothing else

Same reason, for the chips on one action. Only the word `export` is added, three times.

**2a.** Replace

```tsx
function levelInfo(row: DisciplinaryRow): LevelInfo {
```

with

```tsx
export function levelInfo(row: DisciplinaryRow): LevelInfo {
```

**2b.** Replace

```tsx
function stateTone(s: ReturnType<typeof caseState>): ChipTone {
```

with

```tsx
export function stateTone(s: ReturnType<typeof caseState>): ChipTone {
```

**2c.** Replace

```tsx
function stateLabel(s: ReturnType<typeof caseState>): string {
```

with

```tsx
export function stateLabel(s: ReturnType<typeof caseState>): string {
```


## 3. New file `src/app/pages/disciplinary/CaseFileSheet.tsx`

The whole file:

```tsx
// Phone: one employee's case file as a full-height sheet. One row per action, oldest first (the
// order CaseFile uses on a computer). A row opens in place, one at a time, to the existing
// ActionDetail, so every button and every rule about who may press it is ActionDetail's own.
// Prop-driven: no loader, no query.
import { useEffect, useState } from 'react';
import StatusChip from '@/app/components/StatusChip';
import MobileRow from '@/app/components/mobile/MobileRow';
import MobileSheet from '@/app/components/mobile/MobileSheet';
import { fmtDate } from '@/app/lib/fmtDate';
import { caseState } from '@/app/lib/disciplinary';
import { levelInfo, stateLabel, stateTone } from './CaseFile';
import type { DisciplinaryRowData } from './DisciplinaryRow';
import ActionDetail from './ActionDetail';

interface Props {
  open: boolean;
  /** The employee whose file is shown. It stays set while the sheet closes, so the sheet never goes blank. */
  row: DisciplinaryRowData | null;
  asOf: string;
  onClose: () => void;
  onChanged: () => void;
}

export default function CaseFileSheet({ open, row, asOf, onClose, onChanged }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);

  // A closed file forgets which action was open.
  useEffect(() => {
    if (!open) setOpenId(null);
  }, [open]);

  if (!row) return null;

  // Oldest first so escalation reads chronologically.
  const chronological = [...row.actions].reverse();
  const total = row.actions.length;
  const stillOpen = row.actions.filter(a => !a.deleted_at && caseState(a, asOf) !== 'closed').length;
  const subtitle = [
    row.role,
    row.branch,
    `${total} ${total === 1 ? 'action' : 'actions'}`,
    stillOpen > 0 ? `${stillOpen} open` : '',
  ].filter(Boolean).join(' · ');

  return (
    <MobileSheet open={open} onClose={onClose} size="full" title={row.displayName} subtitle={subtitle}>
      <div className="bg-white">
        {chronological.map(a => {
          const level = levelInfo(a);
          const state = caseState(a, asOf);
          const isOpen = openId === a.id;
          return (
            <MobileRow
              key={a.id}
              title={fmtDate(a.document_date) || '—'}
              right={a.deleted_at
                ? <StatusChip tone="slate">Deleted</StatusChip>
                : <StatusChip tone={stateTone(state)}>{stateLabel(state)}</StatusChip>}
              facts={
                <>
                  <StatusChip tone={level.tone}>{level.label}</StatusChip>
                  {a.final_outcome && <StatusChip tone="red">{a.final_outcome}</StatusChip>}
                </>
              }
              muted={!!a.deleted_at || state === 'closed'}
              chevron={isOpen ? 'up' : 'down'}
              expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : a.id)}
            >
              {isOpen && (
                <div className="bg-slate-50 pb-2 text-[13px]">
                  {a.scenario && (
                    <p className="px-4 pt-3 pb-1 leading-5 text-slate-700 break-words">
                      <span className="block text-[12px] font-semibold text-slate-500">Situation Type</span>
                      {a.scenario}
                    </p>
                  )}
                  <ActionDetail action={a} asOf={asOf} onChanged={onChanged} />
                </div>
              )}
            </MobileRow>
          );
        })}
      </div>
    </MobileSheet>
  );
}
```

`<ActionDetail action={a} asOf={asOf} onChanged={onChanged} />` is exactly what `CaseFile.tsx`
passes. Do not add a prop to it and do not wrap it in a condition of its own.


## 6. `src/app/pages/Disciplinary.tsx`: five class strings, nothing else

Only `phone:` classes (and `no-scrollbar`, which does nothing to a line that does not scroll) are
added to five existing class strings. No line is added, removed or moved. The export, the counts
text and `STATUS_OPTIONS` stay exactly as they are.

**6a.** The "New Disciplinary Action" link. Replace

```tsx
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors select-none"
```

with

```tsx
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors select-none phone:w-full phone:h-11 phone:justify-center phone:text-[13px]"
```

**6b.** The counts text. Replace

```tsx
        <span className="text-[12px] text-slate-400 mr-1">{countSummary}</span>
```

with

```tsx
        <span className="text-[12px] text-slate-400 mr-1 phone:order-3 phone:flex-1 phone:mr-0 phone:text-slate-500">{countSummary}</span>
```

**6c.** The group of status buttons. Replace

```tsx
        className="flex items-center gap-1"
        role="group"
```

with

```tsx
        className="flex items-center gap-1 no-scrollbar phone:order-2 phone:w-full phone:overflow-x-auto phone:p-0.5"
        role="group"
```

**6d.** Each status button. Replace

```tsx
                'h-8 px-3 rounded-lg text-xs font-semibold border transition-colors select-none focus-visible:ring-2 focus-visible:ring-primary/30 focus:outline-none',
```

with

```tsx
                'h-8 px-3 rounded-lg text-xs font-semibold border transition-colors select-none focus-visible:ring-2 focus-visible:ring-primary/30 focus:outline-none phone:h-11 phone:min-w-11 phone:shrink-0',
```

**6e.** The Export button. Replace

```tsx
        className="focus-visible:ring-2 focus-visible:ring-primary/30"
```

with

```tsx
        className="focus-visible:ring-2 focus-visible:ring-primary/30 phone:order-3 phone:h-11 phone:px-4"
```


## Acceptance

1. `CaseFileSheet.tsx` exists with exactly the content above; `DisciplinaryRow.tsx` and `CaseFile.tsx` differ only by the word `export` (twice and three times); `Disciplinary.tsx` differs only in the five class strings.
2. On a computer (1440 wide, mouse), Disciplinary looks and works exactly as before: the table, the row that expands to the case file, the header buttons and their sizes.
3. On a phone-sized screen (375 × 667) the only change is the header: "New Disciplinary Action" is one full-width button, the status buttons sit on one line under it, each 44 px tall, and the counts text and Export are under that. The table under the header is still the table, and no sheet opens yet.
4. No console errors.

When done, reply with a one-line summary per file.
