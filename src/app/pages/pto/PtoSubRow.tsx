import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusChip from '@/app/components/StatusChip';
import { fmtRange, fmtDay } from '@/app/lib/fmtDay';
import { defaultTotalDays } from '@/app/lib/ptoAccrual';
import type { DialogMode } from './RecordApprovalDialog';
import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch';
import PtoPayrollCell from './PtoPayrollCell';

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

  // Pending: record disabled before return_on
  const returnPassed = item.return_on <= today;
  const daysUntilReturn = returnPassed ? 0 : defaultTotalDays(today, item.return_on);

  return (
    <tr className="border-t border-slate-100">
      {/* Type */}
      <td className={`px-3 py-2 ${dimmed}`}>
        {item.leave_type === 'floating_holiday'
          ? <StatusChip tone="violet">Floating holiday</StatusChip>
          : <StatusChip tone="blue">PTO</StatusChip>}
      </td>

      {/* Dates */}
      <td
        className={`px-3 py-2 text-[13px] text-slate-700 whitespace-nowrap tabular-nums ${dimmed}`}
        title={item.comments ?? undefined}
      >
        {fmtRange(item.leave_on, item.return_on, thisYear)}
      </td>

      {/* Days */}
      <td className={`px-3 py-2 text-right tabular-nums text-[13px] text-slate-700 ${dimmed}`}>
        {item.days}
      </td>

      {/* Status */}
      <td className="px-3 py-2">
        {item.kind === 'pending'
          ? <StatusChip tone="amber">Pending</StatusChip>
          : withdrawn
            ? (
              <div>
                <StatusChip tone="red" strike>Withdrawn</StatusChip>
                {item.withdrawnAt && (
                  <div className="text-[11px] text-slate-400">
                    withdrawn {fmtDay(item.withdrawnAt, thisYear)}
                  </div>
                )}
              </div>
            )
            : <StatusChip tone="green">Recorded</StatusChip>}
      </td>

      {/* Source */}
      <td className="px-3 py-2 text-[12px] text-slate-400 whitespace-nowrap">
        {item.kind === 'pending' ? 'Monday' : sourceLabel(item.source)}
      </td>

      {/* In payroll */}
      <td className="px-3 py-2 text-[12px] max-w-[260px]">
        <PtoPayrollCell
          match={item.match}
          leaveType={item.leave_type}
          thisYear={thisYear}
          requestDays={item.days}
          leaveOn={item.leave_on}
        />
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
              onClick={() => onOpenDialog({ kind: 'record', request: item.request })}
              disabled={!returnPassed}
              title={!returnPassed ? 'Record after the return date has passed' : undefined}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Record
            </Button>
            {!returnPassed && (
              <div className="text-[11px] text-slate-400 mt-0.5">
                in {daysUntilReturn} {daysUntilReturn === 1 ? 'day' : 'days'}
              </div>
            )}
          </div>
        )}
        {item.kind === 'recorded' && !withdrawn && (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenDialog({ kind: 'edit', row: item.request })}
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
