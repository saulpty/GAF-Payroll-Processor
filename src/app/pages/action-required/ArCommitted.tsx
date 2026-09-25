import { GitCommit, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { STATUS_CHIP, type CommittedRow } from './arTypes';

/** The "Committed to GREEN" list with per-row revert. Split out of ActionRequired.tsx, AR-1.
 *  Open/closed state stays in the page so it survives reloads, as before. */
export function ArCommitted({ committed, sessionCommitted, revertingIds, showPeriod, committedOpen, setCommittedOpen, onRevert }: {
  committed: CommittedRow[];
  sessionCommitted: Set<number>;
  revertingIds: Set<number>;
  showPeriod: boolean;
  committedOpen: boolean;
  setCommittedOpen: (f: (o: boolean) => boolean) => void;
  onRevert: (r: CommittedRow) => void;
}) {
  return (
    <div className="shrink-0 border rounded-xl overflow-hidden shadow-sm">
      {/* Section header */}
      <button
        onClick={() => setCommittedOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 border-b border-green-200 hover:bg-green-100 transition-colors text-left"
      >
        <GitCommit className="w-4 h-4 text-green-600 shrink-0" />
        <span className="text-sm font-semibold text-green-800">Committed to GREEN</span>
        <Badge className="bg-green-600 text-white text-xs ml-1">{committed.length}</Badge>
        {sessionCommitted.size > 0 && (
          <span className="text-xs text-green-600 font-medium ml-1">({sessionCommitted.size} this session)</span>
        )}
        <ChevronRight className={`w-4 h-4 text-green-500 ml-auto transition-transform ${committedOpen ? 'rotate-90' : ''}`} />
      </button>

      {committedOpen && (
        committed.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground bg-white">
            <GitCommit className="w-6 h-6 text-slate-300 mx-auto mb-1" />
            No committed entries yet — select rows above, fill in the event/pay impact fields, and click <strong>Commit to GREEN</strong>.
          </div>
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs border-collapse tabular-nums" style={{ minWidth: 900 }}>
              <thead className="sticky top-0 bg-green-50 border-b border-green-200 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Employee</th>
                  {showPeriod && <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Period</th>}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Was</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Event 1</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Pay Impact 1</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Event 2</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Pay Impact 2</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Doc</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Notes</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700">Updated</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700"></th>
                </tr>
              </thead>
              <tbody>
                {committed.map(r => {
                  const isNew = sessionCommitted.has(r.id);
                  return (
                    <tr key={r.id} className={`border-b last:border-b-0 transition-colors ${isNew ? 'bg-green-50' : 'bg-white hover:bg-slate-50'}`}>
                      <td className="px-3 py-2 border-r font-medium">
                        {isNew && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 align-middle" />}
                        {r.employee_name}
                      </td>
                      {showPeriod && <td className="px-3 py-1.5 border-r whitespace-nowrap text-slate-600">{r.period_name}</td>}
                      <td className="px-3 py-2 border-r font-mono text-slate-600">{r.work_date?.slice(0, 10)}</td>
                      <td className="px-3 py-2 border-r">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_CHIP[r.initial_status] || ''}`}>{r.initial_status}</span>
                      </td>
                      <td className="px-3 py-2 border-r text-slate-700">{r.event_type_1 || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 border-r">
                        {r.pay_impact_1
                          ? <span className="text-blue-700 font-medium">{r.pay_impact_1}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 border-r text-slate-700">{r.event_type_2 || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 border-r">
                        {r.pay_impact_2
                          ? <span className="text-blue-700 font-medium">{r.pay_impact_2}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 border-r text-slate-600">{r.documentation || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 border-r text-slate-500 max-w-40 truncate">{r.notes || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-slate-400 text-[11px] font-mono whitespace-nowrap">{r.updated_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          title={`Revert to ${r.initial_status}`}
                          disabled={revertingIds.has(r.id)}
                          onClick={() => onRevert(r)}
                          className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                        >
                          {revertingIds.has(r.id)
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <RotateCcw className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
