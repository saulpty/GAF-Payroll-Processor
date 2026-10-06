# PTO Tracker: split "Requested" into clear columns; payroll columns for superusers only

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

When an employee row is opened on the PTO Tracker, the "Requested" cell mixes the leave date, the
return date and the day count, so the return date reads like a day off. New columns:

- Superuser: `Type | Dates Requested | Total Days Off | Returning On | What Payroll Says | Evidence | Status | (actions)`
- Everyone else: `Type | Dates Requested | Total Days Off | Returning On | Status`

"Dates Requested" runs from the first day off to the calendar day before the return date.

**Only these three files may change:**
- `src/app/lib/fmtDay.ts`: append two functions (below). Nothing else in the file changes.
- `src/app/pages/pto/PtoBreakdown.tsx`: whole file below.
- `src/app/pages/pto/PtoSubRow.tsx`: whole file below.

No other file may be touched (not `PtoTable.tsx`, `PtoRow.tsx`, `PtoTracker.tsx`,
`PtoVerdictCell.tsx`, `PtoPayrollCell.tsx`, any action, or `src/components/ui/*`).

## `src/app/lib/fmtDay.ts`: append at the very end of the file

```ts

/** Inverse of dayNumber (Howard Hinnant's civil_from_days): day count → "YYYY-MM-DD". */
function fromDayNumber(z: number): string {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** The calendar day before a YYYY-MM-DD date ('' when the input is not a date). */
export function dayBefore(ymd: string | null | undefined): string {
  const p = parts(ymd);
  if (!p) return '';
  return fromDayNumber(dayNumber(p[0], p[1], p[2]) - 1);
}

/**
 * The days someone is actually out: first day off → the day before they return.
 * "Mon Aug 17 → Sun Aug 23"; one date when it is a single day or the return is missing/invalid.
 */
export function fmtLeaveDates(leaveOn: string | null | undefined, returnOn: string | null | undefined, thisYear?: string): string {
  const a = String(leaveOn ?? '').slice(0, 10);
  const b = String(returnOn ?? '').slice(0, 10);
  if (!b || b <= a) return fmtDay(a, thisYear);
  return fmtRange(a, dayBefore(b), thisYear);
}
```

## `src/app/pages/pto/PtoBreakdown.tsx` (whole file)

