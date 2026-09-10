# 09 — Record dialog: split the manual fields out, refuse unprocessed payroll, impact lines in the panel

`RecordApprovalDialog.tsx` is 14.1 KB — over the ~12 KB "split it" guidance
and one change away from the 15 KB limit. Split first, then add the rule.

## Files you may change

- `src/app/pages/pto/RecordDialogManualFields.tsx` — **new**
- `src/app/pages/pto/RecordApprovalDialog.tsx`
- `src/app/pages/pto/RecordDialogPayrollPanel.tsx`

**No other file.** `ptoPayrollMatch.ts` is read-only. Every file under 15 KB —
the dialog must end **under 13 KB**. camelCase identifiers. No `toISOString()`.

## 1. `RecordDialogManualFields.tsx` — new, prop-driven

Move the two manual-mode blocks out of the dialog verbatim: the **Type**
`<select>` (`pto` / `floating_holiday`) and the **Employee** `<select>` with
its sorted options and "(inactive)" suffix.

```ts
interface Props {
  leaveType: 'pto' | 'floating_holiday';
  onLeaveType: (v: 'pto' | 'floating_holiday') => void;
  empId: number | null;
  onEmpId: (v: number | null) => void;
  employees: { id: number; display_name: string; active: boolean }[];  // already sorted
}
```

The dialog keeps the `loadAllEmployees` call (`enabled: mode?.kind === 'manual'`)
and the sorting, and renders `<RecordDialogManualFields …/>` in manual mode
where the two blocks used to be. Same markup, same classes — this is a move,
not a redesign.

## 2. Refuse recording when payroll has not been processed — record mode only

In `handleSave`, after the existing "return date has not passed yet" check and
**only when `mode.kind === 'record'`**:

```ts
import { recordability } from '@/app/lib/ptoPayrollMatch';
…
if (mode.kind === 'record' && mode.match) {
  const rec = recordability(mode.match, returnOn, today, defaultTotalDays);
  if (!rec.ok && rec.reason === 'not_processed') {
    setError('Payroll for these dates has not been processed yet — record this after it runs.');
    return;
  }
  if (!rec.ok && rec.reason === 'invalid') {
    setError('The Monday request has its return before its leave date — fix it on the board first.');
    return;
  }
}
```

Edit and manual modes keep only the existing "return date has passed" rule —
rows from before payroll existed in this system (March 2026) must stay
editable and addable.

## 3. Impact lines in the panel — `RecordDialogPayrollPanel.tsx`

Where the right card lists `byType` (`PTO ×3`), render one line per entry,
the same way the table cell now does: `{label} ×{count}` followed by
`<span className="text-sky-700/70"> · {impact}</span>` when `impact` is
non-empty. When `match.state === 'invalid'` the right card shows one line,
`Request dates are invalid` in `text-red-600`, and the **Use payroll dates**
button stays disabled.

## Verify

1. `RecordApprovalDialog.tsx` < 13 KB; `RecordDialogManualFields.tsx` < 4 KB.
2. Add manually still works end to end (Type select, Employee select, save).
3. Record on Ulla Hees `Aug 31 → Sep 7` (uncovered): the dialog opens (the row
   button will be disabled after prompt 08, so open it via a covered row's
   Edit to sanity-check the panel, and trust the guard message wording in
   code review) — the save path shows the "has not been processed yet" error
   when `recordability` says `not_processed`.
4. Edit on a pre-March Excel row still saves.
5. The panel shows `Ausencia Justificada. ×1 · Incapacidad` on Arelis Acosta's
   FH May 11 row.
6. Only the three files above changed; tests green.
