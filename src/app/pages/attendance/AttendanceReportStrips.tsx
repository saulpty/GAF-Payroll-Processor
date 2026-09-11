import { useMemo } from 'react';
import { Info, AlertTriangle, Copy } from 'lucide-react';
import type { ReportRow, ReportSummary, Verdict } from '@/app/lib/attendanceReportTypes';
import { fmtDay } from '@/app/lib/fmtDay';

type Props = { rows: ReportRow[]; perEmployee: ReportSummary[] };

// ── Tone system ────────────────────────────────────────────────────────────────
type Tone = 'green' | 'amber' | 'orange' | 'red' | 'sky' | 'grey';

const VERDICT_TONE: Record<Verdict, Tone> = {
  on_time:                 'green',
  late_reported_on_time:   'amber',
  absent_reported_on_time: 'sky',
  late_reported_late:      'orange',
  absent_reported_late:    'orange',
  late_no_form:            'red',
  unexplained_absence:     'red',
  pto:                     'grey',
  permission:              'grey',
  holiday:                 'grey',
  not_processed:           'grey',
};

const TONE: Record<Tone, { stripe: string; dot: string; text: string; pill: string }> = {
  green:  { stripe: 'border-t-green-500',  dot: 'bg-green-500',  text: 'text-green-700',  pill: 'bg-green-50 text-green-700 border-green-200' },
  amber:  { stripe: 'border-t-amber-500',  dot: 'bg-amber-500',  text: 'text-amber-700',  pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  orange: { stripe: 'border-t-orange-500', dot: 'bg-orange-500', text: 'text-orange-700', pill: 'bg-orange-50 text-orange-700 border-orange-200' },
  red:    { stripe: 'border-t-red-500',    dot: 'bg-red-500',    text: 'text-red-700',    pill: 'bg-red-50 text-red-700 border-red-200' },
  sky:    { stripe: 'border-t-sky-500',    dot: 'bg-sky-500',    text: 'text-sky-700',    pill: 'bg-sky-50 text-sky-700 border-sky-200' },
  grey:   { stripe: 'border-t-slate-300',  dot: 'bg-slate-400',  text: 'text-slate-500',  pill: 'bg-slate-50 text-slate-600 border-slate-200' },
};

// Full wording shared across all three surfaces (tile, chip, badge)
export const VERDICT_LABEL: Record<Verdict, string> = {
  on_time:                 'On time',
  late_reported_on_time:   'Late — reported ahead',
  late_reported_late:      'Late — form sent after shift',
  late_no_form:            'Late — no form',
  absent_reported_on_time: 'Absent — reported ahead',
  absent_reported_late:    'Absent — reported after shift',
  unexplained_absence:     'Absent — unexplained',
  pto:                     'PTO',
  permission:              'Permission',
  holiday:                 'Holiday',
  not_processed:           'Payroll not run yet',
};

// Card wording (title case, shorter than VERDICT_LABEL)
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

/** Times from payroll_entries are already US Eastern wall clock in
 *  "H:MM AM" / "H:MM PM" form (AGENTS.md). They are displayed as stored. */
function fmtTime(t: string | null) {
  const s = (t ?? '').trim();
  return s === '' ? '—' : s;
}

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
      className={`relative w-[170px] shrink-0 bg-white border border-slate-200 border-t-[3px] ${t.stripe} rounded-lg px-2.5 pt-1.5 pb-2 shadow-sm text-[11px] leading-snug`}
      title={VERDICT_LABEL[row.verdict]}
    >
      {/* Date */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{wd}</span>
        <span className="text-[14px] font-bold text-slate-900">{md}</span>
      </div>

      {/* Status label */}
      <div className={`flex items-center gap-1.5 font-semibold mb-1 whitespace-nowrap ${t.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />
        {CARD_LABEL[row.verdict]}
      </div>

      {/* Time line */}
      {row.entryTime ? (
        <div className="tabular-nums text-slate-900 whitespace-nowrap">
          {fmtTime(row.entryTime)} <span className="text-slate-400">→</span>{' '}
          {row.exitTime ? fmtTime(row.exitTime) : <span className="text-slate-400">no exit</span>}
        </div>
      ) : (
        <div className="text-slate-400">{row.coveredBy ? row.coveredBy.label : 'no punches'}</div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-1.5 mt-1.5 min-h-[18px]">
        {row.minutesLate > 0 && (
          <span className={`rounded-full border px-1.5 py-px text-[10px] font-bold ${t.pill}`}>+{row.minutesLate}m</span>
        )}
        {row.form && (
          <span className="text-slate-500 truncate" title={row.form.onTime ? 'Form sent before the shift' : 'Form sent after the shift'}>
            {row.form.onTime ? '✓' : '⚠'} {row.form.type}
          </span>
        )}
      </div>

      {/* Subtle flags — top-right / bottom-right */}
      {(row.flags.recordedUnexplainedButFormOnFile || row.flags.formEmailUnrecognised) && (
        <span className="absolute top-1 right-1">
          <Info className="w-3 h-3 text-slate-400" title={
            row.flags.recordedUnexplainedButFormOnFile
              ? 'Recorded as an unjustified absence even though a form was filed.'
              : 'Form submitted by a different email'
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
    : summary.onTimeRate >= 90 ? 'text-green-600'
    : summary.onTimeRate >= 75 ? 'text-amber-600'
    : 'text-red-600';

  // Average minutes late across late days
  const lateRows = rows.filter(r => r.verdict.startsWith('late'));
  const avgLate = lateRows.length > 0
    ? Math.round(lateRows.reduce((s, r) => s + (r.minutesLate ?? 0), 0) / lateRows.length)
    : null;

  return (
    <div className="bg-white border border-border rounded-xl shadow-sm p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <span className="font-semibold text-sm text-foreground">{summary.employeeName}</span>
          <span className="ml-2 text-xs text-muted-foreground">{summary.role}</span>
          {summary.manager && (
            <span className="ml-2 text-xs text-slate-400">• {summary.manager}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{summary.expectedDays} days</span>
          {summary.lateDays > 0 && (
            <span className="text-amber-600 font-medium">
              <AlertTriangle className="w-3 h-3 inline mr-0.5" />
              {summary.lateDays} late
            </span>
          )}
          {avgLate !== null && (
            <span className="text-amber-600">avg +{avgLate}m</span>
          )}
          {summary.unexplainedAbsences > 0 && (
            <span className="text-red-600 font-medium">
              {summary.unexplainedAbsences} absent
            </span>
          )}
          {summary.onTimeRate !== null && (
            <span className={`font-bold ${rateColor}`}>{Math.round(summary.onTimeRate)}% on-time</span>
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
