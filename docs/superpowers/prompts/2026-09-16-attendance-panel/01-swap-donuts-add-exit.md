# 01 — Employee panel: Recent Activity above the donuts, and an Exit column

## Files that may change

- `src/actions/loadAttendanceDaily.ts` — replace the whole file (section 1)
- `src/app/lib/attendanceStats.ts` — one added field in `AttendanceRow` (section 2)
- `src/app/pages/attendance/AttendanceDonuts.tsx` — NEW (section 3)
- `src/app/pages/attendance/AttendancePanel.tsx` — replace the whole file (section 4)

No other file may be touched. Do not change the view `v_attendance_daily`.

## Why

Saul, on the Attendance list's employee panel (click an employee):
1. Swap the two donut charts (Arrival Breakdown, Reporting Breakdown) with the Recent Activity table —
   Recent Activity comes first, right under the arrival trend chart, the donuts after it.
2. Recent Activity shows only the entry time. Add the **Exit** time.

`AttendancePanel.tsx` is 17 KB (over the 15 KB rule), so the donuts move into their own file
unchanged. `v_attendance_daily` has no exit column; the loader looks it up from the same
`payroll_entries` row the view uses (same employee, same work date, not deleted, highest
`period_name` first) and formats it `HH24:MI`, the same way the view formats `entry_time`.

## 1. `src/actions/loadAttendanceDaily.ts`

```ts
import { action } from '@uibakery/data';

export function loadAttendanceDaily() {
  return action('loadAttendanceDaily', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT d.email, d.name, d.date, d.entry_time, ex.exit_time, d.status, d.bucket, d.filed_gaf,
             d.minutes_late, d.period_name, d.time_off_kind
      FROM public.v_attendance_daily d
      LEFT JOIN LATERAL (
        SELECT CASE
                 WHEN x.t IS NULL THEN NULL
                 WHEN UPPER(x.t) ~ '^[0-9]{1,2}:[0-9]{2} ?[AP]M$' THEN TO_CHAR(to_timestamp(UPPER(x.t), 'HH12:MI AM')::time, 'HH24:MI')
                 WHEN UPPER(x.t) ~ '^[0-9]{1,2}[AP]M$' THEN TO_CHAR(to_timestamp(UPPER(x.t), 'HH12AM')::time, 'HH24:MI')
                 ELSE x.t
               END AS exit_time
        FROM (
          SELECT NULLIF(TRIM(pe.exit_time), '') AS t
          FROM public.payroll_entries pe
          JOIN public.employees e ON e.id = pe.employee_id
          WHERE e.teramind_email = d.email
            AND LEFT(pe.work_date, 10)::date = d.date
            AND pe.deleted_at IS NULL
          ORDER BY pe.period_name DESC
          LIMIT 1
        ) x
      ) ex ON true
      WHERE d.date >= {{params.dateFrom}}
        AND d.date <= {{params.dateTo}}
        AND (COALESCE({{params.email}}, '') = '' OR d.email = {{params.email}})
        AND d.email IN (SELECT e.teramind_email FROM public.employees e
                        JOIN public.v_employee_access a ON a.employee_id = e.id
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ORDER BY d.date, d.name
    `,
  });
}

export default loadAttendanceDaily;
```

## 2. `src/app/lib/attendanceStats.ts`

In `export type AttendanceRow`, directly after `entry_time: string | null;` add
`exit_time?: string | null;`. Nothing else changes.

## 3. `src/app/pages/attendance/AttendanceDonuts.tsx` (new) — exactly as given

```tsx
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
```

## 4. `src/app/pages/attendance/AttendancePanel.tsx` — replace, exactly as given

```tsx
import { X, Briefcase, User } from 'lucide-react';
import { EmpStats, AttendanceRow, computeArrivalScatter, ArrivalPoint } from '@/app/lib/attendanceStats';
import { fmtDayLong } from '@/app/lib/fmtDay';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { AttendanceDonuts } from './AttendanceDonuts';
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

