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
  type CompareRow, type CompareKind, type CompareVerdict,
} from '@/app/lib/teramindCompare';

type PeriodRow = { period_name: string; start_date: string | null; end_date: string | null };
type RawRow = Record<string, unknown>;

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
    event_type_1: toStr(r.event_type_1),
    initial_status: toStr(r.initial_status),
    touched_after_run: toBool(r.touched_after_run),
  };
}

function fmtDiff(d: number | null): string {
  if (d == null) return '—';
  return d > 0 ? `+${d}` : String(d);
}

function diffColor(abs: number | null): string {
  if (abs == null) return '';
  if (abs > 30) return 'text-red-600 font-medium';
  if (abs > 5)  return 'text-amber-600';
  return 'text-slate-500';
}

function fmtLongest(s: number | null): string {
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  return `${h}:${m}`;
}

function exportCsv(rows: CompareRow[], verdicts: CompareVerdict[], from: string, to: string) {
  const header = [
    'day','name','period','pay_entry','tm_entry','delta_entry_min',
    'pay_exit','tm_exit','tm_exit_next_day','delta_exit_min',
    'sessions','longest_s','event_type_1','initial_status','edited','kind',
  ].join(',');
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r, i) => {
    const v = verdicts[i];
    return [
      r.day, r.name, r.period_name ?? '',
      r.pay_entry ?? '', fmtMinutes(r.tm_entry_min), v.entryDiff ?? '',
      r.pay_exit ?? '', fmtMinutes(r.tm_exit_min), r.tm_exit_next_day ? '+1d' : '',
      v.exitDiff ?? '',
      r.sessions ?? '', r.longest_s ?? '', r.event_type_1 ?? '',
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

  const [periods, periodsLoading] = useLoadAction(loadPeriodsAction, [], {});
  const periodRows = useMemo(
    () => (periods as PeriodRow[]).filter(p => p.start_date && p.end_date),
    [periods],
  );

  // Default: newest period
  const newestPeriod = periodRows[0] ?? null;
  const allFrom = useMemo(() => {
    if (!periodRows.length) return '';
    return [...periodRows].sort((a, b) => String(a.start_date) < String(b.start_date) ? -1 : 1)[0];
  }, [periodRows]);
  const allTo = periodRows[0];

  const [selectedPeriod, setSelectedPeriod] = useState<string>('__newest__');

  const { dateFrom, dateTo } = useMemo(() => {
    if (selectedPeriod === '__all__') {
      return {
        dateFrom: allFrom ? String(allFrom.start_date).slice(0, 10) : '',
        dateTo: allTo ? String(allTo.end_date).slice(0, 10) : '',
      };
    }
    if (selectedPeriod === '__newest__') {
      return {
        dateFrom: newestPeriod ? String(newestPeriod.start_date).slice(0, 10) : '',
        dateTo: newestPeriod ? String(newestPeriod.end_date).slice(0, 10) : '',
      };
    }
    const p = periodRows.find(r => r.period_name === selectedPeriod);
    return {
      dateFrom: p ? String(p.start_date).slice(0, 10) : '',
      dateTo: p ? String(p.end_date).slice(0, 10) : '',
    };
  }, [selectedPeriod, periodRows, newestPeriod, allFrom, allTo]);

  const [rawRows, loading, loadError] = useLoadAction(
    loadTeramindVsPayrollAction,
    [],
    { dateFrom, dateTo, viewAs },
    { enabled: !!dateFrom && !!dateTo },
  );

  const rows = useMemo(() => (rawRows as RawRow[]).map(mapRow), [rawRows]);
  const verdicts = useMemo(() => rows.map(r => classifyRow(r)), [rows]);
  const summary = useMemo(() => summarize(rows), [rows]);

  // Filters
  const [activeKinds, setActiveKinds] = useState<Set<CompareKind>>(DEFAULT_ON);
  const [longOnly, setLongOnly] = useState(false);
  const [nameFilter, setNameFilter] = useState('');

  const toggleKind = (k: CompareKind) => setActiveKinds(prev => {
    const next = new Set(prev);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });

  const filtered = useMemo(() => {
    const nameLow = nameFilter.trim().toLowerCase();
    return rows
      .map((r, i) => ({ r, v: verdicts[i] }))
      .filter(({ r, v }) => {
        if (!activeKinds.has(v.kind)) return false;
        if (longOnly && !v.longSession) return false;
        if (nameLow && !r.name.toLowerCase().includes(nameLow)) return false;
        return true;
      });
  }, [rows, verdicts, activeKinds, longOnly, nameFilter]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      const wa = a.v.worst ?? -1;
      const wb = b.v.worst ?? -1;
      if (wb !== wa) return wb - wa;
      if (a.r.day !== b.r.day) return a.r.day < b.r.day ? -1 : 1;
      return a.r.name.localeCompare(b.r.name);
    }), [filtered]);

  const MAX_ROWS = 500;
  const rendered = sorted.slice(0, MAX_ROWS);
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
    { label: 'Long Sessions (>16h)', val: summary.longSessions, color: 'text-orange-600' },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">Teramind vs Payroll</CardTitle>
          <div className="flex items-center gap-2">
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
              size="sm" variant="outline"
              className="h-7 px-2 text-xs"
              disabled={filtered.length === 0}
              onClick={() => exportCsv(
                filtered.map(f => f.r),
                filtered.map(f => f.v),
                dateFrom, dateTo,
              )}
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

        {/* Match rate + touched */}
        {!loading && matchRate !== null && (
          <p className="text-xs text-slate-600">
            Match rate: <span className="font-medium">{matchRate}%</span>
            {summary.touched > 0 && (
              <span className="ml-2 text-amber-700">
                · {summary.touched} of the disagreeing days were changed in payroll after the run (possible hand edits)
              </span>
            )}
          </p>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {ALL_KINDS.map(k => {
            const on = activeKinds.has(k);
            return (
              <button
                key={k}
                onClick={() => toggleKind(k)}
                className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                  on ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
              >
                {KIND_LABELS[k]} ({summary[k]})
              </button>
            );
          })}
          <button
            onClick={() => setLongOnly(v => !v)}
            className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
              longOnly ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            Long Sessions Only ({summary.longSessions})
          </button>
          <input
            type="text"
            placeholder="Filter by name…"
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            className="ml-1 rounded border border-slate-200 px-2 py-0.5 text-xs bg-white w-36"
          />
        </div>

        {/* Loading / error / empty */}
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

        {/* Table */}
        {!loading && rendered.length > 0 && (
          <>
            {sorted.length > MAX_ROWS && (
              <p className="text-xs text-amber-700">
                Showing first {MAX_ROWS} of {sorted.length} rows matching current filters.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50">
                    {['Date','Employee','Period','Payroll In','Teramind In','Δ In',
                      'Payroll Out','Teramind Out','Δ Out','Sessions','Longest','Event','Status','Edited'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium text-slate-500 whitespace-nowrap border-b border-slate-100 sticky top-0 bg-slate-50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rendered.map(({ r, v }, i) => (
                    <tr key={i} className="hover:bg-slate-50 border-b border-slate-50">
                      <td className="px-2 py-1 whitespace-nowrap font-mono text-slate-600">{r.day}</td>
                      <td className="px-2 py-1 whitespace-nowrap max-w-[130px] truncate">{r.name}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-slate-400">{r.period_name ?? '—'}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{r.pay_entry ?? '—'}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{fmtMinutes(r.tm_entry_min)}</td>
                      <td className={`px-2 py-1 whitespace-nowrap text-right ${diffColor(v.entryDiff != null ? Math.abs(v.entryDiff) : null)}`}>
                        {fmtDiff(v.entryDiff)}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">{r.pay_exit ?? '—'}</td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {fmtMinutes(r.tm_exit_min)}{r.tm_exit_next_day ? ' +1d' : ''}
                      </td>
                      <td className={`px-2 py-1 whitespace-nowrap text-right ${diffColor(v.exitDiff != null ? Math.abs(v.exitDiff) : null)}`}>
                        {fmtDiff(v.exitDiff)}
                      </td>
                      <td className="px-2 py-1 text-right">{r.sessions ?? '—'}</td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {fmtLongest(r.longest_s)}
                        {v.longSession && (
                          <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-amber-100 text-amber-700 font-medium">long</span>
                        )}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap text-slate-400 max-w-[80px] truncate">{r.event_type_1 ?? '—'}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{r.initial_status ?? '—'}</td>
                      <td className="px-2 py-1">
                        {r.touched_after_run && (
                          <span className="px-1 py-0.5 rounded text-[9px] bg-blue-100 text-blue-700 font-medium">edited</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
}
