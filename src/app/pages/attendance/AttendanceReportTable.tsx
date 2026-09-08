import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Info } from 'lucide-react';
import type { ReportRow, Verdict } from '@/app/lib/attendanceReportTypes';
import { VERDICT_LABEL } from './AttendanceReportStrips';

type Props = { rows: ReportRow[] };

const VERDICT_BADGE: Record<Verdict, string> = {
  on_time:                 'bg-green-100 text-green-700',
  late_reported_on_time:   'bg-green-100 text-green-700',
  absent_reported_on_time: 'bg-green-100 text-green-700',
  late_reported_late:      'bg-amber-100 text-amber-700',
  absent_reported_late:    'bg-amber-100 text-amber-700',
  late_no_form:            'bg-red-100 text-red-700',
  unexplained_absence:     'bg-red-100 text-red-700',
  pto:                     'bg-slate-100 text-slate-600',
  permission:              'bg-slate-100 text-slate-600',
  holiday:                 'bg-slate-100 text-slate-600',
  not_processed:           'bg-slate-100 text-slate-400',
};

type SortKey = 'date' | 'employeeName' | 'verdict' | 'minutesLate';
type Dir = 'asc' | 'desc';

const ALL_VERDICTS: Verdict[] = [
  'on_time', 'late_reported_on_time', 'late_reported_late',
  'late_no_form', 'absent_reported_on_time', 'absent_reported_late',
  'unexplained_absence', 'pto', 'permission', 'holiday', 'not_processed',
];

function fmtDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Times from payroll_entries are already US Eastern wall clock in
 *  "H:MM AM" / "H:MM PM" form (AGENTS.md). They are displayed as stored —
 *  reformatting them is what produced "9:54 AM AM", and re-deriving the
 *  meridiem from a 12-hour hour turned "1:30 PM" into "1:30 PM AM". */
function fmtTime(t: string | null) {
  const s = (t ?? '').trim();
  return s === '' ? '—' : s;
}

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: Dir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 opacity-80 inline ml-0.5 text-[#2AA876]" />
    : <ChevronDown className="w-3 h-3 opacity-80 inline ml-0.5 text-[#2AA876]" />;
}

export function AttendanceReportTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<Dir>('asc');
  const [activeVerdicts, setActiveVerdicts] = useState<Set<Verdict>>(new Set());

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function toggleVerdict(v: Verdict) {
    setActiveVerdicts(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  }

  // Verdicts present in the data
  const presentVerdicts = useMemo(() =>
    ALL_VERDICTS.filter(v => rows.some(r => r.verdict === v)),
  [rows]);

  const filtered = useMemo(() =>
    activeVerdicts.size === 0 ? rows : rows.filter(r => activeVerdicts.has(r.verdict)),
  [rows, activeVerdicts]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sortKey === 'date')         { av = a.date; bv = b.date; }
      if (sortKey === 'employeeName') { av = a.employeeName; bv = b.employeeName; }
      if (sortKey === 'verdict')      { av = a.verdict; bv = b.verdict; }
      if (sortKey === 'minutesLate')  { av = a.minutesLate; bv = b.minutesLate; }
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      if (typeof av === 'number' && typeof bv === 'number')
        return sortDir === 'asc' ? av - bv : bv - av;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const Th = ({ label, col }: { label: string; col: SortKey }) => (
    <th
      onClick={() => toggleSort(col)}
      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none whitespace-nowrap bg-slate-50 border-b border-border hover:text-foreground"
    >
      {label}<SortIcon col={col} sortKey={sortKey} dir={sortDir} />
    </th>
  );

  return (
    <div>
      {/* Verdict filter chips — use shared VERDICT_LABEL for consistency */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {presentVerdicts.map(v => {
          const active = activeVerdicts.has(v);
          return (
            <button
              key={v}
              onClick={() => toggleVerdict(v)}
              className={[
                'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                active
                  ? `${VERDICT_BADGE[v]} border-current ring-1 ring-current`
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
              ].join(' ')}
            >
              {VERDICT_LABEL[v]}
              {' '}
              <span className="opacity-70">({rows.filter(r => r.verdict === v).length})</span>
            </button>
          );
        })}
        {activeVerdicts.size > 0 && (
          <button
            onClick={() => setActiveVerdicts(new Set())}
            className="px-2.5 py-1 rounded-full text-[11px] text-slate-400 hover:text-red-500 border border-transparent transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <Th label="Date"        col="date" />
                <Th label="Employee"    col="employeeName" />
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50 border-b border-border whitespace-nowrap">
                  Sched.
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50 border-b border-border whitespace-nowrap">
                  In / Out
                </th>
                <Th label="Late (min)" col="minutesLate" />
                <Th label="Verdict"    col="verdict" />
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50 border-b border-border whitespace-nowrap">
                  Form
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50 border-b border-border whitespace-nowrap">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={`${r.employeeId}-${r.date}`}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                >
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                    {fmtDate(r.date)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-medium text-sm">{r.employeeName}</span>
                    {r.role && <span className="ml-1.5 text-xs text-muted-foreground">{r.role}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {fmtTime(r.scheduledStart)}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap text-muted-foreground">
                    {fmtTime(r.entryTime)}{r.exitTime ? ` → ${fmtTime(r.exitTime)}` : ''}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-center">
                    {r.minutesLate > 0
                      ? <span className="text-amber-700 font-semibold">+{r.minutesLate}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${VERDICT_BADGE[r.verdict]}`}>
                      {VERDICT_LABEL[r.verdict]}
                    </span>
                    {/* Subtle flags */}
                    {r.flags.recordedUnexplainedButFormOnFile && (
                      <Info className="w-3 h-3 inline ml-1 text-slate-400"
                        title="Recorded as an unjustified absence even though a form was filed." />
                    )}
                    {r.flags.formEmailUnrecognised && (
                      <Info className="w-3 h-3 inline ml-1 text-slate-400"
                        title="Form submitted under a different email" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate">
                    {r.form
                      ? <span title={`${r.form.type}${r.form.reason ? ': ' + r.form.reason : ''}`}>
                          {r.form.type}{r.form.onTime ? ' ✓' : ' (late)'}
                        </span>
                      : r.coveredBy
                        ? <span className="text-slate-400">{r.coveredBy.label}</span>
                        : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400 max-w-[200px] truncate">
                    {r.flags.multipleForms && (
                      <span className="mr-1 text-slate-400">Multiple forms</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
          {sorted.length} row{sorted.length !== 1 ? 's' : ''}
          {activeVerdicts.size > 0 ? ` (filtered from ${rows.length})` : ''}
        </div>
      </div>
    </div>
  );
}
