import { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { LedgerRow, DialogMode } from './RecordApprovalDialog';
import updatePtoApprovalStatusAction from '@/actions/updatePtoApprovalStatus';

const STATUS_CFG: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock        },
  recorded:  { label: 'Recorded',  cls: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  withdrawn: { label: 'Withdrawn', cls: 'bg-slate-100 text-slate-500 border-slate-200', icon: XCircle      },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG['pending'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

interface Props {
  row: LedgerRow;
  onEdit: (mode: DialogMode) => void;
  onRefresh: () => void;
}

export default function ApprovalRow({ row, onEdit, onRefresh }: Props) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [updateStatus] = useMutateAction(updatePtoApprovalStatusAction);

  async function handleWithdraw() {
    if (!window.confirm(`Withdraw this approval for ${row.display_name ?? 'this employee'}? Their PTO balance will reflect the change.`)) return;
    setWithdrawing(true);
    try {
      await updateStatus({ id: row.id, status: 'withdrawn' });
      onRefresh();
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="py-2 px-3 font-medium text-slate-800">{row.display_name ?? '—'}</td>
      <td className="py-2 px-3 text-slate-600">{(row.leave_on ?? '').slice(0, 10)}</td>
      <td className="py-2 px-3 text-slate-600">{(row.return_on ?? '').slice(0, 10)}</td>
      <td className="py-2 px-3 text-right text-slate-700">{row.total_days ?? '—'}</td>
      <td className="py-2 px-3"><StatusBadge status={row.status} /></td>
      <td className="py-2 px-3 text-slate-500 capitalize">{row.source}</td>
      <td className="py-2 px-3 text-slate-500">{row.recorded_by ?? '—'}</td>
      <td className="py-2 px-3 text-slate-400 max-w-[120px] truncate">{row.gaf_comments ?? ''}</td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs"
            onClick={() => onEdit({ kind: 'edit', row })}>
            <Pencil className="w-3 h-3 mr-0.5" />
            Edit
          </Button>
          {row.status === 'recorded' && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-red-600 hover:text-red-700"
              disabled={withdrawing}
              onClick={handleWithdraw}>
              <Trash2 className="w-3 h-3 mr-0.5" />
              Withdraw
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
