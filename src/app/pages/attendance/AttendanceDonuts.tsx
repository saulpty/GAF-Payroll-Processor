import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CompanyKpis, EmpStats } from '@/app/lib/attendanceStats';

type LegendItem = { label: string; value: number; color: string; indent?: boolean };

type DonutDatum = { name: string; value: number; color: string };

function DonutChart({ data, centerVal, centerLabel, caption }: {
  data: DonutDatum[];
  centerVal: string;
  centerLabel: string;
  caption?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const firstColor = data[0]?.color ?? '#94A3B8';
  return (
    <div>
      <div className="relative" style={{ height: 170 }}>
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={85}
              dataKey="value" paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v: number) => [`${v} (${total > 0 ? ((v / total) * 100).toFixed(0) : 0}%)`, '']} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold tracking-tight" style={{ color: firstColor }}>{centerVal}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{centerLabel}</div>
        </div>
      </div>
      {caption && <div className="text-[10px] text-muted-foreground text-center mt-1 px-2">{caption}</div>}
    </div>
  );
}

function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-col gap-2 mt-3">
      {items.map((it, i) => (
        <div key={i} className={`flex items-center justify-between text-xs ${it.indent ? 'pl-4' : ''}`}>
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: it.color, opacity: it.indent ? 0.7 : 1 }}
            />
            <span className={it.indent ? 'text-muted-foreground' : 'text-foreground'}>{it.label}</span>
          </div>
          <span className={`font-semibold ${it.indent ? 'text-muted-foreground' : ''}`}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AttendanceDonuts({ kpis, empStats }: { kpis: CompanyKpis; empStats: EmpStats[] }) {
  const totalLate = kpis.lateReported + kpis.lateUnreported;

  const overviewData: DonutDatum[] = [
    { name: 'On Time',      value: kpis.onTime,        color: '#2AA876' },
    { name: 'Late Reported', value: kpis.lateReported,  color: '#FBBF24' },
    { name: 'Late Unreported', value: kpis.lateUnreported, color: '#EF4444' },
    { name: 'Absent',        value: kpis.absent,        color: '#B91C1C' },
    { name: 'Permission',    value: kpis.permission,    color: '#6366F1' },
    { name: 'Time off',      value: kpis.excused,       color: '#94A3B8' },
  ].filter(d => d.value > 0);

  const b1to10  = empStats.reduce((s, e) => s + e.b1to10,  0);
  const b11to30 = empStats.reduce((s, e) => s + e.b11to30, 0);
  const b31plus = empStats.reduce((s, e) => s + e.b31plus, 0);

  const lateData: DonutDatum[] = [
    { name: '1–10 min',  value: b1to10,  color: '#FBBF24' },
    { name: '11–30 min', value: b11to30, color: '#D97706' },
    { name: '31+ min',   value: b31plus, color: '#EF4444' },
  ];
  const hasLate = lateData.some(d => d.value > 0);

  const reportingData: DonutDatum[] = [
    { name: 'On Time',    value: kpis.onTime,          color: '#2AA876' },
    { name: 'Reported',   value: kpis.lateReported,    color: '#FBBF24' },
    { name: 'Unreported', value: kpis.lateUnreported,  color: '#EF4444' },
  ].filter(d => d.value > 0);

  const reportPct = totalLate > 0 ? Math.round(kpis.lateReported / totalLate * 100) : 0;

  // Overview legend — Time off as single entry (no event_type_1 in view data)
  const overviewLegend: LegendItem[] = [
    { label: 'On Time',          value: kpis.onTime,          color: '#2AA876' },
    { label: 'Late Reported',    value: kpis.lateReported,    color: '#FBBF24' },
    { label: 'Late Unreported',  value: kpis.lateUnreported,  color: '#EF4444' },
    { label: 'Absent',           value: kpis.absent,          color: '#B91C1C' },
    { label: 'Permission',       value: kpis.permission,      color: '#6366F1' },
    { label: 'Time off',         value: kpis.excused,         color: '#94A3B8' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div className="bg-white rounded-xl border border-border shadow-sm p-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Attendance Overview</div>
        <DonutChart
          data={overviewData.length > 0 ? overviewData : [{ name: 'No data', value: 1, color: '#E2E8F0' }]}
          centerVal={`${kpis.onTimeRate.toFixed(0)}%`}
          centerLabel="On Time"
        />
        <Legend items={overviewLegend} />
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Late Arrivals — By Window</div>
        <DonutChart
          data={hasLate ? lateData.filter(d => d.value > 0) : [{ name: 'No data', value: 1, color: '#E2E8F0' }]}
          centerVal={`${totalLate}`}
          centerLabel="Total Late"
        />
        <Legend items={[
          { label: '1–10 min',  value: b1to10,  color: '#FBBF24' },
          { label: '11–30 min', value: b11to30, color: '#D97706' },
          { label: '31+ min',   value: b31plus, color: '#EF4444' },
        ]} />
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Reporting Compliance</div>
        <DonutChart
          data={reportingData.length > 0 ? reportingData : [{ name: 'No data', value: 1, color: '#E2E8F0' }]}
          centerVal={`${reportPct}%`}
          centerLabel="Reported"
          caption="Of late arrivals, % that filed a GAF form. Absent & time off excluded."
        />
        <Legend items={[
          { label: 'On Time',    value: kpis.onTime,         color: '#2AA876' },
          { label: 'Reported',   value: kpis.lateReported,   color: '#FBBF24' },
          { label: 'Unreported', value: kpis.lateUnreported, color: '#EF4444' },
        ]} />
      </div>
    </div>
  );
}
