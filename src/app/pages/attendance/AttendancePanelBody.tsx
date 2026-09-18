import { EmpStats, computeArrivalScatter, ArrivalPoint } from '@/app/lib/attendanceStats';

import { AttendanceDonuts } from './AttendanceDonuts';
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

type Props = { stats: EmpStats };

export const STATUS_COLORS: Record<string, string> = {
  'On Time':                '#2AA876',
  'Late - Reported':        '#FBBF24',
  'Late - Unreported':      '#EF4444',
  'Excused (PTO/FH/Perm)':  '#94A3B8',
  'Permission':             '#6366F1',
  'Absent - Unexplained':   '#B91C1C',
};

function MiniKpi({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 text-center">
      <div className="font-bold text-xl tracking-tight" style={{ color }}>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function fmtMinutes(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtClock(t: string | null | undefined): string {
  const s = (t ?? '').trim();
  if (!s) return '—';
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return s;
  return fmtMinutes(Number(m[1]) * 60 + Number(m[2]));
}


const SCATTER_LEGEND = [
  { label: 'On Time',  color: '#2AA876' },
  { label: '1–10 min', color: '#FBBF24' },
  { label: '11–30 min', color: '#D97706' },
  { label: '31+ min',  color: '#EF4444' },
  { label: 'Absent',   color: '#B91C1C' },
  { label: 'Time Off', color: '#94A3B8' },
  { label: 'Permission', color: '#6366F1' },
];

const EXCUSED_Y = 7 * 60 - 20;
const ABSENT_Y  = 11 * 60 + 10;

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
      <div>Arrival: <span className="font-medium">{fmtClock(p.entry_time)}</span></div>
      <div>Status: <span className="font-medium" style={{ color: p.color }}>{p.status}</span></div>
      {p.minutes_late > 0 && <div>Min Late: <span className="font-medium">{p.minutes_late}</span></div>}
    </div>
  );
}

export default function AttendancePanelBody({ stats }: Props) {
  const scatterPoints = computeArrivalScatter(stats.rows).map(p => ({
    ...p,
    minutesSinceMidnight: p.minutesSinceMidnight ?? (
      p.status === 'Absent - Unexplained'       ? ABSENT_Y  :
      (p.status === 'Excused (PTO/FH/Perm)' || p.status === 'Permission') ? EXCUSED_Y :
      null
    ),
  }));

  const yTicks = [EXCUSED_Y, 7*60, 7*60+30, 8*60, 8*60+30, 9*60, 9*60+10, 9*60+30, 10*60, 11*60, ABSENT_Y];
  const step = Math.max(1, Math.floor(scatterPoints.length / 10));

  return (
    <div className="flex flex-col gap-6">
      {/* Mini KPIs */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        <MiniKpi label="Expected"         value={stats.days}                        color="#1B3A6B" />
        <MiniKpi label="On Time"          value={stats.onTime}                      color="#2AA876" />
        <MiniKpi label="Reported"         value={stats.reported}                    color="#FBBF24" />
        <MiniKpi label="Unreported"       value={stats.unreported}                  color="#EF4444" />
        <MiniKpi label="Absent"           value={stats.absent}                      color="#B91C1C" />
        <MiniKpi label="Avg Min (worked)" value={stats.avgMinLate.toFixed(1)}       color="#94A3B8" />
        <MiniKpi label="% On-Time"        value={`${stats.pctOnTime.toFixed(0)}%`}  color="#2AA876" />
      </div>

      {/* Day-by-day arrival scatter */}
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold mb-1">
          <div className="w-0.5 h-3.5 bg-primary rounded-full" />
          Arrival Trend (Day-by-Day)
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Each dot = one workday. Time off/Permission at bottom band; Absent (no-show) at top band.
        </p>
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
            <ComposedChart data={scatterPoints} margin={{ top: 8, right: 12, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={step - 1}
                angle={-35}
                textAnchor="end"
                height={42}
              />
              <YAxis
                domain={[EXCUSED_Y - 5, ABSENT_Y + 5]}
                ticks={yTicks}
                tickFormatter={v => v === EXCUSED_Y ? 'Time off' : v === ABSENT_Y ? 'Absent' : fmtMinutes(v)}
                tick={{ fontSize: 10 }}
                width={66}
              />
              <Tooltip content={<ArrivalTooltip />} />
              <ReferenceLine y={ABSENT_Y} stroke="#B91C1C" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: 'Absent', position: 'insideTopRight', fontSize: 9, fill: '#B91C1C' }} />
              <ReferenceLine y={EXCUSED_Y} stroke="#94A3B8" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: 'Time off/Perm', position: 'insideTopRight', fontSize: 9, fill: '#94A3B8' }} />
              <ReferenceLine y={9 * 60} stroke="#2AA876" strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value: '9:00 AM', position: 'insideTopRight', fontSize: 9, fill: '#2AA876' }} />
              <ReferenceLine y={9 * 60 + 10} stroke="#FBBF24" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: '9:10', position: 'insideTopRight', fontSize: 9, fill: '#FBBF24' }} />
              <ReferenceLine y={9 * 60 + 30} stroke="#D97706" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: '9:30', position: 'insideTopRight', fontSize: 9, fill: '#D97706' }} />
              <Line
                dataKey="minutesSinceMidnight"
                stroke="#1B3A6B"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Scatter dataKey="minutesSinceMidnight" isAnimationActive={false}>
                {scatterPoints.map((p, i) => (
                  <Cell key={i} fill={p.color} stroke="#fff" strokeWidth={1} r={4} />
                ))}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donuts */}
      <AttendanceDonuts stats={stats} />
    </div>
  );
}
