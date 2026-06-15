import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { History, Loader2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import loadPeriodsAction from '@/actions/loadPeriods';
import deletePeriodAction from '@/actions/deletePeriod';
import deletePeriodEntriesAction from '@/actions/deletePeriodEntries';
import deletePeriodSnapshotsAction from '@/actions/deletePeriodSnapshots';

type Period = {
  period_name: string; start_date: string; end_date: string;
  processed_at: string; employee_count: number; day_count: number;
  green_count: number; yellow_count: number; red_count: number; notes: string;
};

export default function PeriodLog() {
  const [periods, loading, , refetch] = useLoadAction(loadPeriodsAction, [] as Period[]);
  const [deletePeriod, deleting] = useMutateAction(deletePeriodAction);
  const [deletePeriodEntries] = useMutateAction(deletePeriodEntriesAction);
  const [deletePeriodSnapshots] = useMutateAction(deletePeriodSnapshotsAction);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleDelete = async (e: React.MouseEvent, periodName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Delete period "${periodName}" and ALL its payroll entries? This cannot be undone.`)) return;
    setDeletingName(periodName);
    try {
      await deletePeriodEntries({ periodName });
      await deletePeriodSnapshots({ periodName });
      await deletePeriod({ periodName });
      refetch();
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <History className="w-7 h-7 text-slate-600" />
        <h1 className="text-2xl font-bold">Period Log</h1>
        <span className="text-sm text-muted-foreground">({(periods as Period[]).length} periods)</span>
      </div>

      {loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}

      {!loading && (
        <div className="rounded-lg border overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                {['Period', 'Date Range', 'Processed', 'Employees', 'Days', 'GREEN', 'YELLOW', 'RED', 'Notes', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold border-b border-r last:border-r-0 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(periods as Period[]).map(p => (
                <tr
                  key={p.period_name}
                  className="border-b hover:bg-blue-50 cursor-pointer"
                  onClick={() => navigate(`/payroll-master?period=${encodeURIComponent(p.period_name)}`)}
                  title="Click to view in Payroll Master"
                >
                  <td className="px-3 py-2 border-r font-semibold text-blue-700">{p.period_name}</td>
                  <td className="px-3 py-2 border-r font-mono text-xs whitespace-nowrap">
                    {p.start_date?.slice(0,10)} → {p.end_date?.slice(0,10)}
                  </td>
                  <td className="px-3 py-2 border-r text-xs text-muted-foreground whitespace-nowrap">{p.processed_at?.slice(0,16)}</td>
                  <td className="px-3 py-2 border-r text-center">{p.employee_count}</td>
                  <td className="px-3 py-2 border-r text-center">{p.day_count}</td>
                  <td className="px-3 py-2 border-r text-center font-semibold text-green-700 bg-[#C6EFCE]">{p.green_count}</td>
                  <td className="px-3 py-2 border-r text-center font-semibold text-yellow-700 bg-[#FFEB9C]">{p.yellow_count}</td>
                  <td className="px-3 py-2 border-r text-center font-semibold text-red-700 bg-[#FFC7CE]">{p.red_count}</td>
                  <td className="px-3 py-2 border-r text-xs text-muted-foreground">{p.notes}</td>
                  <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <button
                      className="p-1 rounded hover:bg-red-100 text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                      title="Delete period"
                      disabled={deleting || deletingName === p.period_name}
                      onClick={e => handleDelete(e, p.period_name)}
                    >
                      {deletingName === p.period_name
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
              {(periods as Period[]).length === 0 && (
                <tr><td colSpan={10} className="text-center py-8 text-muted-foreground text-sm">No periods processed yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
