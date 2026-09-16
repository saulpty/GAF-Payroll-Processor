import { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { RefreshCw, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import loadMondaySyncLogAction from '@/actions/loadMondaySyncLog';
import { useAccessSync, ACCESS_SYNC_LOG_KEY, ACCESS_SYNC_EVERY_MINUTES } from './useAccessSync';
import type { AccessSyncResult } from './syncAccessFromMonday';

type LogRow = { board_key: string; last_synced_at: string | null; last_error: string | null };

/** Access groups follow Monday automatically; this shows when they last did and lets Saul check right now. */
export default function BuildFromMonday({ onDone }: { onDone: () => void | Promise<void> }) {
  const [logRaw, , , reloadLog] = useLoadAction(loadMondaySyncLogAction, [] as LogRow[]);
  const sync = useAccessSync();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AccessSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const log = (logRaw as LogRow[]).find(r => r.board_key === ACCESS_SYNC_LOG_KEY);
  const lastAt = log?.last_synced_at ? new Date(log.last_synced_at).toLocaleString() : 'never';

  const run = async () => {
    setRunning(true); setError(null); setResult(null); setShowSkipped(false);
    try {
      setResult(await sync(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      await reloadLog();
      await onDone();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-slate-500">
          Follows Monday automatically (every {ACCESS_SYNC_EVERY_MINUTES} min) · last checked {lastAt}
        </span>
        <Button size="sm" variant="outline" onClick={run} disabled={running}>
          {running
            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Checking Monday…</>
            : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Check Monday now</>}
        </Button>
      </div>
      {log?.last_error && !result && !error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">Last check failed: {log.last_error}</div>
      )}
      {result && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
          <div className="flex items-start justify-between gap-3">
            <span>{result.summary}</span>
            <button type="button" onClick={() => setResult(null)} title="Close" className="text-blue-700 hover:text-blue-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {result.skipped.length > 0 && (
            <div className="mt-1">
              <button type="button" onClick={() => setShowSkipped(s => !s)} className="underline underline-offset-2">
                {result.skipped.length} not placed — fix on Monday
              </button>
              {showSkipped && (
                <ul className="mt-1 space-y-0.5">
                  {result.skipped.map((s, i) => <li key={i}>{s.name} — {s.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{error}</div>
      )}
    </div>
  );
}
