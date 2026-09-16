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
    : 'bg-white rounded-lg border border-border p-3 shadow-sm min-w-0';

  const valueCls = tone === 'plain'
    ? 'text-2xl font-bold tracking-tight leading-none tabular-nums mb-0.5 text-foreground'
    : `text-2xl font-bold tracking-tight leading-none tabular-nums mb-0.5 ${color ?? ''}`;

  return (
    <div className={cardCls}>
      <div
        className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 truncate cursor-default"
        title={tooltip}
        tabIndex={tooltip ? 0 : undefined}
        aria-label={tooltip ? `${label}: ${tooltip}` : undefined}
      >
        {label}{tooltip && <span className="ml-0.5 opacity-50">ⓘ</span>}
      </div>
      <div className={valueCls}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

export function AttendanceKpis({ kpis }: Props) {
  const totalCheck = kpis.onTime + kpis.lateDays + kpis.absent + kpis.excused + kpis.permission;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-2 mb-1">
        <Kpi
          label="On-Time Rate"
          value={`${kpis.onTimeRate.toFixed(1)}%`}
          sub={`${kpis.onTime} of ${kpis.daysTracked} Expected`}
          tone="lead"
          color="text-secondary"
          tooltip="On-time days divided by expected days (on time + late + absent). Time off and permissions are not counted either way."
        />
        <Kpi
          label="Late Rate"
          value={`${kpis.lateRate.toFixed(1)}%`}
          sub={`${kpis.lateDays} of ${kpis.daysTracked} Expected`}
          tone="alert"
          color="text-amber-600"
          tooltip="Late days divided by expected days (on time + late + absent)."
        />
        <Kpi
          label="Work Days"
          value={`${kpis.workDays}`}
          sub="Scheduled Shifts"
          tone="plain"
          tooltip="Every day someone was scheduled on their shift in this range, including time off and permissions."
        />
        <Kpi
          label="Late Days"
          value={`${kpis.lateDays}`}
          sub={`${kpis.lateReported} Reported · ${kpis.lateUnreported} Not`}
          tone="plain"
          tooltip="Days someone clocked in after their shift start."
        />
        <Kpi
          label="Avg Min Late"
          value={`${kpis.avgMinLate.toFixed(1)}m`}
          sub="Per Late Day"
          tone="plain"
          tooltip="Average minutes late across the late days only. On-time days and absences are not included."
        />
        <Kpi
          label="Absent Days"
          value={`${kpis.absent}`}
          sub="Reported or Not"
          tone="alert"
          color="text-[#B91C1C]"
          tooltip="Scheduled to work with no clock-in and no time off or permission covering the day, whether or not a form was filed."
        />
        <Kpi
          label="Reported"
          value={`${kpis.reported}`}
          sub="Late/Absent, Form Filed"
          tone="plain"
          tooltip="Late or absent days with an attendance form on file."
        />
        <Kpi
          label="Unreported"
          value={`${kpis.unreported}`}
          sub="Late/Absent, No Form"
          tone="alert"
          color="text-destructive"
          tooltip="Late or absent days with no attendance form on file."
        />
        <Kpi
          label="Time Off"
          value={`${kpis.excused}`}
          sub="PTO, Holidays"
          tone="plain"
          tooltip="Approved days away: PTO, company holidays, birthday and compensatory days. These never affect the score."
        />
        <Kpi
          label="Permission"
          value={`${kpis.permission}`}
          sub="Approved"
          tone="plain"
          tooltip="An approved permission covered the day. Does not affect the score."
        />
      </div>
      <div className="text-[10px] text-muted-foreground px-1">
        On-Time ({kpis.onTime}) + Late ({kpis.lateDays}) + Absent ({kpis.absent}) + Time off ({kpis.excused}) + Permission ({kpis.permission}) = {totalCheck} = Work Days ({kpis.workDays})
      </div>
    </div>
  );
}
