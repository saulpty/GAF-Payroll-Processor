import { useMemo } from 'react';
import { Info, AlertTriangle, Copy } from 'lucide-react';
import type { ReportRow, ReportSummary, Verdict, LiveInfo } from '@/app/lib/attendanceReportTypes';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtTime } from '@/app/lib/fmtTime';
import LiveBadge, { fmtMins, liveInOut } from './LiveBadge';

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

/** Live day tone: late yellow, worked green, a reason (PTO, form…) blue, no records grey. */
function liveTone(l: LiveInfo): Tone {
  if (l.kind === 'worked') return l.minutesLate > 0 ? 'yellow' : 'green';
  return l.kind === 'reason' ? 'blue' : 'grey';
}

/** Payroll times are US Eastern "H:MM AM" text; fmtTime reshapes them ('9:54AM'). */
const time = (t: string | null) => fmtTime(t) || '—';

// ── Tile ──────────────────────────────────────────────────────────────────────
function DayTile({ row, thisYear }: { row: ReportRow; thisYear: string }) {
  const live = row.live ?? null;
  const t = TONE[live ? liveTone(live) : VERDICT_TONE[row.verdict]];

  // Split "Mon Aug 10" into weekday and month-day — no Date object
  const dayStr = fmtDay(row.date, thisYear);
  const spaceIdx = dayStr.indexOf(' ');
  const wd = spaceIdx >= 0 ? dayStr.slice(0, spaceIdx) : dayStr;
  const md = spaceIdx >= 0 ? dayStr.slice(spaceIdx + 1) : '';

  // Live days: dashed border = not official yet
  const frame = live ? 'border-dashed border-slate-400' : 'border-slate-200';
  const liveTimes = live && live.kind === 'worked' ? liveInOut(live) : null;

  return (
    <div
      className={`relative w-[170px] shrink-0 bg-white border ${frame} border-t-[3px] ${t.stripe} rounded-md px-2.5 pt-1.5 pb-2 shadow-card text-[11px] leading-snug`}
      title={live ? `Live: ${live.label}` : VERDICT_LABEL[row.verdict]}
    >
      {/* Date */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-[11px] font-semibold text-slate-500">{wd}</span>
        <span className="text-[14px] font-bold text-slate-900">{md}</span>
        {live && <span className="ml-auto self-center"><LiveBadge /></span>}
      </div>

      {/* Status label */}
      <div className={`flex items-center gap-1.5 font-semibold mb-1 whitespace-nowrap ${t.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />
        <span className="truncate">{live ? live.label : CARD_LABEL[row.verdict]}</span>
      </div>

      {/* Time line */}
      {liveTimes ? (
        <div className="tabular-nums text-slate-900 whitespace-nowrap">
          {liveTimes.entry} <span className="text-slate-400">→</span>{' '}
          {liveTimes.exit || <span className="text-slate-400">no exit</span>}
        </div>
      ) : live ? (
        <div className="text-slate-500 truncate">{live.kind === 'reason' ? 'No punches' : 'No Teramind records'}</div>
      ) : row.entryTime ? (
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

  // Average minutes late across official late days (live days never count)
  const lateRows = rows.filter(r => !r.live && r.verdict.startsWith('late'));
  const avgLate = lateRows.length > 0
    ? Math.round(lateRows.reduce((s, r) => s + (r.minutesLate ?? 0), 0) / lateRows.length)
    : null;
  const liveDays = rows.filter(r => r.live).length;

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
          {liveDays > 0 && (
            <LiveBadge count={liveDays}
              title={`${liveDays} day${liveDays === 1 ? '' : 's'} not processed yet, shown from Teramind. Not counted in any number.`} />
          )}
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
