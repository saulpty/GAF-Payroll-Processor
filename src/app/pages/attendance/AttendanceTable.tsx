import { useState } from 'react';
import { EmpStats } from '@/app/lib/attendanceStats';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import InfoTip from '@/app/components/InfoTip';

type SortKey = keyof EmpStats | 'reporting';

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

const STATUS_TOOLTIP = 'Based on on-time rate alone: Good is 90% or above, Fair is 75–89%, At Risk is below 75%.';

function StatusBadge({ pct, days }: { pct: number; days: number }) {
  if (days === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (pct >= 90) return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`Good — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 cursor-default"
    >
      Good
    </span>
  );
  if (pct >= 75) return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`Fair — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 cursor-default"
    >
      Fair
    </span>
  );
  return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`At Risk — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 cursor-default"
    >
      At Risk
    </span>
  );
}

const REPORTING_TOOLTIP = 'Of the days that needed an explanation — late or absent — how many had a GAF Attendance form on file.';

/** Ratio for sorting: -1 means needed=0 (always last in both directions) */
function reportingRatio(s: EmpStats): number {
  if (s.filing.needed === 0) return -1;
  return s.filing.filed / s.filing.needed;
}

function ReportingBadge({ s }: { s: EmpStats }) {
  const { filed, needed } = s.filing;
  if (needed === 0) {
    return <span className="text-muted-foreground text-xs tabular-nums">—</span>;
  }
  const label = `${filed}/${needed}`;
  if (filed === needed) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">Complete</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{label}</span>
      </span>
    );
  }
  const missing = needed - filed;
  if (missing < needed / 2) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">Gaps</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">Rarely</span>
      <span className="text-[11px] text-muted-foreground tabular-nums">{label}</span>
    </span>
  );
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
    if (sortKey === 'reporting') {
      const ar = reportingRatio(a), br = reportingRatio(b);
      // needed=0 rows always last (ratio=-1) regardless of direction
      if (ar === -1 && br === -1) return 0;
      if (ar === -1) return 1;
      if (br === -1) return -1;
      return sortDir === 'asc' ? ar - br : br - ar;
    }
    const av = a[sortKey as keyof EmpStats], bv = b[sortKey as keyof EmpStats];
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    if (typeof av === 'number' && typeof bv === 'number')
      return sortDir === 'asc' ? av - bv : bv - av;
    return 0;
  });

  const Th = ({ label, col, tooltip }: { label: string; col: SortKey; tooltip?: string }) => (
    <th
      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none whitespace-nowrap bg-slate-50 border-b border-border hover:text-foreground"
      onClick={() => handleSort(col)}
      title={tooltip}
    >
      {label}{tooltip && <InfoTip text={tooltip} />}<SortIcon col={col} sortKey={sortKey} dir={sortDir} />
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th label="Employee"         col="name"      tooltip="Name from the roster. Click a row to open the viewer." />
              <Th label="Role"             col="role"      tooltip="Role from the Employee Directory." />
              <Th label="Manager"          col="manager"   tooltip="Manager from the Employee Directory." />
              <Th label="Schedule"         col="schedule"  tooltip="The shift assigned in Admin → Schedules; lateness is measured against its start time." />
              <th
                className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-slate-50 border-b border-border whitespace-nowrap cursor-default"
                title={STATUS_TOOLTIP}
              >
                Status<InfoTip text={STATUS_TOOLTIP} />
              </th>
              <Th label="Reporting" col="reporting" tooltip={REPORTING_TOOLTIP} />
              <Th label="Expected"         col="days"        tooltip="Scheduled work days in range, excluding time off and permissions." />
              <Th label="On Time"          col="onTime"      tooltip="Days clocked in at or before the scheduled start." />
              <Th label="Total Late"       col="totalLate"   tooltip="Days clocked in after the scheduled start (Reported + Unreported)." />
              <Th label="Reported"         col="reported"    tooltip="Late days that had a GAF Attendance form on file." />
              <Th label="Unreported"       col="unreported"  tooltip="Late days with no GAF Attendance form." />
              <Th label="Absent"           col="absent"      tooltip="Scheduled days with no clock-in and no time off or permission." />
              <Th label="Avg Min (worked)" col="avgMinLate"  tooltip="Average minutes late across the days someone actually worked." />
              <Th label="% On-Time"        col="pctOnTime"   tooltip="On Time ÷ Expected. Green 90%+, amber 75–89%, red below 75%." />
              <Th label="1–10m"            col="b1to10"      tooltip="Late days where the delay was 1 to 10 minutes." />
              <Th label="11–30m"           col="b11to30"     tooltip="Late days where the delay was 11 to 30 minutes." />
              <Th label="31+m"             col="b31plus"     tooltip="Late days where the delay was more than 30 minutes." />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={17} className="px-4 py-12 text-center text-muted-foreground">No data</td></tr>
            )}
            {sorted.map(s => (
              <tr key={s.email}
                className="border-b border-border/60 hover:bg-blue-50/60 cursor-pointer transition-colors"
                onClick={() => onRowClick(s.email)}>
                <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">{s.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.role || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.manager || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.schedule}</td>
                <td className="px-3 py-2.5"><StatusBadge pct={s.pctOnTime} days={s.days} /></td>
                <td className="px-3 py-2.5"><ReportingBadge s={s} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.days}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-green-700 font-medium">{s.onTime}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-red-600 font-medium">{s.totalLate}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-amber-600">{s.reported}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-red-500">{s.unreported}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: '#B91C1C' }}>{s.absent}</td>
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
