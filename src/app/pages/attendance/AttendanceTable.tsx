import { useState } from 'react';
import { EmpStats } from '@/app/lib/attendanceStats';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import InfoTip from '@/app/components/InfoTip';
import { filterByName, sortEmployeeStats } from '@/app/lib/attendanceSort';
import type { SortKey } from '@/app/lib/attendanceSort';

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-warm-text" />
    : <ChevronDown className="w-3 h-3 inline ml-0.5 text-warm-text" />;
}

type Tone = 'green' | 'yellow' | 'red';

/** Green 90% or above, amber 75–89%, red below 75%. The only place these limits are written. */
function onTimeTone(pct: number): Tone {
  if (pct >= 90) return 'green';
  if (pct >= 75) return 'yellow';
  return 'red';
}

const BAR: Record<Tone, string> = {
  green: 'bg-status-green-ink',
  yellow: 'bg-status-yellow-ink',
  red: 'bg-status-red-ink',
};

const PILL: Record<Tone, string> = {
  green: 'bg-status-green-fill text-status-green-ink',
  yellow: 'bg-status-yellow-fill text-status-yellow-ink',
  red: 'bg-status-red-fill text-status-red-ink',
};

export const ON_TIME_TOOLTIP = 'On-time days divided by expected days (on time + late + absent). Green is 90% or above, amber 75–89%, red below 75%. Time off and permissions are not counted either way.';

/** Computer table: a bar and the rate, coloured by the limits above. A dash when no day was expected. */
export function OnTimeBar({ pct, days }: { pct: number; days: number }) {
  if (days === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-border rounded-full min-w-10">
        <div className={`h-1 rounded-full ${BAR[onTimeTone(pct)]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

/** Phone rows: the same rate as a pill, in the same colours. A dash when no day was expected. */
export function OnTimePill({ pct, days }: { pct: number; days: number }) {
  if (days === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums whitespace-nowrap ${PILL[onTimeTone(pct)]}`}>
      {pct.toFixed(0)}% On Time
    </span>
  );
}

export const REPORTING_TOOLTIP = 'Of the days that needed an explanation — late or absent — how many had a GAF Attendance form on file.';

export function ReportingBadge({ s }: { s: EmpStats }) {
  const { filed, needed } = s.filing;
  if (needed === 0) {
    return <span className="text-muted-foreground text-xs tabular-nums">—</span>;
  }
  const label = `${filed}/${needed}`;
  if (filed === needed) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-green-fill text-status-green-ink">Complete</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{label}</span>
      </span>
    );
  }
  const missing = needed - filed;
  if (missing < needed / 2) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-yellow-fill text-status-yellow-ink">Gaps</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-red-fill text-status-red-ink">Rarely</span>
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

  const sorted = sortEmployeeStats(filterByName(stats, search), sortKey, sortDir);

  const Th = ({ label, col, tooltip }: { label: string; col: SortKey; tooltip?: string }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap bg-slate-50 border-b border-border hover:text-foreground"
      onClick={() => handleSort(col)}
      title={tooltip}
    >
      {label}{tooltip && <InfoTip text={tooltip} />}<SortIcon col={col} sortKey={sortKey} dir={sortDir} />
    </th>
  );

  return (
    <div className="bg-white rounded-lg border border-border shadow-card overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th label="Employee"         col="name"        tooltip="Name from the roster. Click a row to open the viewer." />
              <Th label="Manager"          col="manager"     tooltip="Manager from the Employee Directory." />
              <Th label="Schedule"         col="schedule"    tooltip="The shift assigned in Admin → Schedules; lateness is measured against its start time." />
              <Th label="On-Time"          col="pctOnTime"   tooltip={ON_TIME_TOOLTIP} />
              <Th label="Late"             col="totalLate"   tooltip="Days clocked in after the scheduled start. The red line under the number counts the late days with no GAF Attendance form." />
              <Th label="Absent"           col="absent"      tooltip="Scheduled days with no clock-in and no time off or permission." />
              <Th label="Avg Min (Worked)" col="avgMinLate"  tooltip="Average minutes late across every day someone actually worked, on-time days included." />
              <Th label="Reporting"        col="reporting"   tooltip={REPORTING_TOOLTIP} />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No employees match these filters.</td></tr>
            )}
            {sorted.map(s => (
              <tr key={s.email}
                className="border-b border-border/60 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onRowClick(s.email)}>
                <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">{s.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.manager || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.schedule}</td>
                <td className="px-3 py-2.5 min-w-[120px]"><OnTimeBar pct={s.pctOnTime} days={s.days} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-status-yellow-ink font-medium">{s.totalLate}</div>
                  {s.unreported > 0 && (
                    <div className="text-[11px] text-status-red-ink whitespace-nowrap">{s.unreported} Not Reported</div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-status-red-ink">{s.absent}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.avgMinLate.toFixed(1)}</td>
                <td className="px-3 py-2.5"><ReportingBadge s={s} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
