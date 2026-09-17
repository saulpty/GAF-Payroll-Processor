import { useState, useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useViewer } from '@/app/context/ViewerContext';
import loadTeramindVsPayrollAction from '@/actions/loadTeramindVsPayroll';
import loadPeriodsAction from '@/actions/loadPeriods';
import {
  classifyRow, summarize, fmtMinutes,
  type CompareRow, type CompareKind,
} from '@/app/lib/teramindCompare';
import TeramindCompareTable from './TeramindCompareTable';

type PeriodRow = { period_name: string; start_date: string | null; end_date: string | null };
type RawRow = Record<string, unknown>;
type Source = 'time_record' | 'login_session';

const ALL_KINDS: CompareKind[] = ['match', 'close', 'different', 'payroll_only', 'teramind_only', 'both_empty'];
const KIND_LABELS: Record<CompareKind, string> = {
  match: 'Match', close: 'Within 5 Min', different: 'Different',
  payroll_only: 'Payroll Only', teramind_only: 'Teramind Only', both_empty: 'No Punches Either Side',
};
const DEFAULT_ON: Set<CompareKind> = new Set(['different', 'close', 'payroll_only', 'teramind_only']);

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toBool(v: unknown): boolean | null {
  if (v == null) return null;
  return v === true || v === 'true' || v === 1 || v === '1';
}
function toStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v);
}

function mapRow(r: RawRow): CompareRow {
  return {
    employee_id: Number(r.employee_id),
    name: String(r.name ?? ''),
    day: String(r.day ?? '').slice(0, 10),
    period_name: toStr(r.period_name),
    pay_entry: toStr(r.pay_entry),
    pay_exit: toStr(r.pay_exit),
    pay_entry_min: toNum(r.pay_entry_min),
    pay_exit_min: toNum(r.pay_exit_min),
    tm_entry_min: toNum(r.tm_entry_min),
    tm_exit_min: toNum(r.tm_exit_min),
    tm_exit_next_day: toBool(r.tm_exit_next_day),
    sessions: toNum(r.sessions),
    longest_s: toNum(r.longest_s),
    has_manual: r.has_manual === true,
    event_type_1: toStr(r.event_type_1),
    initial_status: toStr(r.initial_status),
    touched_after_run: toBool(r.touched_after_run),
  };
}

