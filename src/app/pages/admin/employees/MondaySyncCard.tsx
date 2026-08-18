import { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { RefreshCw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import upsertMondaySyncLogAction from '@/actions/upsertMondaySyncLog';

export type SyncLogRow = {
  board_key: string;
  last_synced_at: string | null;
  item_count: number | null;
  matched_count: number | null;
  unmatched_count: number | null;
  last_error: string | null;
};

export type SyncResult = { items: number; matched: number; unmatched: number };

type Props = {
  boardKey: string;
  title: string;
  /** async callback that runs the actual sync; null = disabled (show "Next step" tooltip) */
  onSync: (() => Promise<SyncResult>) | null;
  log: SyncLogRow | undefined;
  onDone: () => void;
  /** Extra summary line rendered below the card, e.g. "3 updated · 1 created" */
  summary?: string;
};

function fmtDate(ts: string | null | undefined): string {
  if (!ts) return 'Never';
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function MondaySyncCard({ boardKey, title, onSync, log, onDone, summary }: Props) {
  const [upsertLog] = useMutateAction(upsertMondaySyncLogAction);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    if (!onSync) return;
    setRunning(true);
    setError(null);
    try {
      const result = await onSync();
      await upsertLog({
        board_key: boardKey,
        item_count: result.items,
        matched_count: result.matched,
        unmatched_count: result.unmatched,
        last_error: null,
      });
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      await upsertLog({
        board_key: boardKey,
        item_count: log?.item_count ?? 0,
        matched_count: log?.matched_count ?? 0,
        unmatched_count: log?.unmatched_count ?? 0,
        last_error: msg,
      }).catch(() => { /* best-effort */ });
      onDone();
    } finally {
      setRunning(false);
    }
  };

  const disabled = onSync === null || running;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {log?.last_synced_at && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {fmtDate(log.last_synced_at)}
            </Badge>
          )}
        </div>
        {!log?.last_synced_at && (
          <p className="text-xs text-muted-foreground mt-0.5">Never synced</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 flex-1">
        {/* Counters */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Items',     val: log?.item_count     },
            { label: 'Matched',   val: log?.matched_count, color: 'text-green-700'  },
            { label: 'Unmatched', val: log?.unmatched_count, color: 'text-amber-600' },
          ].map(c => (
            <div key={c.label} className="bg-slate-50 rounded-lg p-2 border">
              <div className={`text-lg font-bold ${c.color ?? 'text-slate-700'}`}>
                {c.val ?? '—'}
              </div>
              <div className="text-[10px] text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Last error */}
        {(log?.last_error || error) && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="break-all">{error ?? log?.last_error}</span>
          </div>
        )}

        {/* Summary line */}
        {summary && !error && (
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            {summary}
          </div>
        )}

        {/* Sync button */}
        <div className="mt-auto pt-1">
          {onSync === null ? (
            <Button size="sm" className="w-full" disabled title="Coming in next step">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Sync now — Next step
            </Button>
          ) : (
            <Button size="sm" className="w-full" onClick={handleSync} disabled={disabled}>
              {running
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              {running ? 'Syncing…' : 'Sync now'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