```tsx
import { Loader2 } from 'lucide-react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/app/components/EmptyState';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import type { PtoRowData } from './PtoRow';
import type { DialogMode, PendingRequest, LedgerRow } from './RecordApprovalDialog';
import PtoSubRow, { type SubItem } from './PtoSubRow';
import loadPtoEmployeeDetailAction from '@/actions/loadPtoEmployeeDetail';
import updatePtoApprovalStatusAction from '@/actions/updatePtoApprovalStatus';
import { matchPayroll, type DayRow, type PeriodRow, type PayrollMatch } from '@/app/lib/ptoPayrollMatch';
import { defaultTotalDays } from '@/app/lib/ptoAccrual';

interface Props {
  row: PtoRowData;
  year: string;
  today: string;
  periods: PeriodRow[];
  onOpenDialog: (m: DialogMode) => void;
  onChanged: () => void;
  refreshToken: number;
}

interface DetailRow {
  pending: PendingRequest[] | string;
  ledger: LedgerRow[] | string;
  fh: {
    fh_allocated: number; fh_used: number; notes: string | null;
    start_date: string | null; pto_start_date_override: string | null;
  } | null;
  days: DayRow[] | string;
}

function parseJSON<T>(v: T | string | null | undefined, fallback: T): T {
  if (!v) return fallback;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
}

// [header, column width class]. Payroll columns and actions are superuser-only (Saul, 2026-10-06).
const SUPER_COLS: [string, string][] = [
  ['Type', 'w-28'], ['Dates Requested', 'w-64'], ['Total Days Off', 'w-32'], ['Returning On', 'w-36'],
  ['What Payroll Says', 'w-60'], ['Evidence', ''], ['Status', 'w-28'], ['', 'w-44'],
];
const BASIC_COLS: [string, string][] = [
  ['Type', 'w-28'], ['Dates Requested', 'w-64'], ['Total Days Off', 'w-32'], ['Returning On', 'w-36'],
  ['Status', 'w-36'],
];

export default function PtoBreakdown({ row, year, today, periods, onOpenDialog, onChanged, refreshToken }: Props) {
  const { bumpPtoVersion } = useGlobalFilters();
  const { viewAs, isSuper } = useViewer();
  const cols = isSuper ? SUPER_COLS : BASIC_COLS;
  const [rawDetail, loading, error, reload] = useLoadAction(
    loadPtoEmployeeDetailAction,
    null,
    { employee_id: row.employee_id, year, manager: null, daysFrom: `${Number(year) - 1}-12-01`, viewAs },
  );

  const refreshRef = useRef(refreshToken);
  useEffect(() => {
    if (refreshRef.current !== refreshToken) {
      refreshRef.current = refreshToken;
      reload();
    }
  }, [refreshToken, reload]);

  const [withdraw] = useMutateAction(updatePtoApprovalStatusAction);

  const detailArr = (rawDetail as DetailRow[] | null);
  const detail: DetailRow | null = Array.isArray(detailArr) ? (detailArr[0] ?? null) : (rawDetail as DetailRow | null);

  const pending: PendingRequest[] = parseJSON(detail?.pending, []);
  const ledger: LedgerRow[] = parseJSON(detail?.ledger, []);
  const days: DayRow[] = parseJSON(detail?.days, []);

  if (loading && !rawDetail) {
    return (
      <div className="flex items-center justify-center h-12">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-6 py-2 flex items-center gap-2 text-[12px] text-red-600">
        <span>Couldn&apos;t load details — loadPtoEmployeeDetail</span>
        <Button size="sm" variant="outline" onClick={() => reload()}>
          Retry
        </Button>
      </div>
    );
  }

  // Build unified item list (all statuses — withdrawn always shown)
  type ItemWithMatch = SubItem & { match: PayrollMatch };
  const items: ItemWithMatch[] = [];

  for (const req of pending) {
    items.push({
      kind: 'pending',
      leave_type: (req.leave_type ?? 'pto') as 'pto' | 'floating_holiday',
      leave_on: String(req.leave_on ?? '').slice(0, 10),
      return_on: String(req.return_on ?? '').slice(0, 10),
      days: Number(req.total_days) || 0,
      request: req,
      match: {} as PayrollMatch, // placeholder, filled below
    });
  }

  for (const entry of ledger) {
    const updatedAt = (entry as { updated_at?: string | null }).updated_at;
    items.push({
      kind: 'recorded',
      leave_type: (entry.leave_type ?? 'pto') as 'pto' | 'floating_holiday',
      leave_on: String(entry.leave_on ?? '').slice(0, 10),
      return_on: String(entry.return_on ?? '').slice(0, 10),
      days: Number(entry.total_days) || 0,
      status: entry.status,
      source: entry.source,
      comments: entry.gaf_comments,
      id: entry.id,
      withdrawnAt: updatedAt ?? null,
      request: entry,
      match: {} as PayrollMatch, // placeholder, filled below
    });
  }

  // Sort by leave_on descending (newest first)
  items.sort((a, b) => b.leave_on.localeCompare(a.leave_on));

  // Compute payroll match for each item
  // items are newest-first, so items[i-1] is the chronologically next request
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const stopBefore = i > 0 && items[i - 1].leave_on > item.leave_on
      ? items[i - 1].leave_on
      : null;
    item.match = matchPayroll(
      { leaveOn: item.leave_on, returnOn: item.return_on, days: item.days },
      days,
      periods,
      { leaveType: item.leave_type, today, spanDays: defaultTotalDays, stopBefore },
    );
  }

  const handleWithdraw = async (id: number, itemDays: number) => {
    const ok = window.confirm(
      `Withdraw this record? Days will drop by ${itemDays}.`
    );
    if (!ok) return;
    await withdraw({ id, status: 'withdrawn' });
    onChanged();
    bumpPtoVersion();
  };

  const handleRestore = async (id: number) => {
    await withdraw({ id, status: 'recorded' });
    onChanged();
    bumpPtoVersion();
  };

  return (
    <div className="px-6 py-3">
      {items.length === 0 ? (
        <EmptyState title="Nothing Recorded or Pending" compact />
      ) : (
        <table className={`table-fixed border-collapse text-left w-auto ${isSuper ? 'min-w-[1180px]' : 'min-w-[680px]'}`}>
          <colgroup>
            {cols.map(([h, w], i) => <col key={`${h}-${i}`} className={w || undefined} />)}
          </colgroup>
          <thead>
            <tr>
              {cols.map(([h], i) => (
                <th
                  key={`${h}-${i}`}
                  className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-200 bg-transparent whitespace-nowrap"
                >
                  {h}
                  {i === cols.length - 1 && loading && (
                    <Loader2 className="w-3 h-3 ml-1 animate-spin text-slate-300 inline" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <PtoSubRow
                key={item.kind === 'pending'
                  ? `p-${item.request?.monday_item_id ?? i}`
                  : `r-${item.id}`}
                item={item}
                today={today}
                onOpenDialog={onOpenDialog}
                onWithdraw={handleWithdraw}
                onRestore={handleRestore}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

## `src/app/pages/pto/PtoSubRow.tsx` (whole file)

```tsx
import { Plus, Pencil, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useViewer } from '@/app/context/ViewerContext';
import StatusChip from '@/app/components/StatusChip';
import { fmtDay, fmtLeaveDates } from '@/app/lib/fmtDay';
import { defaultTotalDays } from '@/app/lib/ptoAccrual';
import { recordability } from '@/app/lib/ptoPayrollMatch';
import type { DialogMode } from './RecordApprovalDialog';
import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch';
import PtoPayrollCell from './PtoPayrollCell';
import PtoVerdictCell from './PtoVerdictCell';

