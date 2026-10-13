# Phone view, rows 3a: PTO Tracker, part 1 of 3 (the two building blocks)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the PTO Tracker is an eleven-column table you slide sideways, and the things a
mouse-over explains (how the floating holidays were counted, why Record is switched off, the GAF
comments on a request) cannot be read at all. This prompt gives a phone one row per employee
instead: the name, the title, and **Available** as the one large number. A manager taps a row and
it opens in place to read the rest. A super user taps a row and it opens a sheet that also has
What Payroll Says, the evidence and the Record / Edit / Withdraw / Restore buttons. On a computer
nothing changes.

**This is part 1 of 3.** It only adds two new files that nothing uses yet, so nothing on any screen changes after this part. Parts 2 and 3 follow as separate prompts. Write the two files exactly as given: do not adapt them, shorten them, or wire them into anything.

**Only these files may change.** Two new: `src/app/lib/ptoPhone.ts`, `src/app/pages/pto/PtoRequestRows.tsx`. **No other file may be touched.** No migration, no action file.

Rules:
- Only these files may change: the two listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Follow the Phone section of `src/DESIGN.md`.

Also for this prompt:
- `src/app/pages/pto/RecordApprovalDialog.tsx`, `PtoVerdictCell.tsx`, `PtoPayrollCell.tsx`,
  `PtoSubRow.tsx`, `PtoRow.tsx` and `src/app/pages/PtoTracker.tsx` are **used as they are and not
  edited**, not even their spacing.
- No new data. The rows are built from what the table already loads. Do not add a
  `useLoadAction` or a `useMutateAction` call anywhere, and do not import anything from
  `@/actions/` in the three new files.
- Record, Edit, Withdraw and Restore stay super-user only. Do not move, copy or loosen any
  `isSuper` check.

Already in the app from earlier prompts. **Use them; do not create, edit or redefine them:**
- `src/app/lib/useIsPhone.ts` exports the hook `useIsPhone(): boolean` (a named export).
- `src/tailwind.config.js` has a screen named `phone`, so a class written `phone:px-4` applies
  only on a phone-sized screen. Do not replace any `phone:` class below with `sm:`, `md:` or
  `max-md:`.
- `src/app/components/mobile/MobileRow.tsx` (default export) is one row of a phone list.
- `src/app/components/mobile/MobileSheet.tsx` (default export) is the slide-up sheet.

If `src/app/components/mobile/MobileRow.tsx` or `src/app/lib/useIsPhone.ts` does not exist, stop
and say so. Do not write them.


## 1. New file `src/app/lib/ptoPhone.ts`

The whole file:

```ts
// Words for the PTO Tracker's phone rows. Pure, no imports: node tests load this file directly.
// On a computer these facts sit in mouse-over notes; on a phone they are written out.

export type FhFacts = {
  fh_left: number;
  fh_eligible_from: string | null;
  fh_used: number | string;
  fh_allocated: number | string;
  fh_sheet_used: number | string;
};

/** The note behind the FH Left number: the same words as the table's mouse-over. `day` formats a YYYY-MM-DD date. */
export function fhBreakdownText(row: FhFacts, day: (ymd: string) => string): string {
  if (row.fh_left === 0 && row.fh_eligible_from) {
    return `Eligible ${day(row.fh_eligible_from)} — 90 days after hire`;
  }
  const used = Number(row.fh_used) || 0;
  const allocated = Number(row.fh_allocated) || 2;
  const sheetUsed = Number(row.fh_sheet_used) || 0;
  return `Used ${used} of ${allocated} this year · August sheet said ${sheetUsed}`;
}

/** Why Record is switched off: the same words as the table's mouse-over. null = it can be recorded. */
export function recordBlockedText(reason: 'future' | 'not_processed' | 'invalid' | null): string | null {
  if (reason === 'future') return 'Record after the return date has passed';
  if (reason === 'not_processed') return 'Payroll for these dates has not been processed yet';
  if (reason === 'invalid') return 'Return date is before the leave date — fix the Monday request';
  return null;
}

/** "1 day", "3 days", "0.5 days". */
export function daysLabel(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/** The line shown when no employee is listed. It names every filter that is on. */
export function nothingFoundText(f: {
  employee?: string | null;
  role?: string | null;
  manager?: string | null;
  chip?: 'review' | 'waiting' | null;
}): string {
  const parts: string[] = [];
  const who = (f.employee ?? '').trim();
  if (who) parts.push(/^\d+$/.test(who) ? 'the chosen employee' : `"${who}"`);
  if (f.role) parts.push(`Title: ${f.role}`);
  if (f.manager) parts.push(`Manager: ${f.manager}`);
  if (f.chip === 'review') parts.push('To Review');
  if (f.chip === 'waiting') parts.push('Not Yet');
  return parts.length > 0 ? `No employees match ${parts.join(' · ')}` : 'No employees to show';
}
```

