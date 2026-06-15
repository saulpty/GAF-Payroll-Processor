import { useState, useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import {
  BarChart2, Users, Clock, AlertTriangle, CheckCircle2,
  TrendingDown, Calendar, Filter, ChevronUp, ChevronDown, Minus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import loadSummaryDashboardAction from '@/actions/loadSummaryDashboard';
import loadSummaryAllPeriodsAction from '@/actions/loadSummaryAllPeriods';
import loadPeriodsAction from '@/actions/loadPeriods';

// ── Types ─────────────────────────────────────────────────────────────────────
type SummaryRow = {
  employee_name: string;
  days_in_period: number;
  days_worked: number;
  absences: number;
  late_days: number;
  early_leave_days: number;
  total_discount_minutes: number;
  total_discount_hours: number;
  pto_days: number;
  holiday_days: number;
  red_count: number;
  yellow_count: number;
  all_ready: boolean;
  tardanza_minutes: number;
  salida_minutes: number;
  permiso_no_rem_minutes: number;
  constancia_minutes: number;
  ausencia_injustificada_minutes: number;
};

type PeriodRow = {
  period_name: string;
  start_date: string;
  total_entries: number;
  green_count: number;
  yellow_count: number;
  red_count: number;
  tardanza_count: number;
  absence_count: number;
  unjustified_count: number;
  justified_count: number;
  pto_count: number;
  holiday_count: number;
  early_leave_count: number;
  total_discount_minutes: number;
  employee_count: number;
  ready_count: number;
};

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  navy:   '#1B3A6B',
  teal:   '#2AA876',
  amber:  '#F59E0B',
  red:    '#EF4444',
  slate:  '#94A3B8',
  indigo: '#6366F1',
  green:  '#22C55E',
  yellow: '#EAB308',
};

const PIE_COLORS = [C.navy, C.teal, C.amber, C.red, C.slate, C.indigo];

// ── Helpers ───────────────────────────────────────────────────────────────────
const toHrs = (m: number) => (m / 60).toFixed(1);
const fmt = (n: number) => n?.toLocaleString() ?? '0';
const pct = (n: number, d: number) => d ? ((n / d) * 100).toFixed(1) + '%' : '—';

type SortDir = 'asc' | 'desc' | null;

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc') return <ChevronUp className="w-3.5 h-3.5 inline ml-0.5" />;
  if (dir === 'desc') return <ChevronDown className="w-3.5 h-3.5 inline ml-0.5" />;
  return <Minus className="w-3 h-3 inline ml-0.5 opacity-30" />;
}

function KpiCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: color + '18' }}>
            <div style={{ color }}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SummaryDashboard() {
  const [periods] = useLoadAction(loadPeriodsAction, [] as { period_name: string }[]);
  const [allPeriodData, allLoading] = useLoadAction(loadSummaryAllPeriodsAction, [] as PeriodRow[]);

  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [params, setParams] = useState({ periodName: '' });
  const [rows, empLoading] = useLoadAction(
    loadSummaryDashboardAction, [] as SummaryRow[], params,
    { enabled: !!params.periodName }
  );

  const [empSearch, setEmpSearch] = useState('');
  const [sortCol, setSortCol] = useState<keyof SummaryRow | ''>('total_discount_minutes');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issues' | 'ready'>('all');

  const data = rows as SummaryRow[];
  const periodData = (allPeriodData as PeriodRow[]).filter(p => p.period_name !== 'june q1 test ');

  // ── KPI totals ──
  const totals = useMemo(() => data.reduce(
    (a, r) => ({
      discount: a.discount + (r.total_discount_minutes || 0),
      absences: a.absences + (r.absences || 0),
      late:     a.late + (r.late_days || 0),
      red:      a.red + (r.red_count || 0),
      yellow:   a.yellow + (r.yellow_count || 0),
      pto:      a.pto + (r.pto_days || 0),
    }),
    { discount: 0, absences: 0, late: 0, red: 0, yellow: 0, pto: 0 }
  ), [data]);

  // ── Bar chart: status composition per period ──
  const statusChart = periodData.map(p => ({
    name: p.period_name.replace('Q', 'Q').replace('-2026', ''),
    GREEN:  p.green_count,
    YELLOW: p.yellow_count,
    RED:    p.red_count,
  }));

  // ── Line chart: discount hours trend ──
  const discountTrend = periodData.map(p => ({
    name: p.period_name.replace('-2026', ''),
    'Discount Hrs': +(p.total_discount_minutes / 60).toFixed(1),
    'Absences':     p.absence_count,
    'Tardanza':     p.tardanza_count,
  }));

  // ── Pie: event type breakdown for selected period ──
  const eventPie = params.periodName ? (() => {
    const period = periodData.find(p => p.period_name === params.periodName);
    if (!period) return [];
    return [
      { name: 'Tardanza',       value: period.tardanza_count },
      { name: 'Ausencia Just.', value: period.justified_count },
      { name: 'Ausencia Injust.',value: period.unjustified_count },
      { name: 'PTO / Permiso',  value: period.pto_count },
      { name: 'Salida Temprano',value: period.early_leave_count },
      { name: 'Feriado',        value: period.holiday_count },
    ].filter(e => e.value > 0);
  })() : [];

  // ── Employee table ──
  const filteredEmps = useMemo(() => {
    let list = [...data];
    if (empSearch) list = list.filter(r => r.employee_name.toLowerCase().includes(empSearch.toLowerCase()));
    if (statusFilter === 'issues') list = list.filter(r => r.red_count > 0 || r.yellow_count > 0);
    if (statusFilter === 'ready') list = list.filter(r => r.all_ready);
    if (sortCol) {
      list.sort((a, b) => {
        const av = a[sortCol as keyof SummaryRow] as number;
        const bv = b[sortCol as keyof SummaryRow] as number;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return list;
  }, [data, empSearch, statusFilter, sortCol, sortDir]);

  const handleSort = (col: keyof SummaryRow) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const thCls = "px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-foreground select-none";
  const tdCls = "px-3 py-2.5 text-sm whitespace-nowrap";

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="w-5 h-5" style={{ color: C.navy }} />
            Payroll Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cross-period analytics & per-employee breakdown</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm min-w-48 focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': C.navy } as React.CSSProperties}
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
          >
            <option value="">All periods (trend view)</option>
            {(periods as { period_name: string }[])
              .filter(p => p.period_name !== 'june q1 test ')
              .map(p => (
                <option key={p.period_name} value={p.period_name}>{p.period_name}</option>
              ))}
          </select>
          {selectedPeriod && (
            <button
              className="px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm hover:opacity-90 transition"
              style={{ background: C.navy }}
              onClick={() => setParams({ periodName: selectedPeriod })}
            >
              Load Detail
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards (shown when period loaded) ── */}
      {params.periodName && data.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="Employees" value={data.length} icon={<Users className="w-5 h-5" />} color={C.navy} />
          <KpiCard label="Discount Hours" value={toHrs(totals.discount) + 'h'} sub="total unpaid time" icon={<Clock className="w-5 h-5" />} color={C.red} />
          <KpiCard label="Absences" value={totals.absences} icon={<Calendar className="w-5 h-5" />} color={C.amber} />
          <KpiCard label="Late Days" value={totals.late} icon={<TrendingDown className="w-5 h-5" />} color={C.indigo} />
          <KpiCard label="RED Entries" value={totals.red} sub="need resolution" icon={<AlertTriangle className="w-5 h-5" />} color={C.red} />
          <KpiCard label="PTO / Permits" value={totals.pto} icon={<CheckCircle2 className="w-5 h-5" />} color={C.teal} />
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status composition */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Period Status Composition</CardTitle>
            <p className="text-xs text-muted-foreground">Green / Yellow / Red entries per payroll period</p>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {allLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="GREEN"  fill={C.teal}  stackId="a" name="Green" />
                  <Bar dataKey="YELLOW" fill={C.amber} stackId="a" name="Yellow" />
                  <Bar dataKey="RED"    fill={C.red}   stackId="a" name="Red" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Event type pie */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {params.periodName ? `Event Mix — ${params.periodName}` : 'Event Type Mix'}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Select a period and load detail</p>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {eventPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={eventPie} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                    paddingAngle={2} dataKey="value" nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {eventPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-1">
                <BarChart2 className="w-8 h-8 opacity-20" />
                <span className="text-xs">Load a period for detail</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Trend line ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Trend — Discount Hours, Absences & Tardiness</CardTitle>
          <p className="text-xs text-muted-foreground">Across all payroll periods</p>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={discountTrend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Discount Hrs" stroke={C.red}    strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Absences"    stroke={C.amber}   strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Tardanza"    stroke={C.indigo}  strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Per-employee table ── */}
      {params.periodName && (
        <Card className="shadow-sm">
          <CardHeader className="flex-row items-center justify-between pb-3" style={{ flexDirection: 'row' }}>
            <div>
              <CardTitle className="text-sm font-semibold">Employee Detail — {params.periodName}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{filteredEmps.length} of {data.length} employees</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border overflow-hidden text-xs">
                {(['all', 'issues', 'ready'] as const).map(f => (
                  <button key={f} onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 font-medium transition-colors ${
                      statusFilter === f
                        ? 'text-white'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                    style={statusFilter === f ? { background: C.navy } : {}}
                  >
                    {f === 'all' ? 'All' : f === 'issues' ? '⚠ Has Issues' : '✓ Ready'}
                  </button>
                ))}
              </div>
              <input
                className="border rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': C.navy } as React.CSSProperties}
                placeholder="Search employee…"
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {empLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading employee data…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y bg-muted/50">
                    <tr>
                      <th className={thCls} style={{ cursor: 'default' }}>Employee</th>
                      <th className={thCls} onClick={() => handleSort('days_worked')}>Days Worked <SortIcon dir={sortCol === 'days_worked' ? sortDir : null} /></th>
                      <th className={thCls} onClick={() => handleSort('late_days')}>Late Days <SortIcon dir={sortCol === 'late_days' ? sortDir : null} /></th>
                      <th className={thCls} onClick={() => handleSort('absences')}>Absences <SortIcon dir={sortCol === 'absences' ? sortDir : null} /></th>
                      <th className={thCls} onClick={() => handleSort('early_leave_days')}>Early Leave <SortIcon dir={sortCol === 'early_leave_days' ? sortDir : null} /></th>
                      <th className={thCls} onClick={() => handleSort('total_discount_minutes')}>Discount Hrs <SortIcon dir={sortCol === 'total_discount_minutes' ? sortDir : null} /></th>
                      <th className={thCls} onClick={() => handleSort('pto_days')}>PTO Days <SortIcon dir={sortCol === 'pto_days' ? sortDir : null} /></th>
                      <th className={thCls} onClick={() => handleSort('red_count')}>RED <SortIcon dir={sortCol === 'red_count' ? sortDir : null} /></th>
                      <th className={thCls} onClick={() => handleSort('yellow_count')}>YELLOW <SortIcon dir={sortCol === 'yellow_count' ? sortDir : null} /></th>
                      <th className={thCls}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmps.map((r, i) => (
                      <tr key={r.employee_name}
                        className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                        <td className={`${tdCls} font-medium text-foreground max-w-[180px] truncate`}>{r.employee_name}</td>
                        <td className={`${tdCls} text-center`}>{r.days_worked} / {r.days_in_period}</td>
                        <td className={`${tdCls} text-center`}>
                          <span className={r.late_days > 0 ? 'text-amber-600 font-semibold' : ''}>{r.late_days}</span>
                        </td>
                        <td className={`${tdCls} text-center`}>
                          <span className={r.absences > 0 ? 'text-red-600 font-semibold' : ''}>{r.absences}</span>
                        </td>
                        <td className={`${tdCls} text-center`}>{r.early_leave_days}</td>
                        <td className={`${tdCls} text-center font-mono`}>
                          <span className={r.total_discount_minutes > 0 ? 'text-red-600' : 'text-muted-foreground'}>
                            {toHrs(r.total_discount_minutes)}h
                          </span>
                        </td>
                        <td className={`${tdCls} text-center`}>{r.pto_days}</td>
                        <td className={`${tdCls} text-center`}>
                          {r.red_count > 0
                            ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">{r.red_count}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className={`${tdCls} text-center`}>
                          {r.yellow_count > 0
                            ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">{r.yellow_count}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className={`${tdCls} text-center`}>
                          {r.all_ready
                            ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✓ Ready</span>
                            : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Pending</span>}
                        </td>
                      </tr>
                    ))}
                    {filteredEmps.length === 0 && (
                      <tr><td colSpan={10} className="py-8 text-center text-muted-foreground text-sm">No employees match your filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
