import InfoTip from '@/app/components/InfoTip';
import type { TodayRow } from '@/app/lib/teramindToday';
import type { WhyChip } from '@/app/lib/activityDays';
import { TodayTableRow } from './TodayRow';

// The Today board's table (moved out of AttendanceToday.tsx on 2026-10-06 to keep both under
// 15 KB). Warm look: Title Case headers on white, never ALL CAPS.
export default function TodayTable({
  rows, isToday, whyById, whyLoading, ghostByEmployee, onRowClick,
}: {
  rows: TodayRow[];
  isToday: boolean;
  whyById: Map<number, WhyChip | null>;
  whyLoading: boolean;
  ghostByEmployee: Map<number, number>;
  onRowClick?: (row: TodayRow) => void;
}) {
  const thCls = 'px-3 py-2.5 text-left text-[12px] font-semibold tracking-[0.02em] text-slate-600 whitespace-nowrap select-none';
  const tdCls = 'px-3 py-2.5 text-sm text-slate-800 align-top';

  // Event delegation: find the closest <tr> ancestor from the click target,
  // then match its index in rows array.
  function handleBodyClick(e: React.MouseEvent<HTMLTableSectionElement>) {
    if (!onRowClick) return;
    const tr = (e.target as Element).closest('tr');
    if (!tr) return;
    const tbody = tr.parentElement;
    if (!tbody) return;
    const idx = Array.from(tbody.children).indexOf(tr);
    if (idx >= 0 && idx < rows.length) onRowClick(rows[idx]);
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-white border-b border-slate-200">
            <tr>
              <th className={thCls}>Employee <InfoTip text="Employee name and role from the directory." /></th>
              <th className={thCls}>Status <InfoTip text="Current attendance status computed from Teramind activity and schedule." /></th>
              <th className={thCls}>Why <InfoTip text="Reason pulled from Monday.com forms or the holiday calendar." /></th>
              <th className={thCls}>Scheduled <InfoTip text="Contracted shift window for today from the employee's schedule." /></th>
              <th className={thCls}>Entry <InfoTip text="First Teramind activity recorded today." /></th>
              <th className={thCls}>Late <InfoTip text="Minutes after the scheduled start (plus grace period) the employee arrived." /></th>
              <th className={thCls}>Last Activity <InfoTip text="Most recent Teramind event recorded today." /></th>
              {isToday && <th className={thCls}>Idle <InfoTip text="Time since the last activity (live only)." /></th>}
              <th className={thCls}>Active Time <InfoTip text="Total time Teramind recorded active usage today." /></th>
              <th className={thCls}>Records <InfoTip text="Number of Teramind activity records imported for today." /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 cursor-pointer" onClick={handleBodyClick}>
            {rows.map(row => (
              <TodayTableRow
                key={row.employeeId}
                row={row}
                isToday={isToday}
                why={whyLoading ? undefined : (whyById.get(row.employeeId) ?? null)}
                ghostMin={ghostByEmployee.has(row.employeeId) ? (ghostByEmployee.get(row.employeeId) ?? null) : null}
                tdCls={tdCls}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