This file must stay free of imports.


## 2. New file `src/app/pages/pto/PtoRequestRows.tsx`

One employee's requests as phone rows. `RequestActions` holds the only four write buttons; it is
rendered only by `SuperDetail`, and `SuperDetail` is rendered only behind `isSuper`. The whole
file:

```tsx
import { AlertCircle, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MobileRow from '@/app/components/mobile/MobileRow';
import { useViewer } from '@/app/context/ViewerContext';
import { fmtDay, fmtLeaveDates } from '@/app/lib/fmtDay';
import { defaultTotalDays } from '@/app/lib/ptoAccrual';
import { recordability } from '@/app/lib/ptoPayrollMatch';
import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch';
import { daysLabel, recordBlockedText } from '@/app/lib/ptoPhone';
import type { DialogMode } from './RecordApprovalDialog';
import type { SubItem } from './PtoSubRow';
import PtoPayrollCell from './PtoPayrollCell';
import PtoVerdictCell from './PtoVerdictCell';

type Item = SubItem & { match: PayrollMatch };

interface Handlers {
  onOpenDialog: (m: DialogMode) => void;
  onWithdraw: (id: number, days: number) => void;
  onRestore: (id: number) => void;
}

interface Props extends Handlers {
  /** Built by PtoBreakdown: the same list, in the same order, as the table's sub-rows. */
  items: Item[];
  today: string;
  loading: boolean;
}

const PILL = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap';
const LABEL = 'mb-0.5 text-[12px] font-semibold text-slate-600';
const BTN = 'h-11 flex-1 text-[14px]';

/** Super users only. The same four actions as the table's last column, with the same rules. */
function RequestActions({ item, today, onOpenDialog, onWithdraw, onRestore }: Handlers & { item: Item; today: string }) {
  const withdrawn = item.kind === 'recorded' && item.status === 'withdrawn';
  const rec = recordability(item.match, item.return_on, today, defaultTotalDays);
  const blocked = recordBlockedText(rec.reason);
  return (
    <div className="flex flex-wrap gap-2">
      {withdrawn && (
        <Button variant="outline" className={BTN} onClick={() => onRestore(item.id!)}>
          <RotateCcw className="w-4 h-4" />
          Restore
        </Button>
      )}
      {item.kind === 'pending' && (
        <>
          <Button
            className={`${BTN} bg-warm text-warm-ink hover:bg-warm hover:brightness-95 font-semibold`}
            onClick={() => onOpenDialog({ kind: 'record', request: item.request, match: item.match })}
            disabled={!rec.ok}
          >
            <Plus className="w-4 h-4" />
            Record
          </Button>
          {blocked && (
            <p className="basis-full text-[12px] text-slate-500">{blocked}</p>
          )}
        </>
      )}
      {item.kind === 'recorded' && !withdrawn && (
        <>
          <Button
            variant="outline"
            className={BTN}
            onClick={() => onOpenDialog({ kind: 'edit', row: item.request, match: item.match })}
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
          {item.status === 'recorded' && (
            <Button variant="outline" className={BTN} onClick={() => onWithdraw(item.id!, item.days)}>
              <Trash2 className="w-4 h-4" />
              Withdraw
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** Super users only: what payroll says, the evidence, where the row came from, and the actions. */
function SuperDetail({ item, today, thisYear, ...handlers }: Handlers & { item: Item; today: string; thisYear: string }) {
  const sourceNote = item.kind === 'pending' ? 'from Monday board'
    : item.source === 'excel_import' ? 'from Excel'
    : item.source === 'manual' ? 'added manually'
    : '';
  return (
    <>
      {item.match.state && (
        <div>
          <div className={LABEL}>What Payroll Says</div>
          <PtoVerdictCell
            match={item.match}
            leaveType={item.leave_type}
            requestDays={item.days}
            leaveOn={item.leave_on}
            thisYear={thisYear}
            today={today}
          />
        </div>
      )}
      {item.match.state && (
        <div>
          <div className={LABEL}>Evidence</div>
          <div className="text-[12px] [&>span]:text-left">
            <PtoPayrollCell match={item.match} thisYear={thisYear} />
          </div>
        </div>
      )}
      {sourceNote && <p className="text-[12px] text-slate-500">{sourceNote}</p>}
      <RequestActions item={item} today={today} {...handlers} />
    </>
  );
}

/** The requests of one employee on a phone. Reading only, unless the viewer is a super user. */
export default function PtoRequestRows({ items, today, loading, onOpenDialog, onWithdraw, onRestore }: Props) {
  const { isSuper } = useViewer();
  const thisYear = today.slice(0, 4);

  if (items.length === 0) {
    return (
      <p className="border-t border-slate-200 bg-white px-4 py-4 text-center text-[13px] text-slate-500">
        Nothing recorded or pending
      </p>
    );
  }

  return (
    <div className="border-t border-slate-200 bg-white" aria-busy={loading}>
      {items.map((item, i) => {
        const withdrawn = item.kind === 'recorded' && item.status === 'withdrawn';
        const fh = item.leave_type === 'floating_holiday';
        const invalid = Boolean(item.match.invalidDates);
        return (
          <MobileRow
            key={item.kind === 'pending'
              ? `p-${item.request?.monday_item_id ?? i}`
              : `r-${item.id}`}
            muted={withdrawn}
            title={
              <>
                <span aria-hidden="true">{fh ? '⭐' : '🌴'}</span>
                {' '}{fh ? 'Floating Holiday' : 'PTO'} · {daysLabel(item.days)}
              </>
            }
            right={
              item.kind === 'pending'
                ? <span className={`${PILL} bg-status-yellow-fill text-status-yellow-ink`}>Pending</span>
                : withdrawn
                  ? <span className={`${PILL} bg-status-red-fill text-status-red-ink line-through`}>Withdrawn</span>
                  : <span className={`${PILL} bg-status-green-fill text-status-green-ink`}>Recorded</span>
            }
            facts={
              <>
                <span>{fmtLeaveDates(item.leave_on, item.return_on, thisYear)}</span>
                {item.return_on && <span>back {fmtDay(item.return_on, thisYear)}</span>}
                {withdrawn && item.withdrawnAt && <span>withdrawn {fmtDay(item.withdrawnAt, thisYear)}</span>}
              </>
            }
          >
            {(invalid || item.comments || isSuper) && (
              <div className="space-y-3 bg-white px-4 pb-3 text-[13px]">
                {invalid && (
                  <p className="flex items-start gap-1.5 rounded-md bg-status-red-fill px-2.5 py-1.5 text-[12px] font-medium text-status-red-ink">
                    <AlertCircle className="mt-0.5 w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    Return is before leave — fix on Monday
                  </p>
                )}
                {item.comments && (
                  <p className="break-words text-slate-600">
                    <span className="font-medium text-slate-700">GAF comments: </span>
                    {item.comments}
                  </p>
                )}
                {isSuper && (
                  <SuperDetail
                    item={item}
                    today={today}
                    thisYear={thisYear}
                    onOpenDialog={onOpenDialog}
                    onWithdraw={onWithdraw}
                    onRestore={onRestore}
                  />
                )}
              </div>
            )}
          </MobileRow>
        );
      })}
    </div>
  );
}
```


## Acceptance

1. The two new files exist with exactly the content above.
2. No existing file changed, and every page looks and works as before on a phone and on a computer.

When done, reply with a one-line summary per file.
