import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusChip from '@/app/components/StatusChip';
import { fmtDate } from '@/app/lib/fmtDate';
import type { DialogMode } from './RecordApprovalDialog';

export interface SubItem {
  kind: 'pending' | 'recorded';
  leave_type: 'pto' | 'floating_holiday';
  leave_on: string;
  return_on: string;
  days: number;
  status?: string;
  source?: string;
  comments?: string | null;
  payroll?: string | null;
  id?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request?: any; // PendingRequest — avoided circular import
}

interface Props {
  item: SubItem;
  onOpenDialog: (m: DialogMode) => void;
  onWithdraw: (id: number, days: number) => void;
}

function sourceLabel(src: string | undefined): string {
  if (!src) return '';
  if (src === 'monday') return 'Monday';
  if (src === 'excel_import') return 'Excel';
  if (src === 'manual') return 'Manual';
  return src;
}

export default function PtoSubRow({ item, onOpenDialog, onWithdraw }: Props) {
  const withdrawn = item.kind === 'recorded' && item.status === 'withdrawn';

  return (
    <tr className="border-t border-slate-100">
      {/* Type */}
      <td className="px-3 py-2">
        {item.leave_type === 'floating_holiday'
          ? <StatusChip tone="violet">Floating holiday</StatusChip>
          : <StatusChip tone="blue">PTO</StatusChip>}
      </td>

      {/* Dates */}
      <td className="px-3 py-2 text-[13px] text-slate-700 whitespace-nowrap tabular-nums">
        {fmtDate(item.leave_on)} → {fmtDate(item.return_on)}
      </td>

      {/* Days */}
      <td className="px-3 py-2 text-right tabular-nums text-[13px] text-slate-700">
        {item.days}
      </td>

      {/* Status */}
      <td className="px-3 py-2">
        {item.kind === 'pending'
          ? <StatusChip tone="amber">Pending</StatusChip>
          : withdrawn
            ? <StatusChip tone="red" strike>Withdrawn</StatusChip>
            : <StatusChip tone="green">Recorded</StatusChip>}
      </td>

      {/* Source */}
      <td className="px-3 py-2 text-[12px] text-slate-400 whitespace-nowrap">
        {item.kind === 'pending' ? 'Monday' : sourceLabel(item.source)}
      </td>

      {/* In payroll */}
      <td className="px-3 py-2 text-[12px] max-w-[180px] truncate">
        {item.payroll
          ? <span className="text-slate-600" title={item.payroll}>{item.payroll}</span>
          : <span className="text-slate-300">not in payroll yet</span>}
      </td>

      {/* Comments */}
      <td className="px-3 py-2 text-[12px] text-slate-400 max-w-[160px] truncate">
        {item.comments
          ? <span title={item.comments}>{item.comments}</span>
          : null}
      </td>

      {/* Actions */}
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {item.kind === 'pending' && (
          <Button
            size="sm"
            onClick={() => onOpenDialog({ kind: 'record', request: item.request })}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Record
          </Button>
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