function exportCsv(rows: CompareRow[], from: string, to: string) {
  const header = [
    'day','name','period','pay_entry','tm_entry','delta_entry_min',
    'pay_exit','tm_exit','tm_exit_next_day','delta_exit_min',
    'records','longest_s','manual','event_type_1','initial_status','edited','kind',
  ].join(',');
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map(r => {
    const v = classifyRow(r);
    return [
      r.day, r.name, r.period_name ?? '',
      r.pay_entry ?? '', fmtMinutes(r.tm_entry_min), v.entryDiff ?? '',
      r.pay_exit ?? '', fmtMinutes(r.tm_exit_min), r.tm_exit_next_day ? '+1d' : '',
      v.exitDiff ?? '', r.sessions ?? '', r.longest_s ?? '',
      r.has_manual ? 'yes' : '', r.event_type_1 ?? '',
      r.initial_status ?? '', r.touched_after_run ? 'yes' : '', v.kind,
    ].map(escape).join(',');
  }).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `teramind-vs-payroll_${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TeramindCompare() {
  const { viewAs } = useViewer();
  const [source, setSource] = useState<Source>('time_record');

  const [periods, periodsLoading] = useLoadAction(loadPeriodsAction, [], {});
  const periodRows = useMemo(
    () => (periods as PeriodRow[]).filter(p => p.start_date && p.end_date),
    [periods],
  );

  const newestPeriod = periodRows[0] ?? null;
  const allFrom = useMemo(() => {
    if (!periodRows.length) return null;
    return [...periodRows].sort((a, b) => String(a.start_date) < String(b.start_date) ? -1 : 1)[0];
  }, [periodRows]);
  const allTo = periodRows[0] ?? null;

  const [selectedPeriod, setSelectedPeriod] = useState<string>('__newest__');

  const { dateFrom, dateTo } = useMemo(() => {
    if (selectedPeriod === '__all__') {
      return {
        dateFrom: allFrom ? String(allFrom.start_date).slice(0, 10) : '',
        dateTo:   allTo  ? String(allTo.end_date).slice(0, 10) : '',
      };
    }
    if (selectedPeriod === '__newest__') {
      return {
        dateFrom: newestPeriod ? String(newestPeriod.start_date).slice(0, 10) : '',
        dateTo:   newestPeriod ? String(newestPeriod.end_date).slice(0, 10) : '',
      };
    }
    const p = periodRows.find(r => r.period_name === selectedPeriod);
    return {
      dateFrom: p ? String(p.start_date).slice(0, 10) : '',
      dateTo:   p ? String(p.end_date).slice(0, 10) : '',
    };
  }, [selectedPeriod, periodRows, newestPeriod, allFrom, allTo]);

  const [rawRows, loading, loadError] = useLoadAction(
    loadTeramindVsPayrollAction,
    [],
    { dateFrom, dateTo, viewAs, source },
    { enabled: !!dateFrom && !!dateTo },
  );

  const rows = useMemo(() => (rawRows as RawRow[]).map(mapRow), [rawRows]);
  const verdicts = useMemo(() => rows.map(r => classifyRow(r)), [rows]);
  const summary = useMemo(() => summarize(rows), [rows]);

  const [activeKinds, setActiveKinds] = useState<Set<CompareKind>>(DEFAULT_ON);
  const [longOnly, setLongOnly] = useState(false);
  const [manualOnly, setManualOnly] = useState(false);
  const [nameFilter, setNameFilter] = useState('');

  const toggleKind = (k: CompareKind) => setActiveKinds(prev => {
    const next = new Set(prev);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });

  const filtered = useMemo(() => {
    const nameLow = nameFilter.trim().toLowerCase();
    return rows
      .map((r, i) => ({ row: r, verdict: verdicts[i] }))
      .filter(({ row: r, verdict: v }) => {
        if (!activeKinds.has(v.kind)) return false;
        if (longOnly && !v.longSession) return false;
        if (manualOnly && !r.has_manual) return false;
        if (nameLow && !r.name.toLowerCase().includes(nameLow)) return false;
        return true;
      });
  }, [rows, verdicts, activeKinds, longOnly, manualOnly, nameFilter]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      const wa = a.verdict.worst ?? -1;
      const wb = b.verdict.worst ?? -1;
      if (wb !== wa) return wb - wa;
      if (a.row.day !== b.row.day) return a.row.day < b.row.day ? -1 : 1;
      return a.row.name.localeCompare(b.row.name);
    }), [filtered]);

  const manualCount = useMemo(() => rows.filter(r => r.has_manual).length, [rows]);
  const matchRate = summary.match + summary.close + summary.different > 0
    ? ((summary.match / (summary.match + summary.close + summary.different)) * 100).toFixed(1)
    : null;

  const TILES = [
    { label: 'Days Compared', val: summary.total, color: 'text-slate-700' },
    { label: 'Match', val: summary.match, color: 'text-green-700' },
    { label: 'Within 5 Min', val: summary.close, color: 'text-teal-600' },
    { label: 'Different', val: summary.different, color: 'text-red-600' },
    { label: 'Payroll Only', val: summary.payroll_only, color: 'text-amber-600' },
    { label: 'Teramind Only', val: summary.teramind_only, color: 'text-blue-600' },
    { label: 'No Punches Either Side', val: summary.both_empty, color: 'text-slate-400' },
    { label: 'Long Records (>16h)', val: summary.longSessions, color: 'text-orange-600' },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">Teramind vs Payroll</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Source toggle */}
            <div className="flex rounded border border-slate-200 overflow-hidden text-xs">
              {(['time_record', 'login_session'] as Source[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`px-2 py-1 ${source === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {s === 'time_record' ? 'Time Records' : 'Login Sessions'}
                </button>
              ))}
            </div>
            {!periodsLoading && periodRows.length > 0 && (
              <select
                className="rounded border border-slate-200 px-2 py-1 text-xs bg-white"
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value)}
              >
                <option value="__all__">All Periods</option>
                <option value="__newest__">{newestPeriod?.period_name ?? 'Newest'}</option>
                {periodRows.slice(1).map(p => (
                  <option key={p.period_name} value={p.period_name}>{p.period_name}</option>
                ))}
              </select>
            )}
            <Button
              size="sm" variant="outline" className="h-7 px-2 text-xs"
              disabled={filtered.length === 0}
              onClick={() => exportCsv(filtered.map(f => f.row), dateFrom, dateTo)}
            >
              <Download className="w-3 h-3 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {TILES.map(t => (
            <div key={t.label} className="bg-slate-50 rounded-lg p-2 border">
              <div className={`text-base font-bold ${t.color}`}>{loading ? '—' : t.val}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{t.label}</div>
            </div>
          ))}
        </div>

        {/* Match rate */}
        {!loading && matchRate !== null && (
          <p className="text-xs text-slate-600">
            Match rate: <span className="font-medium">{matchRate}%</span>
            {summary.touched > 0 && (
              <span className="ml-2 text-amber-700">
                · {summary.touched} disagreeing days were changed in payroll after the run
              </span>
            )}
          </p>
        )}

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {ALL_KINDS.map(k => {
            const on = activeKinds.has(k);
            return (
              <button key={k} onClick={() => toggleKind(k)}
                className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                  on ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
              >
                {KIND_LABELS[k]} ({summary[k]})
              </button>
            );
          })}
          <button onClick={() => setLongOnly(v => !v)}
            className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
              longOnly ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            Long Records Only ({summary.longSessions})
          </button>
          <button onClick={() => setManualOnly(v => !v)}
            className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
              manualOnly ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            Manual Time Only ({manualCount})
          </button>
          <input
            type="text" placeholder="Filter by name…" value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            className="ml-1 rounded border border-slate-200 px-2 py-0.5 text-xs bg-white w-36"
          />
        </div>

        {/* Loading / error / empty states */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />Loading comparison…
          </div>
        )}
        {!loading && loadError && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="break-all">{loadError.message}</span>
          </div>
        )}
        {!loading && !loadError && rows.length === 0 && (
          <p className="text-xs text-muted-foreground py-4">No days in this range.</p>
        )}

        {/* Table (extracted component) */}
        {!loading && sorted.length > 0 && (
          <TeramindCompareTable rows={sorted} totalCount={sorted.length} />
        )}

      </CardContent>
    </Card>
  );
}
