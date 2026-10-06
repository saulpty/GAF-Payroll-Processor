import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Info } from 'lucide-react';
import type { ReportRow, Verdict } from '@/app/lib/attendanceReportTypes';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtTime } from '@/app/lib/fmtTime';
import { VERDICT_LABEL } from './AttendanceReportStrips';
import LiveBadge, { fmtMins, liveInOut, liveLabelCls } from './LiveBadge';
import WhyChipBadge from './activity/WhyChipBadge';

type Props = { rows: ReportRow[] };

// Excel colours: on time green, late yellow, unexplained absence red, time off / permission blue.
// Reported absences keep their earlier colours (Saul's call): ahead blue, after the shift orange.
const VERDICT_BADGE: Record<Verdict, string> = {
  on_time:                 'bg-status-green-fill text-status-green-ink',
  late_reported_on_time:   'bg-status-yellow-fill text-status-yellow-ink',
  late_reported_late:      'bg-status-yellow-fill text-status-yellow-ink',
  late_no_form:            'bg-status-yellow-fill text-status-yellow-ink',
  absent_reported_on_time: 'bg-blue-50 text-blue-700',
  absent_reported_late:    'bg-orange-100 text-orange-800',
  unexplained_absence:     'bg-status-red-fill text-status-red-ink',
  pto:                     'bg-blue-50 text-blue-700',
  permission:              'bg-blue-50 text-blue-700',
  holiday:                 'bg-slate-100 text-slate-600',
  not_processed:           'bg-slate-100 text-slate-500',
};

type SortKey = 'date' | 'employeeName' | 'verdict' | 'minutesLate';
type Dir = 'asc' | 'desc';

const ALL_VERDICTS: Verdict[] = [
  'on_time', 'late_reported_on_time', 'late_reported_late',
  'late_no_form', 'absent_reported_on_time', 'absent_reported_late',
  'unexplained_absence', 'pto', 'permission', 'holiday', 'not_processed',
];

/** Payroll times are US Eastern "H:MM AM" text; fmtTime only reshapes them ('9:54AM'). */
const time = (t: string | null) => fmtTime(t) || '—';

/** In / Out cell. Live days use Teramind: exit 'so far' while in progress, '+1d' past midnight. */
function inOut(r: ReportRow): string {
  if (r.live) {
    if (r.live.kind !== 'worked') return '—';
    const { entry, exit } = liveInOut(r.live);
    return exit ? `${entry} → ${exit}` : entry;
  }
  return `${time(r.entryTime)}${r.exitTime ? ` → ${time(r.exitTime)}` : ''}`;
}

const TH = 'px-3 py-2.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-border whitespace-nowrap';

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: Dir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-warm-text" />
    : <ChevronDown className="w-3 h-3 inline ml-0.5 text-warm-text" />;
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

  const thisYear = rows.length > 0 ? rows[0].date.slice(0, 4) : '';

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
      className={`${TH} cursor-pointer select-none hover:text-foreground`}
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
                'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
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
            className="px-2.5 py-1 rounded-full text-xs text-slate-500 hover:text-status-red-ink border border-transparent transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <Th label="Date"        col="date" />
                <Th label="Employee"    col="employeeName" />
                <th className={TH}>Scheduled</th>
                <th className={TH}>In / Out</th>
                <Th label="Late"       col="minutesLate" />
                <Th label="Verdict"    col="verdict" />
                <th className={TH}>Form</th>
                <th className={TH}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr
                  key={`${r.employeeId}-${r.date}`}
                  className="border-b border-border/60 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                    {fmtDay(r.date, thisYear)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-medium text-sm">{r.employeeName}</span>
                    {r.role && <span className="ml-1.5 text-xs text-muted-foreground">{r.role}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {time(r.scheduledStart)}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap text-muted-foreground">
                    {inOut(r)}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-right whitespace-nowrap">
                    {r.minutesLate > 0
                      ? <span className="text-status-yellow-ink font-semibold">{fmtMins(r.minutesLate)}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.live ? (
                      <span className="inline-flex items-center gap-1.5">
                        <LiveBadge />
                        <span className={`text-[11px] font-semibold ${liveLabelCls(r.live)}`}>{r.live.label}</span>
                        {r.live.kind === 'worked' && r.live.why && <WhyChipBadge chip={r.live.why} />}
                      </span>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${VERDICT_BADGE[r.verdict]}`}>
                        {VERDICT_LABEL[r.verdict]}
                      </span>
                    )}
                    {/* Subtle flags */}
                    {r.flags.recordedUnexplainedButFormOnFile && (
                      <Info className="w-3 h-3 inline ml-1 text-slate-400"
                        title="Recorded as an unjustified absence even though a form was filed." />
                    )}
                    {r.flags.formEmailUnrecognised && (
                      <Info className="w-3 h-3 inline ml-1 text-slate-400"
                        title="Form submitted under a different email" />
                    )}
                    {r.flags.excusedInPayrollNoRequest && (
                      <Info className="w-3 h-3 inline ml-1 text-slate-400"
                        title="Excused in payroll — no Monday request found" />
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
                      <span className="mr-1 text-slate-500">Multiple forms</span>
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
