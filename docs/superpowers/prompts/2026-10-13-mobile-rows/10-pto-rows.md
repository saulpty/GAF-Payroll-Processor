# Phone view, rows 3: PTO Tracker

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the PTO Tracker is an eleven-column table you slide sideways, and the things a
mouse-over explains (how the floating holidays were counted, why Record is switched off, the GAF
comments on a request) cannot be read at all. This prompt gives a phone one row per employee
instead: the name, the title, and **Available** as the one large number. A manager taps a row and
it opens in place to read the rest. A super user taps a row and it opens a sheet that also has
What Payroll Says, the evidence and the Record / Edit / Withdraw / Restore buttons. On a computer
nothing changes.

**Only these files may change.** Three new: `src/app/lib/ptoPhone.ts`,
`src/app/pages/pto/PtoRequestRows.tsx`, `src/app/pages/pto/PtoRows.tsx`. Three edited:
`src/app/pages/pto/PtoBreakdown.tsx`, `src/app/pages/pto/PtoTable.tsx`,
`src/app/pages/pto/PtoComingUp.tsx`. **No other file may be touched.** No migration, no action
file.

Rules:
- Only these files may change: the six listed above. No other file may be touched. No action file, no migration.
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

## 3. New file `src/app/pages/pto/PtoRows.tsx`

The employee list on a phone. It receives the list `PtoTable` has already filtered and sorted; it
loads nothing itself. The whole file:

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import MobileRow from '@/app/components/mobile/MobileRow';
import MobileSheet from '@/app/components/mobile/MobileSheet';
import { useViewer } from '@/app/context/ViewerContext';
import { fmtDay } from '@/app/lib/fmtDay';
import type { PeriodRow } from '@/app/lib/ptoPayrollMatch';
import { fhBreakdownText } from '@/app/lib/ptoPhone';
import PtoBreakdown from './PtoBreakdown';
import type { PtoRowData } from './PtoRow';
import type { DialogMode } from './RecordApprovalDialog';

/** What PtoBreakdown needs besides the row. The same values the table hands it. */
interface DetailProps {
  year: string;
  today: string;
  periods: PeriodRow[];
  onOpenDialog: (m: DialogMode) => void;
  onChanged: () => void;
  refreshToken: number;
}

interface Props extends DetailProps {
  /** The list PtoTable already filtered and sorted: the same one the table shows. */
  rows: PtoRowData[];
  /** First load, nothing to show yet. */
  loading: boolean;
  /** The line for an empty list. It names the filters that are on. */
  emptyText: string;
  /** Which employees are open in place: PtoTable's own state, shared with the table. */
  expanded: Set<number>;
  onToggle: (id: number) => void;
}

const two = (v: number | null): string => (v === null ? '—' : v.toFixed(2));

function count(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return Number.isNaN(n) ? '—' : String(n);
}

function Line({ label, value, note, red = false }: { label: string; value: ReactNode; note?: string; red?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className={cn('text-right font-medium tabular-nums', red ? 'text-red-600' : 'text-slate-900')}>
        {value}
        {note && <span className="block text-[12px] font-normal text-slate-500">{note}</span>}
      </dd>
    </div>
  );
}

/** Everything the row itself does not show: the other balances written out, then the requests. */
function PtoDetail({ row, thisYear, full = false, ...detail }: DetailProps & { row: PtoRowData; thisYear: string; full?: boolean }) {
  return (
    <div className="bg-slate-50 text-[13px]">
      <dl className="px-4 py-3">
        {full && (
          <>
            <Line label="Available" value={two(row.available)} red={row.available !== null && row.available < 0} />
            <Line label="Accrued" value={two(row.accrued)} />
            <Line label="Taken" value={(Number(row.taken_days) || 0).toFixed(2)} />
          </>
        )}
        <Line label="Start Date" value={row.start ? fmtDay(row.start, thisYear) : '—'} />
        <Line label="FH Left" value={count(row.fh_left)} note={fhBreakdownText(row, d => fmtDay(d, thisYear))} />
        <Line label="Paid PTO" value={count(row.paid_pto_days)} />
        <Line label="WFH" value={count(row.wfh_days)} />
        <Line label="Birthday" value={count(row.birthday_days)} />
      </dl>
      <h3 className="px-4 pb-2 text-[12px] font-semibold text-slate-600">Requests</h3>
      <PtoBreakdown key={String(row.employee_id)} row={row} phone {...detail} />
    </div>
  );
}

