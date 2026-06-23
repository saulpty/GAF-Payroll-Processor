import { CompanyKpis } from '@/app/lib/attendanceStats';

type Props = { kpis: CompanyKpis };

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-border p-3 shadow-sm min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 truncate">{label}</div>
      <div className={`text-2xl font-bold tracking-tight leading-none mb-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

export function AttendanceKpis({ kpis }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
      <Kpi label="On-Time Rate"      value={`${kpis.onTimeRate.toFixed(1)}%`}   sub={`${kpis.onTime} of ${kpis.daysTracked}`} color="text-green-600" />
      <Kpi label="Late — Reported"   value={`${kpis.lateReported}`}              sub="GAF filed"                                color="text-amber-600" />
      <Kpi label="Late — Unreported" value={`${kpis.lateUnreported}`}            sub="no GAF"                                   color="text-red-600" />
      <Kpi label="Excused"           value={`${kpis.excused}`}                   sub="PTO / Holiday"                            color="text-indigo-600" />
      <Kpi label="Permission"        value={`${kpis.permission}`}                sub="Approved"                                 color="text-purple-600" />
      <Kpi label="Avg Min Late"      value={`${kpis.avgMinLate.toFixed(1)}m`}    sub="per workday"                              color="text-slate-700" />
      <Kpi label="Days Tracked"      value={`${kpis.daysTracked}`}               sub="excl. excused"                            color="text-slate-700" />
    </div>
  );
}
