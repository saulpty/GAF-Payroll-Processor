import { useLoadAction } from '@uibakery/data';
import { Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import loadTeramindPullLogAction from '@/actions/loadTeramindPullLog';
import { useTeramindPull } from './useTeramindPull';
import TeramindAgentsCard from './TeramindAgentsCard';
import TeramindPullCard from './TeramindPullCard';

type PullLogRow = {
  id: number;
  date_from: string;
  date_to: string;
  pulled_at: string;
  pulled_by: string;
  trigger: string;
  agent_count: number;
  row_count: number;
  saved_count: number;
  truncated: boolean;
  error: string | null;
};

function fmtAt(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function TeramindTab() {
  const { syncAgents, pullRange, syncing, pulling } = useTeramindPull();

  const [pullLog, , , reloadLog] = useLoadAction(loadTeramindPullLogAction, [], {});
  const logRows = pullLog as PullLogRow[];

  return (
    <div className="p-6 flex flex-col gap-6">

      {/* Cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeramindAgentsCard
          onSync={syncAgents}
          syncing={syncing}
          onDone={() => reloadLog()}
        />
        <TeramindPullCard
          onPull={pullRange}
          pulling={pulling}
          onDone={() => reloadLog()}
        />
      </div>

      {/* Pull log table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 opacity-70" />
            Pull Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logRows.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">No pulls yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['When', 'Range', 'By', 'Trigger', 'Fetched', 'Saved', 'Error'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logRows.map(row => (
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{fmtAt(row.pulled_at)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap font-mono">{String(row.date_from).slice(0, 10)} → {String(row.date_to).slice(0, 10)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-500 max-w-[120px] truncate">{row.pulled_by}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap capitalize">{row.trigger}</td>
                      <td className="px-3 py-1.5 text-right">{row.row_count}</td>
                      <td className="px-3 py-1.5 text-right text-green-700">{row.saved_count}</td>
                      <td className="px-3 py-1.5 max-w-[200px]">
                        {row.error ? (
                          <span className="flex items-center gap-1 text-red-600 break-all">
                            <AlertCircle className="w-3 h-3 shrink-0" />{row.error}
                          </span>
                        ) : (
                          <span className="text-green-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completeness note */}
      <p className="text-xs text-muted-foreground">
        Teramind data is complete through yesterday.
      </p>

    </div>
  );
}
