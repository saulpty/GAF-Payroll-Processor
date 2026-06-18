import { X } from 'lucide-react';
import { EmpStats, AttendanceRow, computeArrivalScatter, ArrivalPoint } from '@/app/lib/attendanceStats';
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
  BarChart, Bar,
} from 'recharts';

type Props = {
  stats: EmpStats | null;
  onClose: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  'On Time':             '#34c759',
  'Late - Reported':     '#ff9f0a',
  'Late - Unreported':   '#ff3b30',
  'Excused (PTO/FH/Perm)': '#636366',
  'Permission':          '#af52de',
};

function MiniKpi({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 text-center">
      <div className="font-bold text-xl tracking-tight" style={{ color }}>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

/** Format minutes-since-midnight back to "H:MM AM/PM" for axis/tooltip */
function fmtMinutes(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const SCATTER_LEGEND = [
  { label: 'On Time',   color: '#34c759' },
  { label: '1–10 min',  color: '#ff9f0a' },
  { label: '11–30 min', color: '#ff6b00' },
  { label: '31+ min',   color: '#ff3b30' },
  { label: 'Excused',   color: '#8e8e93' },
  { label: 'Permission',color: '#af52de' },
];

type ScatterTooltipProps = {
  active?: boolean;
  payload?: { payload: ArrivalPoint }[];
};

function ArrivalTooltip({ active, payload }: ScatterTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-border rounded-lg shadow-md px-3 py-2 text-xs">
      <div className="font-semibold mb-0.5">{p.date}</div>
      <div>Arrival: <span className="font-medium">{p.entry_time ?? '—'}</span></div>
      <div>Status: <span className="font-medium" style={{ color: p.color }}>{p.status}</span></div>
      {p.minutes_late > 0 && <div>Min Late: <span className="font-medium">{p.minutes_late}</span></div>}
    </div>
  );
}

export function AttendancePanel({ stats, onClose }: Props) {
  if (!stats) return null;

  const arrivalData = [
    { name: 'On Time',    value: stats.onTime,     color: '#34c759' },
    { name: '1–10m',      value: stats.b1to10,     color: '#ff9f0a' },
    { name: '11–30m',     value: stats.b11to30,    color: '#ff6b00' },
    { name: '31+m',       value: stats.b31plus,    color: '#ff3b30' },
    { name: 'Excused',    value: stats.excused,    color: '#636366' },
    { name: 'Permission', value: stats.permission, color: '#af52de' },
  ].filter(d => d.value > 0);

  const reportingData = [
    { name: 'On Time',    value: stats.onTime,     color: '#34c759' },
    { name: 'Reported',   value: stats.reported,   color: '#ff9f0a' },
    { name: 'Unreported', value: stats.unreported, color: '#ff3b30' },
    { name: 'Excused',    value: stats.excused,    color: '#636366' },
    { name: 'Permission', value: stats.permission, color: '#af52de' },
  ].filter(d => d.value > 0);

  const recentRows = [...stats.rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

  // Arrival scatter data (chronological)
  const scatterPoints = computeArrivalScatter(stats.rows);
  // For the connecting line we only use rows with actual entry times
  const linePoints = scatterPoints.filter(p => p.minutesSinceMidnight !== null);

  // Y-axis ticks: 7:00 AM to 1:00 PM in 30-min steps
  const yTicks = [7*60, 7*60+30, 8*60, 8*60+30, 9*60, 9*60+10, 9*60+30, 10*60, 11*60, 12*60, 13*60];

  // X-axis: show a tick every ~10 points to avoid crowding
  const step = Math.max(1, Math.floor(scatterPoints.length / 10));
  const xTickIndices = new Set(scatterPoints.map((_, i) => i).filter(i => i % step === 0));

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-white z-50 overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-7 py-5 flex items-start justify-between z-10">
          <div>
            <div className="text-xl font-bold tracking-tight">{stats.name}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{stats.schedule}</div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-border transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-7 flex flex-col gap-6">
          {/* Mini KPIs */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <MiniKpi label="Days"       value={stats.days}                    color="#0071e3" />
            <MiniKpi label="On Time"    value={stats.onTime}                  color="#34c759" />
            <MiniKpi label="Reported"   value={stats.reported}                color="#ff9f0a" />
            <MiniKpi label="Unreported" value={stats.unreported}              color="#ff3b30" />
            <MiniKpi label="Avg Min"    value={stats.avgMinLate.toFixed(1)}   color="#636366" />
            <MiniKpi label="% On-Time"  value={`${stats.pctOnTime.toFixed(0)}%`} color="#34c759" />
          </div>

          {/* Day-by-day arrival scatter */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold mb-1">
              <div className="w-0.5 h-3.5 bg-primary rounded-full" />
              Arrival Trend (Day-by-Day)
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              Each dot = one workday. Color = lateness bracket. Blue line traces chronological sequence.
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-3">
              {SCATTER_LEGEND.map(l => (
                <div key={l.label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
            <div className="bg-white border border-border rounded-xl p-4" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={scatterPoints}
                  margin={{ top: 8, right: 12, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval={step - 1}
                    angle={-35}
                    textAnchor="end"
                    height={42}
                  />
                  <YAxis
                    domain={[7 * 60, 13 * 60]}
                    ticks={yTicks}
                    tickFormatter={fmtMinutes}
                    tick={{ fontSize: 10 }}
                    width={62}
                  />
                  <Tooltip content={<ArrivalTooltip />} />
                  {/* Reference bands */}
                  <ReferenceLine y={9 * 60}       stroke="#34c759" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: '9:00 AM', position: 'insideTopRight', fontSize: 9, fill: '#34c759' }} />
                  <ReferenceLine y={9 * 60 + 10}  stroke="#ff9f0a" strokeDasharray="4 3" strokeWidth={1}
                    label={{ value: '9:10', position: 'insideTopRight', fontSize: 9, fill: '#ff9f0a' }} />
                  <ReferenceLine y={9 * 60 + 30}  stroke="#ff6b00" strokeDasharray="4 3" strokeWidth={1}
                    label={{ value: '9:30', position: 'insideTopRight', fontSize: 9, fill: '#ff6b00' }} />
                  {/* Connecting line (chronological) */}
                  <Line
                    dataKey="minutesSinceMidnight"
                    stroke="#1B3A6B"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  {/* Scatter dots */}
                  <Scatter dataKey="minutesSinceMidnight" isAnimationActive={false}>
                    {scatterPoints.map((p, i) => (
                      <Cell key={i} fill={p.color} stroke="#fff" strokeWidth={1} r={4} />
                    ))}
                  </Scatter>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Arrival breakdown bar */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <div className="w-0.5 h-3.5 bg-primary rounded-full" />
              Arrival Breakdown
            </div>
            <div className="bg-white border border-border rounded-xl p-4" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arrivalData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {arrivalData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reporting chart */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <div className="w-0.5 h-3.5 bg-primary rounded-full" />
              Reporting Breakdown
            </div>
            <div className="bg-white border border-border rounded-xl p-4" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportingData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {reportingData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent activity log */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <div className="w-0.5 h-3.5 bg-primary rounded-full" />
              Recent Activity
            </div>
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Entry</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Min Late</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((r: AttendanceRow, i: number) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-3 py-2 font-mono">{r.date}</td>
                      <td className="px-3 py-2">{r.entry_time ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: STATUS_COLORS[r.status] ?? '#ccc' }} />
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.minutes_late > 0 ? r.minutes_late : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
