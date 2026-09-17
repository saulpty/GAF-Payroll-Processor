import { useState, useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Download, Loader2, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import loadPeriodsAction from '@/actions/loadPeriods';
import loadTeramindPullLogAction from '@/actions/loadTeramindPullLog';
import { coversRange } from '@/app/lib/teramindPull';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import type { PullRangeResult } from './useTeramindPull';

type PeriodRow = {
  period_name: string;
  start_date: string | null;
  end_date: string | null;
};
type PullLogRow = {
  date_from: string;
  date_to: string;
  error: string | null;
  truncated: boolean;
  source: string | null;
};

type Props = {
  onPull: (from: string, to: string, trigger: 'manual' | 'backfill') => Promise<PullRangeResult>;
  pulling: boolean;
  onDone: () => void;
};

export default function TeramindPullCard({ onPull, pulling, onDone }: Props) {
  const today = toLocalYMD(new Date());

  const [periods, periodsLoading] = useLoadAction(loadPeriodsAction, [], {});
  const [pullLog, , , reloadLog] = useLoadAction(loadTeramindPullLogAction, [], {});

  const [from, setFrom] = useState('');
  const [to,   setTo]   = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [result,   setResult]   = useState<PullRangeResult | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [backfillTotal, setBackfillTotal]   = useState<{ pulled: number; skipped: number; failed: number } | null>(null);

  // Only count time_record pulls when checking coverage
  const logRows = useMemo(
    () => (pullLog as PullLogRow[]).filter(r => r.source === 'time_record'),
    [pullLog],
  );

  const periodRows = useMemo(
    () => (periods as PeriodRow[]).filter(p => p.start_date && p.end_date),
    [periods],
  );

  const handlePull = async () => {
    const f = from.trim();
    const t = to.trim();
    if (!f || !t || f > t) { setError('Enter a valid date range (From ≤ To).'); return; }
    setError(null);
    setResult(null);
    try {
      const r = await onPull(f, t, 'manual');
      setResult(r);
      await reloadLog();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    setError(null);
    setBackfillStatus(null);
    setBackfillTotal(null);

    const ordered = [...periodRows].sort((a, b) =>
      String(a.start_date) < String(b.start_date) ? -1 : 1
    );

    let totalPulled = 0;
    let totalSkipped = 0;
    let totalFailed  = 0;
    const coveredLocal: { date_from: string; date_to: string; error: string | null; truncated: boolean }[] =
      [...logRows];

    for (const p of ordered) {
      const pFrom = String(p.start_date).slice(0, 10);
      const pTo   = String(p.end_date).slice(0, 10);
      if (coversRange(coveredLocal, pFrom, pTo)) {
        totalSkipped++;
        setBackfillStatus(`Skipping ${p.period_name} (already covered)`);
        setBackfillTotal({ pulled: totalPulled, skipped: totalSkipped, failed: totalFailed });
        continue;
      }
      setBackfillStatus(`Pulling ${p.period_name} (${pFrom} → ${pTo})…`);
      try {
        await onPull(pFrom, pTo, 'backfill');
        totalPulled++;
        coveredLocal.push({ date_from: pFrom, date_to: pTo, error: null, truncated: false });
      } catch {
        totalFailed++;
      }
      await reloadLog();
      onDone();
      setBackfillTotal({ pulled: totalPulled, skipped: totalSkipped, failed: totalFailed });
    }

    setBackfilling(false);
    setBackfillStatus(
      `Backfill complete — ${totalPulled} periods pulled, ${totalSkipped} skipped, ${totalFailed} failed.`
    );
  };

  const busy = pulling || backfilling;
  const periodsReady = !periodsLoading && periodRows.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Pull Time Records</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

        {/* Date range inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground font-medium">From</label>
            <input
              type="text"
              placeholder="YYYY-MM-DD"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="rounded border border-slate-200 px-2 py-1 text-xs bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground font-medium">To</label>
            <input
              type="text"
              placeholder="YYYY-MM-DD"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="rounded border border-slate-200 px-2 py-1 text-xs bg-white"
            />
          </div>
        </div>

        {/* Pull buttons */}
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={handlePull} disabled={busy}>
            {pulling && !backfilling
              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              : <Download className="w-3.5 h-3.5 mr-1.5" />}
            {pulling && !backfilling ? 'Pulling…' : 'Pull'}
          </Button>
          <Button
            size="sm" variant="outline" className="flex-1"
            onClick={handleBackfill}
            disabled={busy || !periodsReady}
          >
            {backfilling
              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              : <Download className="w-3.5 h-3.5 mr-1.5" />}
            {backfilling ? 'Backfilling…' : 'Backfill All Periods'}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="break-all">{error}</span>
          </div>
        )}

        {/* Pull result */}
        {result && !error && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Fetched', val: result.fetched },
                { label: 'Saved',   val: result.saved,   color: 'text-green-700' },
                { label: 'Dropped', val: result.dropped, color: 'text-amber-600' },
              ].map(c => (
                <div key={c.label} className="bg-slate-50 rounded-lg p-2 border">
                  <div className={`text-lg font-bold ${c.color ?? 'text-slate-700'}`}>{c.val}</div>
                  <div className="text-[10px] text-muted-foreground">{c.label}</div>
                </div>
              ))}
            </div>
            {result.truncated && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Over 200,000 records in this range. Pull in smaller chunks to avoid missing data.
              </div>
            )}
          </div>
        )}

        {/* Backfill status */}
        {backfillStatus && (
          <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2">
            {backfilling
              ? <Loader2 className="w-3.5 h-3.5 shrink-0 mt-0.5 animate-spin" />
              : <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-600" />}
            <span>{backfillStatus}</span>
          </div>
        )}
        {backfillTotal && (
          <div className="text-xs text-muted-foreground">
            Running: {backfillTotal.pulled} pulled · {backfillTotal.skipped} skipped · {backfillTotal.failed} failed
          </div>
        )}

        {/* Footer note */}
        <p className="text-[10px] text-muted-foreground">
          Time Records are live — today's records are available now.
        </p>

      </CardContent>
    </Card>
  );
}
