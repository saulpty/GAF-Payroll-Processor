# Phone view, rows 3b: PTO Tracker, part 2 of 3 (the request list and the phone rows)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the PTO Tracker is an eleven-column table you slide sideways, and the things a
mouse-over explains (how the floating holidays were counted, why Record is switched off, the GAF
comments on a request) cannot be read at all. This prompt gives a phone one row per employee
instead: the name, the title, and **Available** as the one large number. A manager taps a row and
it opens in place to read the rest. A super user taps a row and it opens a sheet that also has
What Payroll Says, the evidence and the Record / Edit / Withdraw / Restore buttons. On a computer
nothing changes.

**This is part 2 of 3.** Part 1 already added `src/app/lib/ptoPhone.ts` and `src/app/pages/pto/PtoRequestRows.tsx`: use them as they are and do not edit them. This part edits `PtoBreakdown.tsx` and adds `PtoRows.tsx`, which nothing renders yet, so nothing on any screen changes after this part. Part 3 follows. Write everything exactly as given: do not adapt or shorten it.

If `src/app/pages/pto/PtoRequestRows.tsx` or `src/app/lib/ptoPhone.ts` does not exist, stop and say so. Do not write them.

**Only these files may change.** One new: `src/app/pages/pto/PtoRows.tsx`. One edited: `src/app/pages/pto/PtoBreakdown.tsx`. **No other file may be touched.** No migration, no action file.

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


## Acceptance

1. `PtoRows.tsx` exists with exactly the content above, and `PtoBreakdown.tsx` has exactly the five edits.
2. On a computer, PTO Tracker: opening an employee still shows the same small table of requests with the same buttons.
3. No console errors.

When done, reply with a one-line summary per file.
