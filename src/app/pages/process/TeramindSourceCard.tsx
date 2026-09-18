import { useState, useEffect, useMemo } from 'react';
import { useMutateAction, useLoadAction } from '@uibakery/data';
import { Loader2, Download, CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useViewer } from '@/app/context/ViewerContext';
import { useTeramindPull } from '@/app/pages/admin/teramind/useTeramindPull';
import loadTeramindPunchDaysAction from '@/actions/loadTeramindPunchDays';
import loadTeramindPullLogAction from '@/actions/loadTeramindPullLog';
import { coversRange } from '@/app/lib/teramindPull';
import { punchDaysToRawRows } from '@/app/lib/teramindPunches';
import type { PunchDay } from '@/app/lib/teramindPunches';
import type { TeramindRawRow } from '@/app/lib/teramindTypes';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock } from '@/app/lib/teramindToday';

export type ApiCapture = {
  from: string; to: string;
  capturedAt: string;
  employees: number; days: number; records: number;
  fetched: number;
  fresh: boolean;
  ghostDays: number;
};

type Props = {
  startDate: string; endDate: string; disabled: boolean;
  capture: ApiCapture | null;
  onCaptured: (rows: TeramindRawRow[], info: ApiCapture) => void;
  onCleared: () => void;
};

type Phase = 'idle' | 'pulling' | 'reading' | 'done' | 'error';

