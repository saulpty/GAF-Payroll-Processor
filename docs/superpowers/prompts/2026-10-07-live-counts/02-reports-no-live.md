# Count unprocessed days, step 2 of 4: Reports without Live tags

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Saul (2026-10-07): days payroll hasn't processed must **count in every total exactly as payroll
would count them** (late / on time from Teramind; Monday form / PTO / holiday as usual; a past
workday with no punches and nothing on file = absent; today counts only once someone has punched
in), and the **Live pills and notes go** — they were confusing. When payroll processes a day, its
row replaces the Teramind stand-in automatically.

Report cards and table rows look like any processed day: no dashed border, no Live tag, no live
label. The Warm look stays.

**Only these two files may change** (whole files below, in `src/app/pages/attendance/`):
`AttendanceReportStrips.tsx`, `AttendanceReportTable.tsx`. No other file may be touched.

## `src/app/pages/attendance/AttendanceReportStrips.tsx` (whole file)

```tsx
import { useMemo } from 'react';
import { Info, AlertTriangle, Copy } from 'lucide-react';
import type { ReportRow, ReportSummary, Verdict } from '@/app/lib/attendanceReportTypes';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtTime } from '@/app/lib/fmtTime';
import { fmtDuration } from '@/app/lib/teramindToday';

type Props = { rows: ReportRow[]; perEmployee: ReportSummary[] };

// ── Tone system: Excel colours (on time green, late yellow, absent red, away blue) ──
type Tone = 'green' | 'yellow' | 'red' | 'blue' | 'orange' | 'grey';

const VERDICT_TONE: Record<Verdict, Tone> = {
  on_time:                 'green',
  late_reported_on_time:   'yellow',
  late_reported_late:      'yellow',
  late_no_form:            'yellow',
  absent_reported_on_time: 'blue',
  absent_reported_late:    'orange',
  unexplained_absence:     'red',
  pto:                     'blue',
  permission:              'blue',
  holiday:                 'grey',
  not_processed:           'grey',
};

const TONE: Record<Tone, { stripe: string; dot: string; text: string; pill: string }> = {
  green:  { stripe: 'border-t-status-green-ink',  dot: 'bg-status-green-ink',  text: 'text-status-green-ink',  pill: 'bg-status-green-fill text-status-green-ink border-transparent' },
  yellow: { stripe: 'border-t-status-yellow-ink', dot: 'bg-status-yellow-ink', text: 'text-status-yellow-ink', pill: 'bg-status-yellow-fill text-status-yellow-ink border-transparent' },
  red:    { stripe: 'border-t-status-red-ink',    dot: 'bg-status-red-ink',    text: 'text-status-red-ink',    pill: 'bg-status-red-fill text-status-red-ink border-transparent' },
  blue:   { stripe: 'border-t-blue-500',          dot: 'bg-blue-500',          text: 'text-blue-700',          pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  orange: { stripe: 'border-t-orange-500',        dot: 'bg-orange-500',        text: 'text-orange-700',        pill: 'bg-orange-100 text-orange-800 border-transparent' },
  grey:   { stripe: 'border-t-slate-300',         dot: 'bg-slate-400',         text: 'text-slate-500',         pill: 'bg-slate-50 text-slate-600 border-slate-200' },
};

// Full wording shared by the table chips and the card tooltips (Title Case)
export const VERDICT_LABEL: Record<Verdict, string> = {
  on_time:                 'On Time',
  late_reported_on_time:   'Late — Reported Ahead',
  late_reported_late:      'Late — Form Sent After Shift',
  late_no_form:            'Late — No Form',
  absent_reported_on_time: 'Absent — Reported Ahead',
  absent_reported_late:    'Absent — Reported After Shift',
  unexplained_absence:     'Absent — Unexplained',
  pto:                     'PTO',
  permission:              'Permission',
  holiday:                 'Holiday',
  not_processed:           'Payroll Not Run Yet',
};

// Card wording (Title Case, shorter than VERDICT_LABEL)
const CARD_LABEL: Record<Verdict, string> = {
  on_time:                 'On Time',
  late_reported_on_time:   'Late · Reported Ahead',
  late_reported_late:      'Late · Reported After Shift',
  late_no_form:            'Late · No Form',
  absent_reported_on_time: 'Absent · Reported Ahead',
  absent_reported_late:    'Absent · Reported After Shift',
  unexplained_absence:     'Absent · Unexplained',
  pto:                     'PTO',
  permission:              'Permission',
  holiday:                 'Holiday',
  not_processed:           'Not Run Yet',
};

/** House minutes format: '45 min', '1h 15m'. */
const fmtMins = (m: number): string => (m < 60 ? `${m} min` : fmtDuration(m));

/** Payroll times are US Eastern "H:MM AM" text; fmtTime reshapes them ('9:54AM'). */
const time = (t: string | null) => fmtTime(t) || '—';

// ── Tile ──────────────────────────────────────────────────────────────────────
function DayTile({ row, thisYear }: { row: ReportRow; thisYear: string }) {
  const t = TONE[VERDICT_TONE[row.verdict]];

  // Split "Mon Aug 10" into weekday and month-day — no Date object
  const dayStr = fmtDay(row.date, thisYear);
  const spaceIdx = dayStr.indexOf(' ');
  const wd = spaceIdx >= 0 ? dayStr.slice(0, spaceIdx) : dayStr;
  const md = spaceIdx >= 0 ? dayStr.slice(spaceIdx + 1) : '';

  return (
    <div
      className={`relative w-[170px] shrink-0 bg-white border border-slate-200 border-t-[3px] ${t.stripe} rounded-md px-2.5 pt-1.5 pb-2 shadow-card text-[11px] leading-snug`}
      title={VERDICT_LABEL[row.verdict]}
    >
      {/* Date */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-[11px] font-semibold text-slate-500">{wd}</span>
        <span className="text-[14px] font-bold text-slate-900">{md}</span>
      </div>

      {/* Status label */}
      <div className={`flex items-center gap-1.5 font-semibold mb-1 whitespace-nowrap ${t.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />
        <span className="truncate">{CARD_LABEL[row.verdict]}</span>
      </div>

      {/* Time line */}
      {row.entryTime ? (
        <div className="tabular-nums text-slate-900 whitespace-nowrap">
          {time(row.entryTime)} <span className="text-slate-400">→</span>{' '}
          {row.exitTime ? time(row.exitTime) : <span className="text-slate-400">no exit</span>}
        </div>
      ) : (
        <div className="text-slate-500">{row.coveredBy ? row.coveredBy.label : 'No punches'}</div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-1.5 mt-1.5 min-h-[18px]">
        {row.minutesLate > 0 && (
          <span className={`rounded-full border px-1.5 py-px text-[11px] font-semibold ${t.pill}`}>+{fmtMins(row.minutesLate)}</span>
        )}
        {row.form && (
          <span className="text-slate-500 truncate" title={row.form.onTime ? 'Form sent before the shift' : 'Form sent after the shift'}>
            {row.form.onTime ? '✓' : '⚠'} {row.form.type}
          </span>
        )}
      </div>

      {/* Subtle flags — bottom-right */}
      {(row.flags.recordedUnexplainedButFormOnFile || row.flags.formEmailUnrecognised || row.flags.excusedInPayrollNoRequest) && (
        <span className="absolute bottom-1 right-5">
          <Info className="w-3 h-3 text-slate-400" title={
            row.flags.recordedUnexplainedButFormOnFile
              ? 'Recorded as an unjustified absence even though a form was filed.'
              : row.flags.formEmailUnrecognised
                ? 'Form submitted by a different email'
                : 'Excused in payroll, no Monday request found'
          } />
        </span>
      )}
      {row.flags.multipleForms && (
        <span className="absolute bottom-1 right-1">
          <Copy className="w-3 h-3 text-slate-400" title="Multiple forms submitted" />
        </span>
      )}
    </div>
  );
}

// ── Employee card ─────────────────────────────────────────────────────────────
function EmployeeCard({ summary, rows, thisYear }: { summary: ReportSummary; rows: ReportRow[]; thisYear: string }) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  const rateColor = summary.onTimeRate === null ? 'text-slate-400'
    : summary.onTimeRate >= 90 ? 'text-status-green-ink'
    : summary.onTimeRate >= 75 ? 'text-status-yellow-ink'
    : 'text-status-red-ink';

  // Average minutes late across late days
  const lateRows = rows.filter(r => r.verdict.startsWith('late'));
  const avgLate = lateRows.length > 0
    ? Math.round(lateRows.reduce((s, r) => s + (r.minutesLate ?? 0), 0) / lateRows.length)
    : null;

  return (
    <div className="bg-white border border-border rounded-lg shadow-card p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <span className="font-semibold text-sm text-foreground">{summary.employeeName}</span>
          <span className="ml-2 text-xs text-muted-foreground">{summary.role}</span>
          {summary.manager && (
            <span className="ml-2 text-xs text-slate-500">• {summary.manager}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{summary.expectedDays} days</span>
          {summary.lateDays > 0 && (
            <span className="text-status-yellow-ink font-medium">
              <AlertTriangle className="w-3 h-3 inline mr-0.5" />
              {summary.lateDays} late
            </span>
          )}
          {avgLate !== null && (
            <span className="text-status-yellow-ink">avg +{fmtMins(avgLate)}</span>
          )}
          {summary.unexplainedAbsences > 0 && (
            <span className="text-status-red-ink font-medium">
              {summary.unexplainedAbsences} absent
            </span>
          )}
          {summary.onTimeRate !== null && (
            <span className={`font-bold ${rateColor}`}>{Math.round(summary.onTimeRate)}% on time</span>
          )}
        </div>
      </div>

      {/* Tile grid */}
      <div className="flex flex-wrap gap-2">
        {sorted.map(r => <DayTile key={r.date + r.employeeId} row={r} thisYear={thisYear} />)}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function AttendanceReportStrips({ rows, perEmployee }: Props) {
  const byEmp = useMemo(() => {
    const m = new Map<number, ReportRow[]>();
    for (const r of rows) {
      const arr = m.get(r.employeeId) ?? [];
      arr.push(r);
      m.set(r.employeeId, arr);
    }
    return m;
  }, [rows]);

  const thisYear = rows.length > 0 ? rows[0].date.slice(0, 4) : '';

  const sorted = [...perEmployee].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName),
  );

  return (
    <div>
      {sorted.map(s => (
        <EmployeeCard
          key={s.employeeId}
          summary={s}
          rows={byEmp.get(s.employeeId) ?? []}
          thisYear={thisYear}
        />
      ))}
    </div>
  );
}
```

## `src/app/pages/attendance/AttendanceReportTable.tsx` (whole file)

```tsx
import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Info } from 'lucide-react';
import type { ReportRow, Verdict } from '@/app/lib/attendanceReportTypes';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtTime } from '@/app/lib/fmtTime';
import { VERDICT_LABEL } from './AttendanceReportStrips';
import { fmtDuration } from '@/app/lib/teramindToday';

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

/** House minutes format: '45 min', '1h 15m'. */
const fmtMins = (m: number): string => (m < 60 ? `${m} min` : fmtDuration(m));

/** In / Out cell. A day still in progress has no exit yet. */
function inOut(r: ReportRow): string {
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
```

## Report
- Byte size of both files; confirm no other file changed; Reports renders in Cards and Table with no console errors.
