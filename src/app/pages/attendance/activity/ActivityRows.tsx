import { useState } from 'react';
import type { ActivityDay, ActivitySettings, EmployeeActivitySummary } from '@/app/lib/activityDays';
import { fmtDayShort, thresholdFor } from '@/app/lib/activityDays';
import type { EmployeeTrend } from '@/app/lib/activityTrend';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import { AttendancePanel } from '@/app/pages/attendance/AttendancePanel';
import MobileRow from '@/app/components/mobile/MobileRow';
import { TrendPill, ChangeArrow } from './TrendPill';
import WhyChipBadge from './WhyChipBadge';

// The Activity lists on a phone: one row for each line of the computer's tables. Every list
// arrives already filtered and sorted by the table's own code, and every number is the one the
// table shows. Nothing is loaded, sorted or worked out again here.

// The page has 16px side padding; a phone list runs edge to edge.
const LIST = '-mx-4 bg-white border-t border-slate-200';
const HEADLINE = 'text-[14px] font-semibold text-slate-900 tabular-nums';
const PILL = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border';

/** "2 of 13"; a zero count is muted so the eye lands on the rows that have something. */
function OutOf({ n, of }: { n: number; of: number }) {
  return <span className={n === 0 ? 'text-slate-400' : 'text-slate-700'}>{n} of {of}</span>;
}

/** Grey placeholder rows while the page loads. */
export function RowsLoading() {
  return (
    <div className={LIST} role="status" aria-label="Loading activity data">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="h-[60px] border-b border-slate-200 bg-white animate-pulse" />
      ))}
    </div>
  );
}

type EmployeeRowsProps = {
  /** The table's own list, already sorted. */
  list: EmployeeActivitySummary[];
  trends: Record<number, EmployeeTrend>;
  /** The employee picked in Needs a Look (the row a computer opens in place). */
  openId?: number | null;
  /** Called with that employee's id when their panel is closed. */
  onClosePicked?: (employeeId: number) => void;
};

/** By Employee. Tap a row: the employee panel, opened as the name does on a computer. */
export function EmployeeRows({ list, trends, openId, onClosePicked }: EmployeeRowsProps) {
  const [tapped, setTapped] = useState<EmployeeActivitySummary | null>(null);
  // Nothing opens in place on a phone, so an employee picked in Needs a Look opens the panel too.
  const picked = openId == null ? null : list.find(e => e.employeeId === openId) ?? null;
  const panelEmp = tapped ?? picked;
  const closePanel = () => {
    setTapped(null);
    if (picked) onClosePicked?.(picked.employeeId);
  };

  return (
    <>
      <div className={LIST}>
        {list.map(emp => {
          const trend = trends[emp.employeeId];
          if (!trend) return null;
          // Same figures as the table row: the comparison's own days.
          const a = trend.after;
          return (
            <MobileRow
              key={emp.employeeId}
              title={emp.employeeName}
              sub={emp.role}
              right={<TrendPill verdict={trend.verdict} />}
              chevron="right"
              onClick={() => setTapped(emp)}
              facts={
                <>
                  <span>
                    Avg Active <span className="text-slate-700">{a.avgActiveMin !== null ? fmtDuration(a.avgActiveMin) : '—'}</span>
                    <ChangeArrow measure="active" change={trend.active} />
                  </span>
                  <span>
                    Low Activity <OutOf n={a.lowDays} of={a.worked} />
                    <ChangeArrow measure="low" change={trend.low} />
                  </span>
                  <span>
                    Missed <OutOf n={a.missedDays} of={a.scheduled} />
                    <ChangeArrow measure="missed" change={trend.missed} />
                  </span>
                </>
              }
            />
          );
        })}
      </div>

      {panelEmp && (
        <AttendancePanel
          stats={null}
          employeeId={panelEmp.employeeId}
          days={panelEmp.days}
          displayName={panelEmp.employeeName}
          displayRole={panelEmp.role}
          displayManager={panelEmp.manager}
          onClose={closePanel}
        />
      )}
    </>
  );
}

/** By Day. Reading only: a row opens nothing, exactly as in the table. */
export function DayRows({ days }: { days: ActivityDay[] }) {
  return (
    <div className={LIST}>
      {days.map(d => (
        <MobileRow
          key={`${d.employeeId}-${d.date}`}
          title={d.employeeName}
          sub={fmtDayShort(d.date)}
          right={<span className={HEADLINE}>{fmtDuration(d.activeMin)}</span>}
          tone={d.needsLook ? 'yellow' : 'none'}
          facts={
            <>
              <span>
                {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
                {' → '}
                {d.shownLastMin !== null ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '') : '—'}
              </span>
              <span>Breaks {d.records <= 1 ? '—' : fmtDuration(d.breaksMin)}</span>
              {d.needsLook && <span className={`${PILL} bg-amber-50 text-amber-700 border-amber-200`}>Needs A Look</span>}
              {d.flag === 'long_break' && <span className={`${PILL} bg-slate-100 text-slate-600 border-slate-200`}>Long Break</span>}
              {d.why && <WhyChipBadge chip={d.why} />}
              {d.ghostMin !== null && <span className="text-[12px]">Early Record {fmtClock(d.ghostMin)} Ignored</span>}
            </>
          }
        />
      ))}
    </div>
  );
}

type LookRowsProps = {
  /** The worst ten, already chosen and ordered by the Needs a Look box. */
  rows: ActivityDay[];
  settings: ActivitySettings;
  onPick?: (employeeId: number) => void;
};

/** Needs a Look, inside its amber box. Tap a row: the same call the table row makes. */
export function LookRows({ rows, settings, onPick }: LookRowsProps) {
  return (
    <div className="-mx-4 -mb-3 mt-2 bg-white border-t border-amber-200 rounded-b-lg overflow-hidden [&>div:last-child]:border-b-0">
      {rows.map(d => {
        const shortBy = Math.max(0, thresholdFor(d.shiftMinutes, settings) - d.activeMin);
        return (
          <MobileRow
            key={`${d.employeeId}-${d.date}`}
            title={d.employeeName}
            sub={fmtDayShort(d.date)}
            right={<span className={HEADLINE}>{d.records === 0 ? 'No records' : fmtDuration(d.activeMin)}</span>}
            chevron={onPick ? 'right' : 'none'}
            onClick={onPick ? () => onPick(d.employeeId) : undefined}
            facts={
              <>
                <span>Short By <span className="text-slate-700">{shortBy > 0 ? fmtDuration(shortBy) : '—'}</span></span>
                {d.why && <WhyChipBadge chip={d.why} />}
              </>
            }
          />
        );
      })}
    </div>
  );
}
