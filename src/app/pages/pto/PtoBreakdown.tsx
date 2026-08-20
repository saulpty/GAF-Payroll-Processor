import { Loader2 } from 'lucide-react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import EmptyState from '@/app/components/EmptyState';
import type { PtoRowData } from './PtoRow';
import type { DialogMode, PendingRequest, LedgerRow } from './RecordApprovalDialog';
import PtoSubRow, { type SubItem } from './PtoSubRow';
import loadPtoEmployeeDetailAction from '@/actions/loadPtoEmployeeDetail';
import updatePtoApprovalStatusAction from '@/actions/updatePtoApprovalStatus';

interface Props {
  row: PtoRowData;
  year: string;
  showWithdrawn: boolean;
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
}

function parseJSON<T>(v: T | string | null | undefined, fallback: T): T {
  if (!v) return fallback;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
}

const HEADERS = ['Type', 'Dates', 'Days', 'Status', 'Source', 'In payroll', 'Comments', ''];

export default function PtoBreakdown({ row, year, showWithdrawn, onOpenDialog, onChanged }: Props) {
  const [rawDetail, loading, error, reload] = useLoadAction(
    loadPtoEmployeeDetailAction,
    null,
    { employee_id: row.employee_id, year, manager: null },
  );

  const [withdraw] = useMutateAction(updatePtoApprovalStatusAction);

  const detailArr = (rawDetail as DetailRow[] | null);
  const detail: DetailRow | null = Array.isArray(detailArr) ? (detailArr[0] ?? null) : (rawDetail as DetailRow | null);

  const pending: PendingRequest[] = parseJSON(detail?.pending, []);
  const ledger: LedgerRow[] = parseJSON(detail?.ledger, []);

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

  // Build unified item list
  const items: SubItem[] = [];

  for (const req of pending) {
    items.push({
      kind: 'pending',
      leave_type: (req.leave_type ?? 'pto') as 'pto' | 'floating_holiday',
      leave_on: String(req.leave_on ?? '').slice(0, 10),
      return_on: String(req.return_on ?? '').slice(0, 10),
      days: Number(req.total_days) || 0,
      payroll: (req as { payroll?: string | null }).payroll ?? null,
      request: req,
    });
  }

  for (const entry of ledger) {
    if (!showWithdrawn && entry.status === 'withdrawn') continue;
    items.push({
      kind: 'recorded',
      leave_type: (entry.leave_type ?? 'pto') as 'pto' | 'floating_holiday',
      leave_on: String(entry.leave_on ?? '').slice(0, 10),
      return_on: String(entry.return_on ?? '').slice(0, 10),
      days: Number(entry.total_days) || 0,
      status: entry.status,
      source: entry.source,
      comments: entry.gaf_comments,
      payroll: (entry as { payroll?: string | null }).payroll ?? null,
      id: entry.id,
      request: entry, // passed to edit dialog
    });
  }

  // Sort by leave_on descending (plain string compare, YYYY-MM-DD)
  items.sort((a, b) => b.leave_on.localeCompare(a.leave_on));

  const handleWithdraw = async (id: number, days: number) => {
    const ok = window.confirm(
      `Withdraw this record? Days will drop by ${days}.`
    );
    if (!ok) return;
    await withdraw({ id, status: 'withdrawn' });
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
                onOpenDialog={onOpenDialog}
                onWithdraw={handleWithdraw}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
