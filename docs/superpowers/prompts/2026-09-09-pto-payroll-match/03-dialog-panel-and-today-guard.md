# 03 — Record dialog: Requested vs In payroll, "Use payroll dates", no future recording

## Files you may change

- `src/app/pages/pto/RecordApprovalDialog.tsx`
- `src/app/pages/pto/RecordDialogPayrollPanel.tsx` — **new**
- `src/app/pages/pto/PtoBreakdown.tsx` and `src/app/pages/pto/PtoSubRow.tsx` —
  **only** to pass `match` into the dialog mode (see §1)
- `src/app/pages/PtoTracker.tsx` — only to pass `today` to the dialog

**No other file.** `ptoPayrollMatch.ts`, `fmtDay.ts`, `ptoAccrual.ts` and
`src/components/ui/*` are read-only. Every file stays under 15 KB — if
`RecordApprovalDialog.tsx` would cross 14 KB, move the manual-mode Type and
Employee selects into a new `RecordDialogManualFields.tsx` (allowed in that
case only). camelCase identifiers. No `toISOString()`.

---

## 1. Carry the payroll match into the dialog

In `RecordApprovalDialog.tsx`:

```ts
export type DialogMode =
  | { kind: 'record'; request: PendingRequest; match?: PayrollMatch }
  | { kind: 'edit';   row: LedgerRow;          match?: PayrollMatch }
  | { kind: 'manual' };
```

(`import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch'`.) In
`PtoSubRow.tsx`, the Record and Edit buttons pass `match: item.match`. Nothing
else changes in `PtoSubRow.tsx` / `PtoBreakdown.tsx`.

Props gain `today: string`; `PtoTracker.tsx` passes the `today` it already
computes.

## 2. Nothing in the future can be recorded

In `handleSave`, right after the "Return date must be on or after the leave
date" check:

```ts
if (returnOn > today) {
  setError('The return date has not passed yet — record this after the employee is back.');
  return;
}
```

Applies to all three modes (record, edit, manual).

## 3. Floating holidays count weekdays, PTO counts calendar days

The auto-recalc effect currently does
`setTotalDays(String(defaultTotalDays(leaveOn, returnOn)))` for every type.
Change it to:

```ts
setTotalDays(String(leaveType === 'floating_holiday'
  ? weekdayCount(leaveOn, returnOn)
  : defaultTotalDays(leaveOn, returnOn)));
```

(`weekdayCount` from `@/app/lib/fmtDay`.) Add `leaveType` to the effect's
dependency list so switching the Type select in manual mode recalculates.

## 4. Requested vs In payroll — `RecordDialogPayrollPanel.tsx`

Replace the "Requested on Monday" card (record mode) and the `daysMismatch`
note with one component rendered in **record and edit** modes:

```ts
interface Props {
  requested: { leaveOn: string; returnOn: string; days: number; reason?: string | null; submittedAt?: string | null; source: 'Monday' | 'ledger' };
  match: PayrollMatch | null;
  leaveType: 'pto' | 'floating_holiday';
  thisYear: string;
  onApply: (leaveOn: string, returnOn: string, days: number) => void;
}
```

Layout: `grid grid-cols-2 gap-3`.

**Left card** (`rounded-lg bg-slate-50 border border-slate-200 p-3`): label
`REQUESTED ON MONDAY` (or `RECORDED` when `source === 'ledger'`) in the
existing `text-[11px] font-semibold uppercase tracking-wide text-slate-400`
style; then `fmtRange(leaveOn, returnOn, thisYear)`; then
`{days} day(s)` + `· "{reason}"` when present, `text-slate-500`; then
`Submitted {fmtDay(submittedAt, thisYear)}` in `text-[11px] text-slate-400`
when present.

**Right card** (`rounded-lg bg-sky-50 border border-sky-200 p-3`): label
`IN PAYROLL` plus the cycle names in `font-mono text-sky-700`. Body by state,
reusing the wording from `PtoPayrollCell` (do not import that component —
it is a table cell; write the three lines here):

- `matched` with `firstOff`: line 1 the off days as `byType` (`PTO ×3`), line 2
  `Back {fmtDay(actualReturn)}` (or `return not in payroll` when null), line 3
  `{actualDays} day(s) off` — in `text-sky-900`.
- `partial`: byType line, then `Return not in payroll yet`.
- `future` / `not_processed` / `no_rows` / `worked` / `matched` without
  `firstOff`: the same single phrase the cell uses, in `text-slate-500`.
- `match === null`: `No payroll data loaded`.

Under the right card, a button `Use payroll dates` (lucide `ArrowDown`,
`variant="outline" size="sm"`), **enabled only when**
`match?.state === 'matched' && match.firstOff && match.actualReturn && match.actualDays !== null`.
Click → `onApply(match.firstOff, match.actualReturn, match.actualDays)`.

## 5. Wire it in the dialog

- Render `<RecordDialogPayrollPanel>` where the Monday card used to be, for
  `record` and `edit` modes. For `record`, `requested` comes from
  `mode.request` (`leave_on`, `return_on`, `total_days`, `reason`,
  `submitted_at`, source `'Monday'`); for `edit`, from `mode.row`
  (source `'ledger'`, no reason/submittedAt).
- `onApply` sets `leaveOn`, `returnOn` **and** `totalDays`. Because the recalc
  effect fires on the date change, apply the days **after** the dates in the
  same handler; if the effect still overwrites the FH count, guard it with a
  ref flag set by `onApply` and cleared by the effect once it has skipped one
  run. Verify: after clicking the button the three fields show exactly the
  payroll values.
- Keep a one-line note under Total days when the current form value differs
  from the payroll value: `Payroll shows {actualDays} day(s); recording
  {totalDays}.` in `text-[12px] text-amber-600` — only when
  `match?.state === 'matched' && match.actualDays !== null`.
- New: when `leaveType === 'floating_holiday'` and the row's employee has FH
  data in the mode (not available in the dialog today) — **skip**; the FH
  balance guard is out of scope for this prompt.
- The primary button label becomes `Record {totalDays} day(s)` in record mode
  when `totalDays` is a positive number; `Save changes` / `Add approval`
  unchanged.

---

## Verify

1. Record on a matched past request: both cards render; **Use payroll dates**
   fills leave / return / days with the payroll values and they stay put.
2. Set return to tomorrow → the error shows, nothing saves. Same in manual mode.
3. Manual add, Type = Floating holiday, Fri → Mon: Total days auto-fills **1**.
   Type = PTO, same dates: **3**.
4. Edit on an Excel-imported row (no Monday request) still saves.
5. `git status --short` shows only the allowed files; every file under 15 KB;
   tests green.
