import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { History, Loader2, Trash2, ArrowRight, AlertCircle } from 'lucide-react';
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

  const [confirmPeriod, setConfirmPeriod] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, periodName: string) => {
    e.stopPropagation();
    setConfirmPeriod(periodName);
  };

  const confirmDelete = async () => {
    if (!confirmPeriod) return;
    setDeletingName(confirmPeriod);
    setConfirmPeriod(null);
    try {
      await deletePeriodEntries({ periodName: confirmPeriod });
      await deletePeriodSnapshots({ periodName: confirmPeriod });
      await deletePeriod({ periodName: confirmPeriod });
      refetch();
    } finally {
      setDeletingName(null);
    }
  };

  const allPeriods = periods as Period[];
  const totals = allPeriods.reduce(
    (acc, p) => ({
      employees: acc.employees + (p.employee_count || 0),
      days: acc.days + (p.day_count || 0),
      green: acc.green + (p.green_count || 0),
      yellow: acc.yellow + (p.yellow_count || 0),
      red: acc.red + (p.red_count || 0),
    }),
    { employees: 0, days: 0, green: 0, yellow: 0, red: 0 }
  );

  return (
    <div className="p-6">
      {/* Confirm delete dialog */}
      {confirmPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl border border-border p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground mb-1">Delete Period</p>
                <p className="text-sm text-muted-foreground">
                  Delete <span className="font-medium text-foreground">"{confirmPeriod}"</span> and <strong>all</strong> its payroll entries and snapshots? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                onClick={() => setConfirmPeriod(null)}
              >Cancel</button>
              <button
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                onClick={confirmDelete}
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <History className="w-6 h-6 text-slate-600" />
        <h1 className="text-2xl font-bold">Period Log</h1>
        <span className="text-sm text-muted-foreground">({allPeriods.length} periods)</span>
      </div>

      {loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}

      {!loading && (
        <div className="rounded-lg border overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                {['Period', 'Date Range', 'Processed', 'Employees', 'Days', 'GREEN', 'YELLOW', 'RED', 'Notes', '', ''].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold border-b border-r last:border-r-0 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allPeriods.map(p => (
                <tr
                  key={p.period_name}
                  className="border-b hover:bg-blue-50 cursor-pointer group"
                  onClick={() => navigate(`/payroll-master?period=${encodeURIComponent(p.period_name)}`)}
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
                  <td className="px-3 py-2 border-r text-center">
                    <ArrowRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                  <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <button
                      className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-700 disabled:opacity-40 transition-colors"
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
              {allPeriods.length === 0 && (
                <tr><td colSpan={11} className="text-center py-8 text-muted-foreground text-sm">No periods processed yet.</td></tr>
              )}
            </tbody>
            {allPeriods.length > 1 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr className="font-semibold text-sm">
                  <td className="px-3 py-2 border-r text-muted-foreground" colSpan={3}>Totals ({allPeriods.length} periods)</td>
                  <td className="px-3 py-2 border-r text-center">{totals.employees}</td>
                  <td className="px-3 py-2 border-r text-center">{totals.days}</td>
                  <td className="px-3 py-2 border-r text-center text-green-700 bg-[#C6EFCE]">{totals.green}</td>
                  <td className="px-3 py-2 border-r text-center text-yellow-700 bg-[#FFEB9C]">{totals.yellow}</td>
                  <td className="px-3 py-2 border-r text-center text-red-700 bg-[#FFC7CE]">{totals.red}</td>
                  <td className="px-3 py-2 border-r" />
                  <td className="px-3 py-2 border-r" />
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
