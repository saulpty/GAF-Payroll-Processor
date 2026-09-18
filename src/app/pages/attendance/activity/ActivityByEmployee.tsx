import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { EmployeeActivitySummary, ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import WhyChipBadge from './WhyChipBadge';
import SourceBadge from './SourceBadge';
import { AttendancePanel } from '@/app/pages/attendance/AttendancePanel';

type Props = { byEmployee: EmployeeActivitySummary[]; shiftMinutes?: number };

const TH = 'px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap';
const TD = 'px-3 py-2 text-sm text-slate-700 align-top';

const MAX_BAR = 480;

function ActiveBar({ activeMin, shiftMin }: { activeMin: number | null; shiftMin: number }) {
  if (activeMin === null) return <span className="text-slate-400">—</span>;
  const pct = Math.min(100, Math.round(((activeMin) / Math.max(shiftMin, 1)) * 100));
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
  const SUBTD = 'px-3 py-1.5 text-xs text-slate-600';
  return (
    <tr className="bg-slate-50 hover:bg-slate-100/50 transition-colors">
      <td className={SUBTD}>{fmtDayShort(d.date)}</td>
      <td className={SUBTD}>
        {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
        {' – '}
        {d.shownLastMin !== null ? (fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')) : '—'}
      </td>
      <td className={SUBTD}>{fmtDuration(d.activeMin)}</td>
      <td className={SUBTD}>{d.records <= 1 ? '—' : fmtDuration(d.breaksMin)}</td>
      <td className={SUBTD}>{d.why ? <WhyChipBadge chip={d.why} /> : null}</td>
      <td className={SUBTD}><SourceBadge official={d.official} edited={d.edited} /></td>
    </tr>
  );
}

function ExpandedHeader() {
  const SUBTH = 'px-3 py-1.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap bg-slate-100';
  return (
    <tr>
      <th className={SUBTH}>Date</th>
      <th className={SUBTH}>First – Last</th>
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
};

function EmployeeRow({ emp, onOpenPanel }: EmployeeRowProps) {
  const [expanded, setExpanded] = useState(false);
  const avgShift = emp.days.length > 0 ? (emp.days[0]?.shiftMinutes ?? MAX_BAR) : MAX_BAR;

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className={TD}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(e => !e)}
              className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />
              }
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

export default function ActivityByEmployee({ byEmployee }: Props) {
  const [panelEmp, setPanelEmp] = useState<EmployeeActivitySummary | null>(null);

  if (byEmployee.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <span className="text-sm">No activity for these filters.</span>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className={TH}>Employee</th>
              <th className={TH}>Days With Work</th>
              <th className={TH}>Avg Active</th>
              <th className={TH}>Avg First</th>
              <th className={TH}>Avg Last</th>
              <th className={TH}>Needs A Look</th>
              <th className={TH}>Away Days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {byEmployee.map(emp => (
              <EmployeeRow key={emp.employeeId} emp={emp} onOpenPanel={setPanelEmp} />
            ))}
          </tbody>
        </table>
      </div>

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
