import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CompanyKpis, EmpStats } from '@/app/lib/attendanceStats';

const COLORS_OVERVIEW  = ['#34c759', '#ff9f0a', '#ff3b30', '#af52de', '#636366'];
const COLORS_BUCKETS   = ['#34c759', '#ff9f0a', '#ff6b00', '#ff3b30'];
const COLORS_REPORTING = ['#34c759', '#ff9f0a', '#ff3b30'];

type LegendItem = { label: string; value: number; color: string };

function DonutChart({ data, colors, centerVal, centerLabel }: {
  data: { name: string; value: number }[];
  colors: string[];
  centerVal: string;
  centerLabel: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative" style={{ height: 170 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={85}
            dataKey="value" paddingAngle={2} strokeWidth={0}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => [`${v} (${total > 0 ? ((v/total)*100).toFixed(0) : 0}%)`, '']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-2xl font-bold tracking-tight" style={{ color: colors[0] }}>{centerVal}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{centerLabel}</div>
      </div>
    </div>
  );
}

function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-col gap-2 mt-3">
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: it.color }} />
            <span className="text-foreground">{it.label}</span>
          </div>
          <span className="font-semibold">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AttendanceDonuts({ kpis, empStats }: { kpis: CompanyKpis; empStats: EmpStats[] }) {
  const totalLate = kpis.lateReported + kpis.lateUnreported;

  const overviewData = [
    { name: 'On Time',        value: kpis.onTime },
    { name: 'Late Reported',  value: kpis.lateReported },
    { name: 'Late Unreported', value: kpis.lateUnreported },
    { name: 'Permission',     value: kpis.permission },
    { name: 'Excused',        value: kpis.excused },
  ].filter(d => d.value > 0);

  const b1to10  = empStats.reduce((s, e) => s + e.b1to10,  0);
  const b11to30 = empStats.reduce((s, e) => s + e.b11to30, 0);
  const b31plus = empStats.reduce((s, e) => s + e.b31plus, 0);

  const lateData = [
    { name: '1–10 min',  value: b1to10 },
    { name: '11–30 min', value: b11to30 },
    { name: '31+ min',   value: b31plus },
  ];

  const reportingData = [
    { name: 'On Time',    value: kpis.onTime },
    { name: 'Reported',   value: kpis.lateReported },
    { name: 'Unreported', value: kpis.lateUnreported },
  ].filter(d => d.value > 0);

  const reportPct = totalLate > 0 ? Math.round(kpis.lateReported / totalLate * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div className="bg-white rounded-xl border border-border shadow-sm p-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Attendance Overview</div>
        <DonutChart data={overviewData} colors={COLORS_OVERVIEW}
          centerVal={`${kpis.onTimeRate.toFixed(0)}%`} centerLabel="On Time" />
        <Legend items={[
          { label: 'On Time',         value: kpis.onTime,          color: COLORS_OVERVIEW[0] },
          { label: 'Late Reported',   value: kpis.lateReported,    color: COLORS_OVERVIEW[1] },
          { label: 'Late Unreported', value: kpis.lateUnreported,  color: COLORS_OVERVIEW[2] },
          { label: 'Permission',      value: kpis.permission,      color: COLORS_OVERVIEW[3] },
          { label: 'Excused',         value: kpis.excused,         color: COLORS_OVERVIEW[4] },
        ]} />
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Late Arrivals — By Window</div>
        <DonutChart data={lateData.filter(d => d.value > 0).length > 0 ? lateData : [{ name: 'No data', value: 1 }]}
          colors={COLORS_BUCKETS}
          centerVal={`${totalLate}`} centerLabel="Total Late" />
        <Legend items={[
          { label: '1–10 min',  value: b1to10,  color: COLORS_BUCKETS[1] },
          { label: '11–30 min', value: b11to30, color: COLORS_BUCKETS[2] },
          { label: '31+ min',   value: b31plus, color: COLORS_BUCKETS[3] },
        ]} />
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Reporting Compliance</div>
        <DonutChart data={reportingData} colors={COLORS_REPORTING}
          centerVal={`${reportPct}%`} centerLabel="Reported" />
        <Legend items={[
          { label: 'On Time',    value: kpis.onTime,         color: COLORS_REPORTING[0] },
          { label: 'Reported',   value: kpis.lateReported,   color: COLORS_REPORTING[1] },
          { label: 'Unreported', value: kpis.lateUnreported, color: COLORS_REPORTING[2] },
        ]} />
      </div>
    </div>
  );
}
