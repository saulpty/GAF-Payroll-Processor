import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { EmpStats } from '@/app/lib/attendanceStats';

// Custom donut label
function DonutLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="fill-foreground">
      <tspan x={cx} dy="-6" fontSize="22" fontWeight="700">{total}</tspan>
      <tspan x={cx} dy="18" fontSize="10" fill="#94a3b8">days</tspan>
    </text>
  );
}

// Custom legend renderer for donuts
function renderLegend(props: { payload?: { value: string; color: string; payload: { value: number } }[] }) {
  const items = props.payload ?? [];
  return (
    <ul className="flex flex-col gap-1 pl-2">
      {items.map((e, i) => (
        <li key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
          <span>{e.value}</span>
          <span className="font-semibold ml-auto pl-3">{e.payload.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Arrival + Reporting donuts side by side, for the employee panel. */
export function AttendanceDonuts({ stats }: { stats: EmpStats }) {
  const arrivalData = [
    { name: 'On Time',    value: stats.onTime,     color: '#2AA876' },
    { name: '1–10m',      value: stats.b1to10,     color: '#FBBF24' },
    { name: '11–30m',     value: stats.b11to30,    color: '#D97706' },
    { name: '31+m',       value: stats.b31plus,    color: '#EF4444' },
    { name: 'Absent',     value: stats.absent,     color: '#B91C1C' },
    { name: 'Time off',   value: stats.excused,    color: '#94A3B8' },
    { name: 'Permission', value: stats.permission, color: '#6366F1' },
  ].filter(d => d.value > 0);

  const reportingData = [
    { name: 'On Time',    value: stats.onTime,     color: '#2AA876' },
    { name: 'Reported',   value: stats.reported,   color: '#FBBF24' },
    { name: 'Unreported', value: stats.unreported, color: '#EF4444' },
    { name: 'Absent',     value: stats.absent,     color: '#B91C1C' },
    { name: 'Time off',   value: stats.excused,    color: '#94A3B8' },
    { name: 'Permission', value: stats.permission, color: '#6366F1' },
  ].filter(d => d.value > 0);

  const totalArrival   = arrivalData.reduce((s, d) => s + d.value, 0);
  const totalReporting = reportingData.reduce((s, d) => s + d.value, 0);

  return (
        <div className="grid grid-cols-2 gap-4">
          {/* Arrival Breakdown donut */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <div className="w-0.5 h-3.5 bg-primary rounded-full" />
              Arrival Breakdown
            </div>
            <div className="bg-white border border-border rounded-xl p-4" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={arrivalData}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {arrivalData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <DonutLabel cx={arrivalData.length ? 90 : 110} cy={110} total={totalArrival} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    content={renderLegend as unknown as React.FC}
                  />
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reporting Breakdown donut */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <div className="w-0.5 h-3.5 bg-primary rounded-full" />
              Reporting Breakdown
            </div>
            <div className="bg-white border border-border rounded-xl p-4" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportingData}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {reportingData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <DonutLabel cx={arrivalData.length ? 90 : 110} cy={110} total={totalReporting} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    content={renderLegend as unknown as React.FC}
                  />
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
  );
}
