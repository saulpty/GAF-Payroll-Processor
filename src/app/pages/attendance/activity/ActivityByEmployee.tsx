import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { EmployeeActivitySummary, ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import WhyChipBadge from './WhyChipBadge';
import SourceBadge from './SourceBadge';
import GhostMark from './GhostMark';
import { AttendancePanel } from '@/app/pages/attendance/AttendancePanel';
import DataTable from '@/app/components/DataTable';
import type { Col } from '@/app/components/DataTable';

type SortKey = 'employeeName' | 'daysWorked' | 'avgActiveMin' | 'avgFirstMin' | 'avgLastMin' | 'needsLook' | 'awayDays';

type Props = {
  byEmployee: EmployeeActivitySummary[];
  shiftMinutes?: number;
  expandedId?: number | null;
  onToggle?: (id: number) => void;
};

const TD = 'px-3 py-2 text-sm text-slate-700 align-top';
const SUBTD = 'px-3 py-1.5 text-xs text-slate-600';
const SUBTH = 'px-3 py-1.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap bg-slate-100';

const MAX_BAR = 480;

const COLUMNS: Col<EmployeeActivitySummary>[] = [
  { key: 'employeeName', label: 'Employee' },
  { key: 'daysWorked',   label: 'Days With Work' },
  { key: 'avgActiveMin', label: 'Avg Active' },
  { key: 'avgFirstMin',  label: 'Avg Entry' },
  { key: 'avgLastMin',   label: 'Avg Exit' },
  { key: 'needsLook',    label: 'Needs A Look' },
  { key: 'awayDays',     label: 'Away Days' },
];

function ActiveBar({ activeMin, shiftMin }: { activeMin: number | null; shiftMin: number }) {
  if (activeMin === null) return <span className="text-slate-400">—</span>;
  const pct = Math.min(100, Math.round((activeMin / Math.max(shiftMin, 1)) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums text-sm font-medium">{fmtDuration(activeMin)}</span>
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#2AA876] rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ExpandedDayRow({ d }: { d: ActivityDay }) {
  const rowBg = d.needsLook ? 'bg-amber-50 hover:bg-amber-100/50' : 'bg-slate-50 hover:bg-slate-100/50';
  return (
    <tr className={`${rowBg} transition-colors`}>
      <td className={SUBTD}>{fmtDayShort(d.date)}</td>
      <td className={`${SUBTD} whitespace-nowrap tabular-nums`}>
        {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
        <GhostMark ghostMin={d.ghostMin} />
      </td>
      <td className={`${SUBTD} whitespace-nowrap tabular-nums`}>
        {d.shownLastMin !== null
          ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')
          : '—'}
      </td>
      <td className={SUBTD}>{fmtDuration(d.activeMin)}</td>
      <td className={SUBTD}>{d.records <= 1 ? '—' : fmtDuration(d.breaksMin)}</td>
      <td className={SUBTD}>
        <div className="flex flex-wrap gap-1">
          {d.needsLook && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Needs A Look
            </span>
          )}
          {d.flag === 'long_break' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              Long Break
            </span>
          )}
          {d.why ? <WhyChipBadge chip={d.why} /> : null}
        </div>
      </td>
      <td className={SUBTD}><SourceBadge official={d.official} edited={d.edited} /></td>
    </tr>
  );
}

function ExpandedHeader() {
  return (
    <tr>
      <th className={SUBTH}>Date</th>
      <th className={SUBTH}>Entry</th>
      <th className={SUBTH}>Exit</th>
      <th className={SUBTH}>Active</th>
      <th className={SUBTH}>Breaks</th>
      <th className={SUBTH}>Why</th>
      <th className={SUBTH}>Source</th>
    </tr>
  );
}

type EmployeeRowProps = {
  emp: EmployeeActivitySummary;
  onOpenPanel: (emp: EmployeeActivitySummary) => void;
  expanded: boolean;
  onToggle: () => void;
};

function EmployeeRow({ emp, onOpenPanel, expanded, onToggle }: EmployeeRowProps) {
  const avgShift = emp.days.length > 0 ? (emp.days[0]?.shiftMinutes ?? MAX_BAR) : MAX_BAR;

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className={TD}>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />}
            </button>
            <div>
              <button
                className="font-medium text-slate-800 hover:text-[#2AA876] hover:underline underline-offset-2 text-left transition-colors"
                onClick={() => onOpenPanel(emp)}
              >
                {emp.employeeName}
              </button>
              <div className="text-xs text-slate-400">{emp.role}</div>
            </div>
          </div>
        </td>
        <td className={TD}>
          <span className="font-medium">{emp.daysWorked}</span>
          <span className="text-slate-400"> / {emp.scheduledDays}</span>
        </td>
        <td className={TD}>
          <ActiveBar activeMin={emp.avgActiveMin} shiftMin={avgShift} />
        </td>
        <td className={TD}>{emp.avgFirstMin !== null ? fmtClock(emp.avgFirstMin) : '—'}</td>
        <td className={TD}>{emp.avgLastMin  !== null ? fmtClock(emp.avgLastMin)  : '—'}</td>
        <td className={TD}>
          {emp.needsLook > 0
            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                {emp.needsLook}
              </span>
            : null}
        </td>
        <td className={TD}>
          {emp.awayDays > 0 ? emp.awayLabel : <span className="text-slate-400">—</span>}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <table className="w-full divide-y divide-slate-100">
              <thead><ExpandedHeader /></thead>
              <tbody className="divide-y divide-slate-100">
                {emp.days.map(d => <ExpandedDayRow key={d.date} d={d} />)}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

function sortEmployees(list: EmployeeActivitySummary[], key: SortKey, dir: 'asc' | 'desc'): EmployeeActivitySummary[] {
  return [...list].sort((a, b) => {
    let av: number | string | null, bv: number | string | null;
    if (key === 'employeeName') { av = a.employeeName; bv = b.employeeName; }
    else if (key === 'daysWorked') { av = a.daysWorked; bv = b.daysWorked; }
    else if (key === 'avgActiveMin') { av = a.avgActiveMin ?? -1; bv = b.avgActiveMin ?? -1; }
    else if (key === 'avgFirstMin') { av = a.avgFirstMin ?? -1; bv = b.avgFirstMin ?? -1; }
    else if (key === 'avgLastMin') { av = a.avgLastMin ?? -1; bv = b.avgLastMin ?? -1; }
    else if (key === 'needsLook') { av = a.needsLook; bv = b.needsLook; }
    else { av = a.awayDays; bv = b.awayDays; }

    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = av as number, bn = bv as number;
    return dir === 'asc' ? an - bn : bn - an;
  });
}

export default function ActivityByEmployee({ byEmployee, expandedId, onToggle }: Props) {
  const [panelEmp, setPanelEmp] = useState<EmployeeActivitySummary | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('employeeName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // local expanded state fallback when parent doesn't control it
  const [localExpandedId, setLocalExpandedId] = useState<number | null>(null);
  const effectiveExpandedId = expandedId !== undefined ? expandedId : localExpandedId;

  function handleSort(key: string) {
    const k = key as SortKey;
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  function handleToggle(id: number) {
    if (onToggle) {
      onToggle(id);
    } else {
      setLocalExpandedId(prev => prev === id ? null : id);
    }
  }

  if (byEmployee.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <span className="text-sm">No activity for these filters.</span>
      </div>
    );
  }

  const sorted = sortEmployees(byEmployee, sortKey, sortDir);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      >
        {sorted.map(emp => (
          <EmployeeRow
            key={emp.employeeId}
            emp={emp}
            onOpenPanel={setPanelEmp}
            expanded={effectiveExpandedId === emp.employeeId}
            onToggle={() => handleToggle(emp.employeeId)}
          />
        ))}
      </DataTable>

      {panelEmp && (
        <AttendancePanel
          stats={null}
          employeeId={panelEmp.employeeId}
          days={panelEmp.days}
          displayName={panelEmp.employeeName}
          displayRole={panelEmp.role}
          displayManager={panelEmp.manager}
          onClose={() => setPanelEmp(null)}
        />
      )}
    </>
  );
}
