import { useMemo } from 'react';
import { Info, AlertTriangle, Copy } from 'lucide-react';
import type { ReportRow, ReportSummary, Verdict } from '@/app/lib/attendanceReportTypes';

type Props = { rows: ReportRow[]; perEmployee: ReportSummary[] };

// ── Colour mapping ─────────────────────────────────────────────────────────────
type TileColor = 'success' | 'warning' | 'danger' | 'muted';

const VERDICT_COLOR: Record<Verdict, TileColor> = {
  on_time:                    'success',
  late_reported_on_time:      'warning',
  absent_reported_on_time:    'success',
  late_reported_late:         'warning',
  absent_reported_late:       'warning',
  late_no_form:               'danger',
  unexplained_absence:        'danger',
  pto:                        'muted',
  permission:                 'muted',
  holiday:                    'muted',
  not_processed:              'muted',
};

const TILE_BG: Record<TileColor, string> = {
  success: 'bg-green-100 border-green-300 text-green-800',
  warning: 'bg-amber-100 border-amber-300 text-amber-800',
  danger:  'bg-red-100 border-red-300 text-red-800',
  muted:   'bg-slate-100 border-slate-300 text-slate-500',
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

// Short label for the narrow tile (≤80px); full label in tooltip
const VERDICT_TILE_SHORT: Record<Verdict, string> = {
  on_time:                 'On time',
  late_reported_on_time:   'Late',
  late_reported_late:      'Late',
  late_no_form:            'Late — no form',
  absent_reported_on_time: 'Absent',
  absent_reported_late:    'Absent',
  unexplained_absence:     'Absent — unexplained',
  pto:                     'PTO',
  permission:              'Permission',
  holiday:                 'Holiday',
  not_processed:           'Not run yet',
};

function fmtDate(d: string) {
  // YYYY-MM-DD → "Mon Jun 2"
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

// ── Tile ──────────────────────────────────────────────────────────────────────
function DayTile({ row }: { row: ReportRow }) {
  const color  = VERDICT_COLOR[row.verdict];
  const bgCls  = TILE_BG[color];
  const short  = VERDICT_TILE_SHORT[row.verdict];
  const full   = VERDICT_LABEL[row.verdict];

  return (
    <div
      className={`relative border rounded-lg px-2 py-1.5 flex flex-col gap-0.5 text-[11px] leading-snug min-w-[80px] ${bgCls}`}
      title={full}
    >
      <span className="font-semibold">{fmtDate(row.date)}</span>
      <span className="opacity-80">{short}</span>
      {row.entryTime && (
        <span className="tabular-nums opacity-70">in {fmtTime(row.entryTime)}</span>
      )}
      {row.minutesLate > 0 && (
        <span className="font-medium">+{row.minutesLate}m late</span>
      )}
      {row.form && (
        <span className="opacity-60 truncate">
          Form: {row.form.type}
        </span>
      )}
      {/* Subtle flags */}
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
function EmployeeCard({ summary, rows }: { summary: ReportSummary; rows: ReportRow[] }) {
  // Sort rows by date
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  const rateColor = summary.onTimeRate === null ? 'text-slate-400'
    : summary.onTimeRate >= 90 ? 'text-green-600'
    : summary.onTimeRate >= 75 ? 'text-amber-600'
    : 'text-red-600';

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
      <div className="flex flex-wrap gap-1.5">
        {sorted.map(r => <DayTile key={r.date + r.employeeId} row={r} />)}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function AttendanceReportStrips({ rows, perEmployee }: Props) {
  // Group rows by employeeId
  const byEmp = useMemo(() => {
    const m = new Map<number, ReportRow[]>();
    for (const r of rows) {
      const arr = m.get(r.employeeId) ?? [];
      arr.push(r);
      m.set(r.employeeId, arr);
    }
    return m;
  }, [rows]);

  // Sort summaries by name
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
        />
      ))}
    </div>
  );
}
