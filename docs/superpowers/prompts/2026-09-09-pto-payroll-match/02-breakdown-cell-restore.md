# 02 — "In payroll" column, Restore for withdrawn rows, Record only after the return

Prompt 01 added `days` (payroll rows per employee) and the pure modules
`src/app/lib/ptoPayrollMatch.ts` and `src/app/lib/fmtDay.ts`. This prompt wires
them into the PTO breakdown. **Do not modify either module.**

## Files you may change

- `src/app/pages/PtoTracker.tsx`
- `src/app/pages/pto/PtoTable.tsx`
- `src/app/pages/pto/PtoRow.tsx`
- `src/app/pages/pto/PtoBreakdown.tsx`
- `src/app/pages/pto/PtoSubRow.tsx`
- `src/app/pages/pto/PtoPayrollCell.tsx` — **new**
- `src/actions/loadPtoEmployeeDetail.ts`

**No other file.** Not `RecordApprovalDialog.tsx` (next prompt), not
`ptoAccrual.ts`, not `fmtDate.ts`, not anything under `src/components/ui`.
Every file stays under 15 KB. camelCase identifiers only (H4 guard). Params to
`useLoadAction` go flat — never `{ params: {...} }`. No `toISOString()`.

---

## 1. `loadPtoEmployeeDetail.ts`

- Delete the two `'payroll', (...)` string subqueries (in `pending` and in
  `ledger`). The `days` array replaces them.
- In the `ledger` object add `'updated_at', a.updated_at::text` (used to show
  when a row was withdrawn).

## 2. `PtoTracker.tsx`

`const today = toLocalYMD(new Date());` (already imported). Pass `today` to
`<PtoTable>`. Nothing else changes here.

## 3. `PtoTable.tsx`

- Remove the `showWithdrawn` state, its checkbox and the prop it passed down.
  Withdrawn rows are always shown now (dimmed — see §5).
- Load periods once: `useLoadAction(loadPeriodsAction, [] as PeriodRow[])`
  (`import loadPeriodsAction from '@/actions/loadPeriods'`, `PeriodRow` is
  exported by `ptoPayrollMatch.ts`; the action takes no params). Pass
  `periods` and `today` to `<PtoBreakdown>`.
- `RawRow` gains `fh_sheet_used: number | string` (new column from prompt 01);
  it flows through `derived` into `PtoRowData` untouched.
- FH left column tip becomes: `'2 per calendar year, non-stacking, eligible 90
  days after hire. Counts days, not records. Hover a value for the breakdown.'`

## 4. `PtoRow.tsx`

- `PtoRowData` gains `fh_sheet_used: number | string`.
- Start column: `fmtDay(row.start, thisYear)` instead of `fmtDate`, where
  `thisYear` is a new prop (`today.slice(0, 4)` passed from `PtoTable`). Drop
  the `fmtDate` import if nothing else uses it (the eligibility tooltip may keep
  it, or switch it to `fmtDay` too — either is fine).
- FH left cell (the non-zero branch and the zero-because-used branch): add
  `title={`Used ${fh_used} of ${fh_allocated} this year · August sheet said
  ${fh_sheet_used}`}`. Keep the existing "eligible from" tooltip for the
  not-yet-eligible case.

## 5. `PtoBreakdown.tsx`

Props: drop `showWithdrawn`; add `today: string` and `periods: PeriodRow[]`.

- `DetailRow` gains `days: DayRow[] | string`; parse it with the existing
  `parseJSON`.
- `LedgerRow` (from the dialog file — do **not** edit that file) has no
  `updated_at`; read it as `(entry as { updated_at?: string | null }).updated_at`.
- Build `items` as today (pending + ledger, **all** statuses), sort by
  `leave_on` descending. Then, for each item, compute the payroll match:

  ```ts
  // items are newest-first, so the chronologically next request is items[i-1]
  const stopBefore = i > 0 && items[i - 1].leave_on > item.leave_on ? items[i - 1].leave_on : null;
  item.match = matchPayroll(
    { leaveOn: item.leave_on, returnOn: item.return_on, days: item.days },
    days, periods,
    { leaveType: item.leave_type, today, spanDays: defaultTotalDays, stopBefore },
  );
  ```
  `defaultTotalDays` comes from `@/app/lib/ptoAccrual`.
- `SubItem` (in `PtoSubRow.tsx`) gains `match: PayrollMatch` and
  `withdrawnAt?: string | null`; drop `payroll` and keep `comments`.
- New handler `handleRestore(id)` → `await withdraw({ id, status: 'recorded' })`
  then `onChanged()` — same `updatePtoApprovalStatus` mutation, no confirm
  dialog needed. Pass it to `PtoSubRow` as `onRestore`.
- `HEADERS = ['Type', 'Dates', 'Days', 'Status', 'Source', 'In payroll', '']`.
- Pass `today` to each `<PtoSubRow>`.

## 6. `PtoSubRow.tsx`

