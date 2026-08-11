import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { AttendanceRow, EmpStats, computeTrends, TrendPoint } from '@/app/lib/attendanceStats';

type Props = {
  rows: AttendanceRow[];
  empStats: EmpStats[];
  search: string;
};

type Gran = 'month' | 'week';
type Metric = 'rate' | 'avg';
type Cohort = 'all' | 'consistent';

export function AttendanceTrends({ rows, empStats, search }: Props) {
  const [gran, setGran]     = useState<Gran>('month');
  const [metric, setMetric] = useState<Metric>('rate');
  const [cohort, setCohort] = useState<Cohort>('all');

  // If exactly one employee matches the search, auto-switch to single mode
  const matchedEmps = useMemo(() =>
    search.trim()
      ? empStats.filter(s =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.email.toLowerCase().includes(search.toLowerCase())
        )
      : empStats,
    [empStats, search]
  );
  const singleEmp = matchedEmps.length === 1 ? matchedEmps[0] : null;
  const isSingle = singleEmp !== null;
  const isRate = metric === 'rate';

  const filteredRows = useMemo(() => {
    if (isSingle) return rows.filter(r => r.email === singleEmp!.email);
    if (cohort === 'consistent' && !isSingle) {
      // consistent: employees with records in both earliest and latest complete month
      const months = [...new Set(rows.map(r => r.date.slice(0, 7)))].sort();
      if (months.length < 2) return rows;
      const first = months[0];
      const last = months[months.length - 1];
      const inFirst = new Set(rows.filter(r => r.date.startsWith(first)).map(r => r.email));
      const inLast  = new Set(rows.filter(r => r.date.startsWith(last)).map(r => r.email));
      const consistent = new Set([...inFirst].filter(e => inLast.has(e)));
      return rows.filter(r => consistent.has(r.email));
    }
    return rows;
  }, [rows, isSingle, singleEmp, cohort]);

  const points: TrendPoint[] = useMemo(() => computeTrends(filteredRows, gran), [filteredRows, gran]);

  const chartData = points.map(p => ({
    label: p.label,
    value: p.tracked > 0 ? (isRate ? (p.onTime / p.tracked) * 100 : p.sumMin / p.tracked) : null,
    n: p.tracked,
    isPartial: p.isPartial,
  }));

  const completePoints = chartData.filter(p => !p.isPartial && p.value !== null);
  let deltaEl = null;
  if (completePoints.length >= 2) {
    const first = completePoints[0];
    const last  = completePoints[completePoints.length - 1];
    const diff  = (last.value as number) - (first.value as number);
    const improved = isRate ? diff > 0 : diff < 0;
    const flat = Math.abs(diff) < 0.05;
    const color = flat ? '#8e8e93' : improved ? '#34c759' : '#ff3b30';
    const arrow = flat ? '→' : diff > 0 ? '▲' : '▼';
    const word  = flat ? 'No change' : improved ? 'Improved' : 'Declined';
    const deltaTxt = isRate
      ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pts`
      : `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} min`;

    deltaEl = (
      <div className="bg-white border border-border rounded-xl px-6 py-4 mb-4 flex items-center gap-8 flex-wrap shadow-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{first.label}</div>
          <div className="text-2xl font-bold">{isRate ? `${(first.value as number).toFixed(1)}%` : `${(first.value as number).toFixed(1)}m`}</div>
        </div>
        <div className="text-2xl text-muted-foreground">→</div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{last.label}</div>
          <div className="text-2xl font-bold">{isRate ? `${(last.value as number).toFixed(1)}%` : `${(last.value as number).toFixed(1)}m`}</div>
        </div>
        <div className="ml-2 px-4 py-2 rounded-xl" style={{ background: `${color}1a` }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{word}</div>
          <div className="text-xl font-bold" style={{ color }}>{arrow} {deltaTxt}</div>
        </div>
        <div className="ml-auto text-xs text-muted-foreground max-w-[220px]">
          Comparing first vs latest complete {gran}. In-progress period excluded.
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const point = chartData.find(p => p.label === label);
    return (
      <div className="bg-white border border-border rounded-lg shadow-md px-3 py-2 text-sm">
        <div className="font-semibold mb-1">{label}{point?.isPartial ? ' (in progress)' : ''}</div>
        <div>{isRate ? `${payload[0].value?.toFixed(1)}%` : `${payload[0].value?.toFixed(1)} min`}</div>
        <div className="text-muted-foreground text-xs">n = {point?.n ?? '?'} days</div>
      </div>
    );
  };

  const partialIdx = chartData.findIndex(p => p.isPartial);

  // Period table
  const tableRows = [...points].reverse();

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="bg-white border border-border rounded-xl px-5 py-3 flex items-center gap-4 flex-wrap shadow-sm">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(['month','week'] as Gran[]).map(g => (
            <button key={g} onClick={() => setGran(g)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${gran === g ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {g === 'month' ? 'Month' : 'Week'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(['rate','avg'] as Metric[]).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${metric === m ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {m === 'rate' ? 'On-Time Rate' : 'Avg Min Late'}
            </button>
          ))}
        </div>
        {!isSingle && (
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {(['all','consistent'] as Cohort[]).map(c => (
              <button key={c} onClick={() => setCohort(c)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${cohort === c ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {c === 'all' ? 'Everyone' : 'Consistent roster'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delta readout */}
      {deltaEl}

      {/* Chart */}
      <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
        <div className="text-sm font-semibold mb-1">
          {isRate ? 'On-Time Rate' : 'Avg Minutes Late / Workday'} — {gran === 'month' ? 'Monthly' : 'Weekly'}
          {isSingle ? ` · ${singleEmp!.name}` : cohort === 'consistent' ? ' · Consistent roster' : ' · Company'}
        </div>
        <div className="text-xs text-muted-foreground mb-4">
          {isRate
            ? 'On-time rate = on-time days ÷ tracked days (excused & permission excluded).'
            : 'Average lateness across every tracked workday (on-time counted as 0). Lower is better.'}
          {partialIdx >= 0 ? ` Final period (${chartData[partialIdx]?.label}) is in progress — shown dashed.` : ''}
        </div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={isRate ? [0, 100] : ['auto', 'auto']} tick={{ fontSize: 11 }}
                tickFormatter={v => isRate ? `${v}%` : `${v}m`} />
              <Tooltip content={<CustomTooltip />} />
              {/* Solid segments */}
              <Line type="monotone" dataKey="value"
                stroke="#1B3A6B" strokeWidth={2.5}
                dot={{ r: 4, fill: '#1B3A6B', stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
                strokeDasharray={undefined} />
              {/* Partial period marker */}
              {partialIdx >= 0 && (
                <ReferenceLine x={chartData[partialIdx]?.label}
                  stroke="#ff9f0a" strokeDasharray="4 3" label={{ value: '…', position: 'top', fontSize: 11 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Period table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Period</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tracked</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">On Time</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rate / Avg</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">vs Prev</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((p, i) => {
              const val = p.tracked > 0 ? (isRate ? (p.onTime / p.tracked) * 100 : p.sumMin / p.tracked) : null;
              const prevP = tableRows[i + 1];
              const prevVal = prevP && prevP.tracked > 0 ? (isRate ? (prevP.onTime / prevP.tracked) * 100 : prevP.sumMin / prevP.tracked) : null;
              const diff = val !== null && prevVal !== null ? val - prevVal : null;
              const improved = diff !== null && (isRate ? diff > 0 : diff < 0);
              return (
                <tr key={p.key} className={`border-b border-border/50 ${p.isPartial ? 'opacity-60 italic' : ''}`}>
                  <td className="px-4 py-2.5 font-medium">{p.label}{p.isPartial ? ' ⋯' : ''}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.tracked}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.onTime}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                    {val !== null ? (isRate ? `${val.toFixed(1)}%` : `${val.toFixed(1)}m`) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                    {diff !== null
                      ? <span style={{ color: improved ? '#34c759' : '#ff3b30' }}>
                          {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}{isRate ? ' pts' : 'm'}
                        </span>
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