export interface SubItem {
  kind: 'pending' | 'recorded';
  leave_type: 'pto' | 'floating_holiday';
  leave_on: string;
  return_on: string;
  days: number;
  status?: string;
  source?: string;
  comments?: string | null;
  id?: number;
  withdrawnAt?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request?: any;
}

interface Props {
  item: SubItem & { match: PayrollMatch };
  today: string;
  onOpenDialog: (m: DialogMode) => void;
  onWithdraw: (id: number, days: number) => void;
  onRestore: (id: number) => void;
}

const muted = <span className="text-slate-300">—</span>;

export default function PtoSubRow({ item, today, onOpenDialog, onWithdraw, onRestore }: Props) {
  const { isSuper } = useViewer();
  const withdrawn = item.kind === 'recorded' && item.status === 'withdrawn';
  const thisYear = today.slice(0, 4);

  const dimmed = withdrawn ? 'opacity-60' : '';

  const rec = recordability(item.match, item.return_on, today, defaultTotalDays);

  const sourceNote = item.kind === 'pending' ? 'from Monday board'
    : item.source === 'excel_import' ? 'from Excel'
    : item.source === 'manual' ? 'added manually'
    : '';

  return (
    <tr className="border-t border-slate-100">
      {/* Type */}
      <td className={`px-3 py-2 align-top ${dimmed}`}>
        <span className="text-[12px] text-slate-600 whitespace-nowrap">
          {item.leave_type === 'floating_holiday' ? 'Floating holiday' : 'PTO'}
        </span>
      </td>

      {/* Dates Requested: first day off → day before return */}
      <td
        className={`px-3 py-2 align-top ${dimmed}`}
        title={item.comments ?? undefined}
      >
        <div className="text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
          {fmtLeaveDates(item.leave_on, item.return_on, thisYear)}
        </div>
        {item.match.invalidDates && (
          <div className="mt-1">
            <StatusChip tone="red" icon={<AlertCircle className="w-3 h-3" />}>Return is before leave — fix on Monday</StatusChip>
          </div>
        )}
      </td>

      {/* Total Days Off */}
      <td className={`px-3 py-2 align-top ${dimmed}`}>
        <div className="text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
          {item.days} {item.days === 1 ? 'day' : 'days'}
        </div>
        {isSuper && sourceNote && (
          <div className="text-[11px] text-slate-400 whitespace-nowrap">{sourceNote}</div>
        )}
      </td>

      {/* Returning On */}
      <td className={`px-3 py-2 align-top ${dimmed}`}>
        <span className="text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
          {item.return_on ? fmtDay(item.return_on, thisYear) : muted}
        </span>
      </td>

      {/* What Payroll Says + Evidence: superusers only */}
      {isSuper && (
        <>
          <td className="px-3 py-2 align-top">
            <PtoVerdictCell
              match={item.match}
              leaveType={item.leave_type}
              requestDays={item.days}
              leaveOn={item.leave_on}
              thisYear={thisYear}
              today={today}
            />
          </td>
          <td className="px-3 py-2 align-top text-[12px]">
            <PtoPayrollCell match={item.match} thisYear={thisYear} />
          </td>
        </>
      )}

      {/* Status */}
      <td className="px-3 py-2 align-top">
        {item.kind === 'pending'
          ? <StatusChip tone="amber">Pending</StatusChip>
          : withdrawn
            ? (
              <div>
                <StatusChip tone="red" strike>Withdrawn</StatusChip>
                {item.withdrawnAt && (
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    withdrawn {fmtDay(item.withdrawnAt, thisYear)}
                  </div>
                )}
              </div>
            )
            : <StatusChip tone="green">Recorded</StatusChip>}
      </td>

      {/* Actions: superusers only */}
      {isSuper && (
        <td className="px-3 py-2 align-top text-right whitespace-nowrap">
          {withdrawn && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRestore(item.id!)}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Restore
            </Button>
          )}
          {item.kind === 'pending' && (
            <div>
              <Button
                size="sm"
                onClick={() => onOpenDialog({ kind: 'record', request: item.request, match: item.match })}
                disabled={!rec.ok}
                title={
                  rec.reason === 'future' ? 'Record after the return date has passed'
                  : rec.reason === 'not_processed' ? 'Payroll for these dates has not been processed yet'
                  : rec.reason === 'invalid' ? "Return date is before the leave date — fix the Monday request"
                  : undefined
                }
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Record
              </Button>
              {rec.reason === 'not_processed' && (
                <div className="text-[11px] text-slate-400 mt-0.5">after payroll runs</div>
              )}
              {rec.reason === 'invalid' && (
                <div className="text-[11px] text-slate-400 mt-0.5">dates don&apos;t make sense</div>
              )}
            </div>
          )}
          {item.kind === 'recorded' && !withdrawn && (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenDialog({ kind: 'edit', row: item.request, match: item.match })}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
              {item.status === 'recorded' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => onWithdraw(item.id!, item.days)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Withdraw
                </Button>
              )}
            </div>
          )}
        </td>
      )}
    </tr>
  );
}
```

## Report
- Byte size of the three files; confirm no other file changed and the PTO Tracker opens an
  employee with no console errors.
