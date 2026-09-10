import { Plus, Pencil, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusChip from '@/app/components/StatusChip';
import { fmtRange, fmtDay } from '@/app/lib/fmtDay';
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

function sourceLabel(src: string | undefined): string {
  if (!src) return '';
  if (src === 'monday') return 'Monday';
  if (src === 'excel_import') return 'Excel';
  if (src === 'manual') return 'Manual';
  return src;
}

export default function PtoSubRow({ item, today, onOpenDialog, onWithdraw, onRestore }: Props) {
  const withdrawn = item.kind === 'recorded' && item.status === 'withdrawn';
  const thisYear = today.slice(0, 4);

  const dimmed = withdrawn ? 'opacity-60' : '';

  const rec = recordability(item.match, item.return_on, today, defaultTotalDays);

  return (
    <tr className="border-t border-slate-100">
      {/* Type */}
      <td className={`px-3 py-2 align-top ${dimmed}`}>
        {item.leave_type === 'floating_holiday'
          ? <StatusChip tone="violet">Floating holiday</StatusChip>
          : <StatusChip tone="blue">PTO</StatusChip>}
        <div className="mt-1">
          {item.kind === 'pending'
            ? <StatusChip tone="amber">Pending</StatusChip>
            : withdrawn
              ? <StatusChip tone="red" strike>Withdrawn</StatusChip>
              : <StatusChip tone="green">Recorded</StatusChip>}
        </div>
      </td>

      {/* Requested */}
      <td
        className={`px-3 py-2 align-top ${dimmed}`}
        title={item.comments ?? undefined}
      >
        <div className="text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
          {fmtRange(item.leave_on, item.return_on, thisYear)}
        </div>
        <div className="text-[11px] text-slate-400">
          {item.days} {item.days === 1 ? 'day' : 'days'} · {sourceLabel(item.source) || 'Monday'}
        </div>
        {withdrawn && item.withdrawnAt && (
          <div className="text-[11px] text-slate-400">
            withdrawn {fmtDay(item.withdrawnAt, thisYear)}
          </div>
        )}
        {item.match.invalidDates && (
          <div className="mt-1">
            <StatusChip tone="red" icon={<AlertCircle className="w-3 h-3" />}>Return is before leave — fix on Monday</StatusChip>
          </div>
        )}
      </td>

      {/* Verdict */}
      <td className="px-3 py-2 align-top">
        <PtoVerdictCell
          match={item.match}
          leaveType={item.leave_type}
          requestDays={item.days}
          leaveOn={item.leave_on}
          thisYear={thisYear}
        />
      </td>

      {/* Payroll */}
      <td className="px-3 py-2 align-top text-[12px]">
        <PtoPayrollCell match={item.match} thisYear={thisYear} />
      </td>

      {/* Actions */}
      <td className="px-3 py-2 text-right whitespace-nowrap">
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
            {rec.reason === 'future' && (
              <div className="text-[11px] text-slate-400 mt-0.5">in {rec.daysUntil} day(s)</div>
            )}
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
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                onClick={() => onWithdraw(item.id!, item.days)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Withdraw
              </Button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
