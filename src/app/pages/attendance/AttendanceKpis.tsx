import { CompanyKpis } from '@/app/lib/attendanceStats';

type Tone = 'lead' | 'alert' | 'plain';
type Props = { kpis: CompanyKpis };

function Kpi({
  label, value, sub, color, tone = 'plain', tooltip,
}: {
  label: string; value: string; sub?: string; color?: string; tone?: Tone; tooltip?: string;
}) {
  const cardCls = tone === 'lead'
    ? 'bg-white rounded-lg border border-primary p-3 shadow-[inset_3px_0_0_var(--primary)] min-w-0'
    : 'bg-white rounded-lg border border-border p-3 shadow-card min-w-0';

  const valueCls = tone === 'plain'
    ? 'text-2xl font-bold tracking-tight leading-none tabular-nums mb-0.5 text-foreground'
    : `text-2xl font-bold tracking-tight leading-none tabular-nums mb-0.5 ${color ?? ''}`;

  return (
    <div className={cardCls}>
      <div
        className="text-xs font-semibold text-slate-600 mb-1 truncate cursor-default"
        title={tooltip}
        tabIndex={tooltip ? 0 : undefined}
        aria-label={tooltip ? `${label}: ${tooltip}` : undefined}
      >
        {label}{tooltip && <span className="ml-0.5 opacity-50">ⓘ</span>}
      </div>
      <div className={valueCls}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground truncate phone:whitespace-normal phone:text-xs">{sub}</div>}
    </div>
  );
}

export function AttendanceKpis({ kpis }: Props) {
  // Absences with and without a form: each total minus its late days. No new counting.
  const absentReported = kpis.reported - kpis.lateReported;
  const absentNot = kpis.unreported - kpis.lateUnreported;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Kpi
          label="On-Time Rate"
          value={`${kpis.onTimeRate.toFixed(1)}%`}
          sub={`${kpis.onTime} of ${kpis.daysTracked} Expected Days`}
          tone="lead"
          color="text-secondary"
          tooltip="On-time days divided by expected days (on time + late + absent). Time off and permissions are not counted either way."
        />
        <Kpi
          label="Late Days"
          value={`${kpis.lateDays}`}
          sub={`${kpis.lateReported} Reported · ${kpis.lateUnreported} Not`}
          tone="alert"
          color="text-status-yellow-ink"
          tooltip="Days someone clocked in after their shift start. Reported means a GAF Attendance form is on file for the day."
        />
        <Kpi
          label="Absent Days"
          value={`${kpis.absent}`}
          sub={`${absentReported} Reported · ${absentNot} Not`}
          tone="alert"
          color="text-status-red-ink"
          tooltip="Scheduled to work with no clock-in and no time off or permission covering the day. Reported means a GAF Attendance form is on file for the day."
        />
        <Kpi
          label="Avg Min Late"
          value={`${kpis.avgMinLate.toFixed(1)}m`}
          sub="Per Late Day"
          tone="plain"
          tooltip="Average minutes late across the late days only. On-time days and absences are not included."
        />
        <Kpi
          label="Time Off & Permission"
          value={`${kpis.excused + kpis.permission}`}
          sub={`${kpis.excused} Time Off · ${kpis.permission} Permission`}
          tone="plain"
          tooltip="Approved days away (PTO, company holidays, birthday and compensatory days) and approved permissions. These never count for or against the score."
        />
      </div>
    </div>
  );
}
