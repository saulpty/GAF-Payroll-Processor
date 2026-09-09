import { Loader2 } from 'lucide-react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import EmptyState from '@/app/components/EmptyState';
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
  detailKey: number;
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

const HEADERS = ['Type', 'Dates', 'Days', 'Status', 'Source', 'In payroll', ''];

export default function PtoBreakdown({ row, year, today, periods, onOpenDialog, onChanged }: Props) {
  const [rawDetail, loading, error, reload] = useLoadAction(
    loadPtoEmployeeDetailAction,
    null,
    { employee_id: row.employee_id, year, manager: null, daysFrom: `${Number(year) - 1}-12-01` },
  );

  const [withdraw] = useMutateAction(updatePtoApprovalStatusAction);

  const detailArr = (rawDetail as DetailRow[] | null);
  const detail: DetailRow | null = Array.isArray(detailArr) ? (detailArr[0] ?? null) : (rawDetail as DetailRow | null);

  const pending: PendingRequest[] = parseJSON(detail?.pending, []);
  const ledger: LedgerRow[] = parseJSON(detail?.ledger, []);
  const days: DayRow[] = parseJSON(detail?.days, []);

  if (loading) {
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
  };

  const handleRestore = async (id: number) => {
    await withdraw({ id, status: 'recorded' });
    onChanged();
  };

  return (
    <div className="px-6 py-3">
      {items.length === 0 ? (
        <EmptyState title="Nothing recorded or pending" compact />
      ) : (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              {HEADERS.map(h => (
                <th
                  key={h}
                  className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-200 bg-transparent"
                >
                  {h}
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