type Props = {
  stats: EmpStats | null;
  onClose: () => void;
};

const STATUS_COLORS: Record<string, string> = {
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

/** Format minutes-since-midnight back to "H:MM AM/PM" */
function fmtMinutes(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Normalize any date value to YYYY-MM-DD */
function toDateStr(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) return toLocalYMD(val);
  return String(val).slice(0, 10);
}

const SCATTER_LEGEND = [
  { label: 'On Time',          color: '#2AA876' },
  { label: '1–10 min',         color: '#FBBF24' },
  { label: '11–30 min',        color: '#D97706' },
  { label: '31+ min',          color: '#EF4444' },
  { label: 'Absent',           color: '#B91C1C' },
  { label: 'Time off',         color: '#94A3B8' },
  { label: 'Permission',       color: '#6366F1' },
];

// Fixed Y positions for non-arrival dots (above the normal working range)
const EXCUSED_Y = 7 * 60 - 20;  // 6:40 — excused / permission band
const ABSENT_Y  = 11 * 60 + 10; // 11:10 — absent band (above schedule)

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

  const recentRows = [...stats.rows]
    .sort((a, b) => toDateStr(b.date).localeCompare(toDateStr(a.date)))
    .slice(0, 20);

  // Arrival scatter — show excused/permission at EXCUSED_Y, absent at ABSENT_Y
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
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        style={{ animation: 'fadeIn 200ms ease both' }}
        onClick={onClose}
      />
      {/* Panel — at least 50vw wide */}
      <div
        className="fixed top-0 right-0 bottom-0 bg-white z-50 overflow-y-auto shadow-2xl flex flex-col"
        style={{
          width: 'clamp(520px, 55vw, 900px)',
          animation: 'slideInRight 280ms cubic-bezier(0.22, 0.68, 0, 1.1) both',
        }}
      >

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-7 py-5 flex items-start justify-between z-10">
          <div>
            <div className="text-xl font-bold tracking-tight">{stats.name}</div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-muted-foreground">{stats.schedule}</span>
              {stats.role && (
                <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                  <Briefcase className="w-3 h-3" />
                  {stats.role}
                </span>
              )}
              {stats.manager && (
                <span className="flex items-center gap-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                  <User className="w-3 h-3" />
                  {stats.manager}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            aria-label="Close employee panel"
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-border transition-colors shrink-0 ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-7 flex flex-col gap-6">
          {/* Mini KPIs */}
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
            <MiniKpi label="Expected"   value={stats.days}                        color="#1B3A6B" />
            <MiniKpi label="On Time"    value={stats.onTime}                      color="#2AA876" />
            <MiniKpi label="Reported"   value={stats.reported}                    color="#FBBF24" />
            <MiniKpi label="Unreported" value={stats.unreported}                  color="#EF4444" />
            <MiniKpi label="Absent"     value={stats.absent}                      color="#B91C1C" />
            <MiniKpi label="Avg Min (worked)" value={stats.avgMinLate.toFixed(1)} color="#94A3B8" />
            <MiniKpi label="% On-Time"  value={`${stats.pctOnTime.toFixed(0)}%`} color="#2AA876" />
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
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Exit</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Min Late</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((r: AttendanceRow, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDayLong(toDateStr(r.date))}</td>
                      <td className="px-3 py-2">{r.entry_time ?? '—'}</td>
                      <td className="px-3 py-2">{r.exit_time ?? '—'}</td>
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

          {/* Arrival + Reporting donuts side by side */}
          <AttendanceDonuts stats={stats} />
        </div>
      </div>
    </>
  );
}
```

## Acceptance

1. Lint clean.
2. Run `loadAttendanceDaily` for a recent 7-day range with `email: ''` and `viewAs: ''` only if the
   inspector has a signed-in email; otherwise skip — Saul's reviewer checks it in the browser.
3. Report the byte size of `AttendancePanel.tsx` and `AttendanceDonuts.tsx` (both under 15 KB).
4. Confirm every identifier used in both components is imported.

Do not build anything else.