export function TeramindSourceCard({ startDate, endDate, disabled, capture, onCaptured, onCleared }: Props) {
  const { isSuper } = useViewer();
  const { pullRange } = useTeramindPull();

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [manualDays, setManualDays] = useState(0);
  const [manualEmails, setManualEmails] = useState(0);
  type GhostRow = { name: string; date: string; ghostMin: number; entryMin: number };
  const [ghostRows, setGhostRows] = useState<GhostRow[]>([]);

  const [fetchPunchDays] = useMutateAction(loadTeramindPunchDaysAction);
  const [pullLog] = useLoadAction(loadTeramindPullLogAction, [], {});

  const datesReady = startDate !== '' && endDate !== '' && startDate <= endDate;

  // Only time_record rows with no error count as coverage
  const logRows = useMemo(() => {
    const all = Array.isArray(pullLog) ? (pullLog as Record<string, unknown>[]) : [];
    return all
      .filter(r => r.source === 'time_record' && !r.error && !r.truncated)
      .map(r => ({
        date_from: String(r.date_from ?? ''),
        date_to:   String(r.date_to ?? ''),
        error:     null as string | null,
        truncated: false,
        pulled_at: String(r.pulled_at ?? ''),
      }));
  }, [pullLog]);

  const isCovered = useMemo(
    () => datesReady && coversRange(logRows, startDate, endDate),
    [datesReady, logRows, startDate, endDate],
  );

  // The most recent pull that covers the range
  const savedPullAt = useMemo(() => {
    if (!isCovered || logRows.length === 0) return null;
    // find the latest pulled_at among covering entries
    const covering = logRows.filter(r =>
      datesReady && coversRange([r], startDate, endDate),
    );
    if (covering.length === 0) return null;
    return covering.reduce((best, r) => (r.pulled_at > best ? r.pulled_at : best), '');
  }, [isCovered, logRows, startDate, endDate, datesReady]);

  // Clear capture when dates change away from what was captured
  useEffect(() => {
    if (capture && (capture.from !== startDate || capture.to !== endDate)) {
      onCleared();
    }
  }, [startDate, endDate, capture, onCleared]);

  const busy = phase === 'pulling' || phase === 'reading' || disabled;

  async function readDays(fresh: boolean, fetched: number): Promise<void> {
    setPhase('reading');
    const resp = await fetchPunchDays({
      dateFrom: startDate,
      dateTo:   endDate,
      manager:  '',
      viewAs:   '',   // intentionally empty — never narrow by viewAs for payroll capture
    });

    const rawDays: PunchDay[] = (Array.isArray(resp) ? resp : []).map(r => {
      const row = r as Record<string, unknown>;
      return {
        teramind_email: String(row.teramind_email ?? ''),
        first_ymd: Number(row.first_ymd),
        first_min: Number(row.first_min),
        last_ymd:  Number(row.last_ymd),
        last_min:  Number(row.last_min),
        ghost_min: row.ghost_min !== undefined ? Number(row.ghost_min) : undefined,
        display_name: row.display_name !== undefined ? String(row.display_name) : undefined,
      };
    });

    const { rows, skipped: sk } = punchDaysToRawRows(rawDays);
    setSkipped(sk);

    if (rows.length === 0) {
      setErrorMsg('Teramind has no records for these dates — nothing was captured.');
      setPhase('error');
      return;
    }

    // Manual days / emails
    const manualRows = (Array.isArray(resp) ? resp : []) as Record<string, unknown>[];
    const mDays = manualRows.filter(r => r.has_manual === true).length;
    const mEmailSet = new Set(
      manualRows.filter(r => r.has_manual === true).map(r => String(r.teramind_email ?? '')),
    );
    setManualDays(mDays);
    setManualEmails(mEmailSet.size);

    // Ghost rows: days where the first record was a stray early event
    const newGhostRows: GhostRow[] = manualRows
      .filter(r => Number(r.ghost_min) >= 0)
      .map(r => {
        const dayYmd = Number(r.day_ymd ?? r.first_ymd ?? 0);
        const y = Math.floor(dayYmd / 10000);
        const mo = Math.floor(dayYmd / 100) % 100;
        const dy = dayYmd % 100;
        const dateStr = `${y}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
        const name = String(r.display_name || r.teramind_email || '');
        return {
          name,
          date: dateStr,
          ghostMin: Number(r.ghost_min),
          entryMin: Number(r.first_min),
        };
      });
    setGhostRows(newGhostRows);

    const totalRecords = manualRows.reduce((s, r) => s + (Number(r.records) || 0), 0);
    const distinctEmails = new Set(rows.map(r => r.email)).size;

    const info: ApiCapture = {
      from: startDate,
      to: endDate,
      capturedAt: new Date().toLocaleString(),
      employees: distinctEmails,
      days: rows.length,
      records: totalRecords,
      fetched,
      fresh,
      ghostDays: newGhostRows.length,
    };

    setPhase('done');
    onCaptured(rows, info);
  }

  async function handleCapture() {
    setPhase('pulling');
    setErrorMsg(null);
    setSkipped(0);
    setManualDays(0);
    setManualEmails(0);
    setGhostRows([]);
    try {
      const result = await pullRange(startDate, endDate, 'capture');
      if (result.truncated) {
        setErrorMsg('The pull returned over 200,000 records. Pull in smaller chunks to avoid missing data.');
        setPhase('error');
        return;
      }
      await readDays(true, result.fetched);
    } catch (e) {
      let msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('roster') || msg.includes('link')) {
        msg += ' Go to Admin → Employees → Teramind.';
      }
      setErrorMsg(msg);
      setPhase('error');
    }
  }

  async function handleUseSaved() {
    setPhase('reading');
    setErrorMsg(null);
    setSkipped(0);
    setManualDays(0);
    setManualEmails(0);
    setGhostRows([]);
    try {
      await readDays(false, 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setPhase('error');
    }
  }

  // ── guards ──────────────────────────────────────────────────────────────

  if (!isSuper) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Capture From Teramind</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Only super users can capture payroll punches.</p>
        </CardContent>
      </Card>
    );
  }

  // ── capture result box ───────────────────────────────────────────────────

  if (capture) {
    const visibleGhosts = ghostRows.slice(0, 15);
    const hiddenGhosts = ghostRows.length > 15 ? ghostRows.length - 15 : 0;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Capture From Teramind</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-800">Captured From Teramind</p>
              <p className="text-green-700 mt-0.5">
                {capture.employees} employee{capture.employees !== 1 ? 's' : ''} · {capture.days} employee-day{capture.days !== 1 ? 's' : ''} · {capture.records} records
              </p>
              <p className="text-green-600 mt-0.5">
                {capture.from} → {capture.to} · {capture.fresh ? 'pulled just now' : 'saved copy'} · {capture.capturedAt}
              </p>
            </div>
            <Button
              size="sm" variant="ghost"
              className="shrink-0 px-1.5 h-6 text-green-700 hover:text-red-600"
              disabled={disabled}
              onClick={onCleared}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {ghostRows.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">Early Stray Records Ignored — {ghostRows.length}</p>
                <ul className="mt-1 space-y-0.5">
                  {visibleGhosts.map((g, i) => (
                    <li key={i} className="tabular-nums">
                      {g.name} · {fmtDayShort(g.date)} · Ignored {fmtClock(g.ghostMin)} → Entry {fmtClock(g.entryMin)}
                    </li>
                  ))}
                  {hiddenGhosts > 0 && (
                    <li className="text-amber-600">And {hiddenGhosts} More</li>
                  )}
                </ul>
                <p className="mt-1.5 text-amber-600">Check These Before Running. The backup file upload does not apply this rule.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── main card ────────────────────────────────────────────────────────────

  const phaseLabel =
    phase === 'pulling' ? 'Pulling from Teramind…' :
    phase === 'reading' ? 'Reading saved copy…' : '';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Capture From Teramind</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">

        {!datesReady && (
          <p className="text-xs text-muted-foreground">Enter the period dates in step 1 first.</p>
        )}

        {datesReady && (
          <>
            <div className="flex flex-col gap-2">
              <Button
                size="sm" className="w-full"
                onClick={handleCapture}
                disabled={busy}
              >
                {phase === 'pulling'
                  ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5 mr-1.5" />}
                {phaseLabel || 'Capture From Teramind'}
              </Button>

              {isCovered && (
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm" variant="outline" className="w-full"
                    onClick={handleUseSaved}
                    disabled={busy}
                  >
                    {phase === 'reading'
                      ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-600" />}
                    Use Saved Copy
                  </Button>
                  {savedPullAt && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      Saved copy pulled {new Date(savedPullAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="break-all">{errorMsg}</span>
              </div>
            )}

            {/* Skipped days warning */}
            {skipped > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{skipped} day{skipped !== 1 ? 's' : ''} could not be read and were left out.</span>
              </div>
            )}

            {/* Manual time warning */}
            {manualDays > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {manualDays} day{manualDays !== 1 ? 's' : ''} include time typed into Teramind by hand
                  ({manualEmails} employee{manualEmails !== 1 ? 's' : ''}).
                </span>
              </div>
            )}
          </>
        )}

      </CardContent>
    </Card>
  );
}