Props gain `today: string` and `onRestore: (id: number) => void`.
`const thisYear = today.slice(0, 4);`

- **Dates cell**: `fmtRange(item.leave_on, item.return_on, thisYear)` from
  `@/app/lib/fmtDay`. Put `item.comments` on the cell's `title` when present.
  Remove the `fmtDate` import.
- **In payroll cell**: `<td className="px-3 py-2 text-[12px] max-w-[260px]"><PtoPayrollCell match={item.match} leaveType={item.leave_type} thisYear={thisYear} /></td>`.
- **Comments cell**: delete it (7 cells per row now, matching the headers).
- **Withdrawn rows** (`item.status === 'withdrawn'`): add `opacity-60` to the
  Type, Dates and Days cells; keep the struck red "Withdrawn" chip and, under
  it, `<div className="text-[11px] text-slate-400">withdrawn {fmtDay(item.withdrawnAt, thisYear)}</div>`
  when `withdrawnAt` is set. Actions cell shows a single outline button
  `Restore` (lucide `RotateCcw`, `w-3.5 h-3.5 mr-1`) calling `onRestore(item.id!)`.
  No Edit, no Withdraw.
- **Pending rows**: the Record button is disabled while `item.return_on > today`.
  Under it render `<div className="text-[11px] text-slate-400">in {n} days</div>`
  with `n = defaultTotalDays(today, item.return_on)` (import from
  `@/app/lib/ptoAccrual`) and give the button
  `title="Record after the return date has passed"`. When `return_on <= today`
  the button is enabled exactly as today.
- Recorded rows: unchanged (Edit + Withdraw).

## 7. `PtoPayrollCell.tsx` — new

```ts
import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch';
import { fmtDay } from '@/app/lib/fmtDay';
interface Props { match: PayrollMatch; leaveType: 'pto' | 'floating_holiday'; thisYear: string }
```

Renders two short lines. `cycles` render in `font-mono text-[11px] text-slate-500`;
`byType` renders as `PTO ×3, Feriado ×1` (`label ×count`, comma-joined) in
`text-slate-600`. The full `byType` list is also the `title` of the wrapper div.

| `match.state` | Line 1 | Line 2 |
|---|---|---|
| `future` | `Future` in `text-slate-400` (lucide `Clock` 3.5) | — |
| `not_processed` | `Not processed yet` in `text-amber-600` (lucide `Hourglass`) | `payroll runs through {fmtDay(dataThrough, thisYear)}` in `text-slate-400`; omit when `dataThrough` is null |
| `no_rows` | `No payroll rows` in `text-slate-400` | — |
| `worked` | `Worked these days` in `text-amber-600` (lucide `AlertTriangle`) | cycles · byType |
| `partial` | cycles · byType | `Return not in payroll yet` in `text-slate-400`; when `dataThrough` add ` · runs through {fmtDay(dataThrough)}` |
| `matched`, `firstOff === null` | cycles · byType | `No {leaveType === 'floating_holiday' ? 'floating holiday' : 'PTO'} day in payroll` in `text-amber-600` with `AlertTriangle` |
| `matched`, `actualReturn === null` | cycles · byType | `Off {fmtDay(firstOff)} · return not in payroll` in `text-amber-600` with `AlertTriangle` |
| `matched`, no mismatch | cycles · byType | `Back {fmtDay(actualReturn)} · {actualDays} {actualDays === 1 ? 'day' : 'days'}` in `text-slate-600` followed by a lucide `Check` `w-3.5 h-3.5 text-emerald-600 inline` |
| `matched`, mismatch | cycles · byType | `Back {fmtDay(actualReturn)} · ` then in `text-amber-600` with `AlertTriangle`: `{actualDays} days, not {requestDays}` — and when `firstOff !== leaveOn` prefix `started {fmtDay(firstOff)} · ` |

For the last row the cell needs the request's days and leave date: pass them
as props `requestDays: number` and `leaveOn: string` (add them to the
`<PtoPayrollCell>` call in §6).

---

## Verify (I will do this in the browser; make sure it holds)

1. The "Show withdrawn" checkbox is gone; "Only with pending" remains.
2. Expanding Domingo Cruz: the recorded 06-01 → 06-03 row reads
   `Mon Jun 1 → Wed Jun 3`, and its In-payroll cell names the cycle, `PTO ×2`,
   `Back Wed Jun 3 · 2 days` with a green check.
3. His 12-07 → 12-11 pending row: Record disabled, `in N days` under it,
   In-payroll `Future`.
4. Any employee with a withdrawn row: dimmed, struck chip, `withdrawn <date>`,
   a Restore button; clicking Restore turns it Recorded and Taken rises.
5. Start column shows `Tue Jun 16, 2025` style dates.
6. No console errors; `grep -rn "{ params:" src/app` is empty.

## Acceptance

Only the seven files above changed; all under 15 KB; the full test suite is
still green.