/** PTO Tracker on a phone: one row per employee. PtoTable renders this instead of the table. */
export default function PtoRows({ rows, loading, emptyText, expanded, onToggle, ...detail }: Props) {
  const { isSuper } = useViewer();
  // Super users: the employee whose sheet is open.
  const [opened, setOpened] = useState<PtoRowData | null>(null);
  const thisYear = detail.today.slice(0, 4);
  // Prefer the fresh row after a reload; keep the last one if a filter has since hidden it.
  const sheetRow = opened ? rows.find(r => r.employee_id === opened.employee_id) ?? opened : null;

  if (loading) {
    return (
      <div className="shrink-0 border-t border-slate-200 bg-white" aria-busy="true">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-[60px] border-b border-slate-200 bg-white px-4 py-3 animate-pulse">
            <div className="h-3.5 w-40 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-56 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white">
      {rows.length === 0 && (
        <p className="border-b border-slate-200 px-4 py-8 text-center text-[13px] text-slate-500">{emptyText}</p>
      )}
      {rows.map(row => {
        const open = !isSuper && expanded.has(row.employee_id);
        const negative = row.available !== null && row.available < 0;
        return (
          <MobileRow
            key={row.employee_id}
            title={row.display_name}
            sub={row.role || !row.start ? (
              <>
                {row.role}
                {!row.start && <span className="block text-amber-700">no start date</span>}
              </>
            ) : undefined}
            right={
              <span className="flex flex-col items-end">
                <span className={cn('text-[20px] font-bold leading-6 tabular-nums', negative ? 'text-red-600' : 'text-slate-900')}>
                  {two(row.available)}
                </span>
                <span className="text-[12px] leading-4 text-slate-500">Available</span>
              </span>
            }
            facts={
              <>
                <span>{two(row.accrued)} accrued</span>
                <span>{(Number(row.taken_days) || 0).toFixed(2)} taken</span>
                {isSuper && row.review > 0 && (
                  <span className="inline-flex items-center rounded-full bg-status-yellow-fill px-2 py-0.5 text-[12px] font-medium text-status-yellow-ink">
                    {row.review} to review
                  </span>
                )}
                {isSuper && row.waiting > 0 && <span>{row.waiting} not yet</span>}
              </>
            }
            chevron={isSuper ? 'right' : open ? 'up' : 'down'}
            expanded={isSuper ? undefined : open}
            onClick={() => (isSuper ? setOpened(row) : onToggle(row.employee_id))}
          >
            {open && <PtoDetail row={row} thisYear={thisYear} {...detail} />}
          </MobileRow>
        );
      })}
      <MobileSheet
        open={isSuper && sheetRow !== null}
        onClose={() => setOpened(null)}
        title={sheetRow?.display_name ?? ''}
        subtitle={sheetRow?.role ?? undefined}
        size="full"
      >
        {sheetRow && <PtoDetail row={sheetRow} thisYear={thisYear} full {...detail} />}
      </MobileSheet>
    </div>
  );
}
```

## 4. `src/app/pages/pto/PtoBreakdown.tsx`: five edits, nothing else

`PtoBreakdown` already loads one employee's requests, works out what payroll says about each, and
owns Withdraw and Restore. On a phone it hands that same list to `PtoRequestRows` instead of
drawing the small table. The loader, the list building, `handleWithdraw` (with its
`window.confirm`) and `handleRestore` stay exactly as they are.

**4a.** Directly after the line `import PtoSubRow, { type SubItem } from './PtoSubRow';` add:

```tsx
import PtoRequestRows from './PtoRequestRows';
```

**4b.** Directly after the line `  refreshToken: number;` add:

```tsx
  /** Phone: the requests as rows instead of the small table. Only PtoRows passes it. */
  phone?: boolean;
```

**4c.** Replace

```tsx
export default function PtoBreakdown({ row, year, today, periods, onOpenDialog, onChanged, refreshToken }: Props) {
```

with

```tsx
export default function PtoBreakdown({ row, year, today, periods, onOpenDialog, onChanged, refreshToken, phone = false }: Props) {
```

**4d.** Replace

```tsx
      <div className="px-6 py-2 flex items-center gap-2 text-[12px] text-red-600">
        <span>Couldn&apos;t load details — loadPtoEmployeeDetail</span>
        <Button size="sm" variant="outline" onClick={() => reload()}>
```

with

```tsx
      <div className="px-6 py-2 flex items-center gap-2 text-[12px] text-red-600 phone:flex-col phone:items-stretch phone:px-4 phone:py-3 phone:text-[13px]">
        <span>Couldn&apos;t load details — loadPtoEmployeeDetail</span>
        <Button size="sm" variant="outline" className="phone:min-h-11" onClick={() => reload()}>
```

**4e.** Replace

```tsx
  return (
    <div className="px-6 py-3">
```

with

```tsx
  // Phone: the same list as rows. Super-only parts are decided inside PtoRequestRows.
  if (phone) {
    return (
      <PtoRequestRows
        items={items}
        today={today}
        loading={loading}
        onOpenDialog={onOpenDialog}
        onWithdraw={handleWithdraw}
        onRestore={handleRestore}
      />
    );
  }

  return (
    <div className="px-6 py-3">
```

The `<table>` and everything inside it, `SUPER_COLS`, `BASIC_COLS`, the `useLoadAction` and
`useMutateAction` calls and both early returns stay exactly as they are.

## 5. `src/app/pages/pto/PtoTable.tsx`: six edits, nothing else

The page asks "is this a phone?" once, here, and draws either the rows or the table, never both.
Both get the same list (`sorted`). The table (`<DataTable …>` down to `</DataTable>`) is not
edited at all.

**5a.** Directly after the line `import PtoBreakdown from './PtoBreakdown';` add:

```tsx
import PtoRows from './PtoRows';
```

**5b.** Replace

```tsx
import { sortRows, nextSortDir } from '@/app/lib/ptoSort';
```

with

```tsx
import { sortRows, nextSortDir } from '@/app/lib/ptoSort';
import { nothingFoundText } from '@/app/lib/ptoPhone';
import { useIsPhone } from '@/app/lib/useIsPhone';
```

**5c.** Directly after the line `  const { viewAs, isSuper } = useViewer();` add:

```tsx
  const isPhone = useIsPhone();
```

**5d.** Replace

```tsx
    `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors ${on ? 'border-warm bg-warm-tint text-warm-text' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`;
```

with

```tsx
    `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors phone:min-h-11 phone:px-3.5 ${on ? 'border-warm bg-warm-tint text-warm-text' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`;
```

**5e.** Replace

```tsx
      <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
```

with

```tsx
      <div className="flex flex-wrap items-center gap-2 px-6 pb-3 phone:flex-nowrap phone:overflow-x-auto phone:whitespace-nowrap phone:px-4">
```

**5f.** Replace

```tsx
      {/* Table */}
      {loading && (rawRows as RawRow[]).length === 0 ? (
```

with

```tsx
      {/* Rows on a phone, the table everywhere else: one of the two, never both */}
      {isPhone && !error ? (
        <PtoRows
          rows={sorted}
          loading={loading && (rawRows as RawRow[]).length === 0}
          emptyText={nothingFoundText({ employee, role, manager, chip: isSuper ? chip : null })}
          expanded={expanded}
          onToggle={handleToggle}
          year={year}
          today={today}
          periods={periods as PeriodRow[]}
          onOpenDialog={onOpenDialog}
          onChanged={handleChanged}
          refreshToken={detailKey}
        />
      ) : loading && (rawRows as RawRow[]).length === 0 ? (
```

Everything else in this file stays exactly as it is: both `useLoadAction` calls, `COLUMNS`, the
sorting and filtering, the two chips, and every line from `<DataTable` to `</DataTable>`.
`useIsPhone()` is called in this file only: not in `PtoRows`, `PtoRequestRows` or `PtoBreakdown`.

## 6. `src/app/pages/pto/PtoComingUp.tsx`: one edit, nothing else

While Coming Up loads it shows four grey boxes in a line, 920 px wide, which run out of the card
on a phone. Replace

```tsx
        <div className="flex gap-2" aria-hidden="true">
```

with

```tsx
        <div className="flex gap-2 phone:overflow-hidden" aria-hidden="true">
```

## Acceptance — visible facts

On a phone-sized screen (375 × 667), PTO Tracker, **as a manager** (or a super user using View As
on a manager):
1. Under Coming Up there is one row per employee, in name order, the same employees as on the
   computer. Each row shows the name (a long name wraps, it is never cut with "…"), the title
   under it, and on the right a large number with the word "Available" under it. A negative
   number is red. The second line reads like "12.36 accrued · 3.00 taken". No Review pill.
2. An employee with no start date shows "no start date" in amber under the title and "—" as the
   number.
3. Each row has a down arrow. Tapping it opens that employee in place (the arrow turns up):
   Start Date, FH Left with its explanation written under the number ("Used 1 of 2 this year ·
   August sheet said 1", or "Eligible Mon Dec 14 — 90 days after hire"), Paid PTO, WFH, Birthday,
   then "Requests": one row per request with 🌴 or ⭐, the type and "3 days", a Pending / Recorded /
   Withdrawn pill, the dates and "back Mon Aug 24". Tapping the row again closes it.
4. **A manager sees no Record, Edit, Withdraw or Restore button anywhere, and no "What Payroll
   Says" or "Evidence".**
5. The page scrolls as one page; nothing slides sideways except Coming Up.

On a phone-sized screen, **as a super user**:
6. Rows also show a yellow "N to review" pill and "N not yet" where the computer's Review column
   shows them. The strip above the list ("45 Employees", To Review, Not Yet) is on one line; the
   two chips are 44 px tall and still filter the list. With To Review on and nobody matching, the
   list says "No employees match To Review".
7. Each row has a right arrow. Tapping it opens a full-height sheet titled with the employee's
   name: Available, Accrued, Taken, the same balances as in fact 3, then the requests. Each
   request also shows What Payroll Says, Evidence, and its buttons, each 44 px tall.
8. A pending request whose return date has not passed shows Record greyed out with the reason
   written under it: "Record after the return date has passed".
9. Tap Record on a request that can be recorded: the Record PTO pop-up opens **on top of** the
   sheet. **Cancel it; save nothing.** The sheet is still open behind. The same for Edit on a
   recorded request: open, then cancel.
10. Tap Withdraw on a recorded request: the browser asks "Withdraw this record? Days will drop
    by N." **Choose Cancel.** Nothing changes.
11. The × at the top right closes the sheet. No console errors on load or after any tap.

While loading (both kinds of user):
12. Before the employees arrive, five grey placeholder rows show where the list will be. The four
    grey boxes in Coming Up stay inside its white card.

On a computer nothing changes (1440 wide, mouse):
13. The PTO Tracker shows the same table with the same columns, sorting by a click on a column
    heading, the same chips at the same size, and a row still opens the same small table of
    requests with the same buttons.

When done, reply with a one-line summary per file.
