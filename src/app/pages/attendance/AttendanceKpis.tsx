import { CompanyKpis } from '@/app/lib/attendanceStats';

type Tone = 'lead' | 'alert' | 'plain';
type Props = { kpis: CompanyKpis };

function Kpi({
  label, value, sub, color, tone = 'plain',
}: {
  label: string; value: string; sub?: string; color?: string; tone?: Tone;
}) {
  const cardCls = tone === 'lead'
    ? 'bg-white rounded-lg border border-primary p-3 shadow-[inset_3px_0_0_var(--primary)] min-w-0'
    : 'bg-white rounded-lg border border-border p-3 shadow-sm min-w-0';

  const valueCls = tone === 'plain'
    ? 'text-2xl font-bold tracking-tight leading-none tabular-nums mb-0.5 text-foreground'
    : `text-2xl font-bold tracking-tight leading-none tabular-nums mb-0.5 ${color ?? ''}`;

  return (
    <div className={cardCls}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 truncate">{label}</div>
      <div className={valueCls}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

export function AttendanceKpis({ kpis }: Props) {
  const totalCheck = kpis.onTime + kpis.lateReported + kpis.lateUnreported + kpis.absent;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-1">
        <Kpi label="On-Time Rate"      value={`${kpis.onTimeRate.toFixed(1)}%`}    sub={`${kpis.onTime} of ${kpis.daysTracked}`} tone="lead"  color="text-secondary" />
        <Kpi label="Late — Reported"   value={`${kpis.lateReported}`}              sub="GAF filed"                                tone="plain" />
        <Kpi label="Late — Unreported" value={`${kpis.lateUnreported}`}            sub="no GAF"                                   tone="alert" color="text-destructive" />
        <Kpi label="Absent"            value={`${kpis.absent}`}                    sub="Unexplained"                              tone="alert" color="text-[#B91C1C]" />
        <Kpi label="Excused"           value={`${kpis.excused}`}                   sub="PTO / Holiday"                            tone="plain" />
        <Kpi label="Permission"        value={`${kpis.permission}`}                sub="Approved"                                 tone="plain" />
        <Kpi label="Avg Min Late"      value={`${kpis.avgMinLate.toFixed(1)}m`}    sub="per day worked"                           tone="plain" />
        <Kpi label="Days Expected"     value={`${kpis.daysTracked}`}               sub="excl. excused/perm"                       tone="plain" />
      </div>
      <div className="text-[10px] text-muted-foreground px-1">
        Identity: On-Time ({kpis.onTime}) + Late Reported ({kpis.lateReported}) + Late Unreported ({kpis.lateUnreported}) + Absent ({kpis.absent}) = {totalCheck} = Days Expected ({kpis.daysTracked})
      </div>
    </div>
  );
}
