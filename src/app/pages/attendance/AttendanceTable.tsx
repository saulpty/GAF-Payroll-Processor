import { useState } from 'react';
import { EmpStats } from '@/app/lib/attendanceStats';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

type SortKey = keyof EmpStats;

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 opacity-80 inline ml-0.5 text-primary" />
    : <ChevronDown className="w-3 h-3 opacity-80 inline ml-0.5 text-primary" />;
}

function PctBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-border rounded-full min-w-10">
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function StatusBadge({ pct }: { pct: number }) {
  if (pct >= 90) return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">Good</span>;
  if (pct >= 75) return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">Fair</span>;
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">At Risk</span>;
}

type Props = { stats: EmpStats[]; onRowClick: (email: string) => void; search: string };

export function AttendanceTable({ stats, onRowClick, search }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = stats.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    if (typeof av === 'number' && typeof bv === 'number')
      return sortDir === 'asc' ? av - bv : bv - av;
    return 0;
  });

  const Th = ({ label, col }: { label: string; col: SortKey }) => (
    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none whitespace-nowrap bg-slate-50 border-b border-border hover:text-foreground"
      onClick={() => handleSort(col)}>
      {label}<SortIcon col={col} sortKey={sortKey} dir={sortDir} />
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th label="Employee"       col="name" />
              <Th label="Role"           col="role" />
              <Th label="Manager"        col="manager" />
              <Th label="Schedule"       col="schedule" />
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50 border-b border-border whitespace-nowrap">Status</th>
              <Th label="Days"           col="days" />
              <Th label="On Time"        col="onTime" />
              <Th label="Total Late"     col="totalLate" />
              <Th label="Reported"       col="reported" />
              <Th label="Unreported"     col="unreported" />
              <Th label="Avg Min"        col="avgMinLate" />
              <Th label="% On-Time"      col="pctOnTime" />
              <Th label="1–10m"          col="b1to10" />
              <Th label="11–30m"         col="b11to30" />
              <Th label="31+m"           col="b31plus" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={15} className="px-4 py-12 text-center text-muted-foreground">No data</td></tr>
            )}
            {sorted.map(s => (
              <tr key={s.email}
                className="border-b border-border/60 hover:bg-blue-50/60 cursor-pointer transition-colors"
                onClick={() => onRowClick(s.email)}>
                <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">{s.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.role || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.manager || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.schedule}</td>
                <td className="px-3 py-2.5"><StatusBadge pct={s.pctOnTime} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.days}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-green-700 font-medium">{s.onTime}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-red-600 font-medium">{s.totalLate}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-amber-600">{s.reported}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{s.unreported}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.avgMinLate.toFixed(1)}</td>
                <td className="px-3 py-2.5 min-w-[120px]"><PctBar pct={s.pctOnTime} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b1to10}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b11to30}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b31plus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
