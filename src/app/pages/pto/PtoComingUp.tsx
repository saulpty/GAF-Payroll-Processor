import { Fragment, useEffect, useRef } from 'react';
import { useLoadAction } from '@uibakery/data';
import EmptyState from '@/app/components/EmptyState';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import loadPtoUpcomingAction from '@/actions/loadPtoUpcoming';
import { fmtDay, fmtLeaveDates } from '@/app/lib/fmtDay';

// "Coming Up" strip on the PTO Tracker (manager meeting, 2026-10-06): who is out now,
// then who is out for the rest of the year, grouped by month. Read-only.
export interface UpcomingRow {
  employee_id: number;
  display_name: string;
  leave_type: 'pto' | 'floating_holiday';
  leave_on: string;
  return_on: string;
  total_days: number | string | null;
  status: 'pending' | 'recorded';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function LeaveCard({ r, out, thisYear }: { r: UpcomingRow; out: boolean; thisYear: string }) {
  const days = Number(r.total_days) || 0;
  const fh = r.leave_type === 'floating_holiday';
  return (
    <div
      className={`shrink-0 w-56 rounded-xl border px-3 py-2 ${out ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-slate-900" title={r.display_name}>{r.display_name}</span>
        <span aria-hidden="true">{fh ? '⭐' : '🌴'}</span>
      </div>
      <div className="text-[12px] text-slate-700 tabular-nums whitespace-nowrap">
        {fmtLeaveDates(r.leave_on, r.return_on, thisYear)}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-500 whitespace-nowrap">
        {fh ? 'Floating Holiday' : 'PTO'}{days > 0 ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}
        {r.status === 'pending' ? ' · Pending' : ''}
      </div>
      <div className={`mt-1 text-[11px] whitespace-nowrap ${out ? 'font-medium text-amber-700' : 'text-slate-400'}`}>
        {out ? 'Out now · ' : ''}Back {fmtDay(r.return_on, thisYear)}
      </div>
    </div>
  );
}

function GroupLabel({ children, warm }: { children: string; warm?: boolean }) {
  return (
    <div
      className={`shrink-0 self-center px-1 text-[11px] font-semibold uppercase tracking-wide ${warm ? 'text-amber-700' : 'text-slate-400'}`}
    >
      {children}
    </div>
  );
}

export default function PtoComingUp({ today, refreshKey }: { today: string; refreshKey: number }) {
  const { manager } = useGlobalFilters();
  const { viewAs } = useViewer();
  const thisYear = today.slice(0, 4);
  const until = `${thisYear}-12-31`;

  const [raw, loading, error, reload] = useLoadAction(
    loadPtoUpcomingAction,
    [] as UpcomingRow[],
    { today, until, manager: manager || null, viewAs },
  );

  const refreshRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshRef.current !== refreshKey) {
      refreshRef.current = refreshKey;
      reload();
    }
  }, [refreshKey, reload]);

  const rows = ((raw as UpcomingRow[]) ?? []).map(r => ({
    ...r,
    leave_on: String(r.leave_on ?? '').slice(0, 10),
    return_on: String(r.return_on ?? '').slice(0, 10),
  }));
  // The loader only returns leave whose return is after today, so starting on/before today = out now.
  const outNow = rows.filter(r => r.leave_on <= today);
  const later = rows.filter(r => r.leave_on > today);

  return (
    <section aria-labelledby="pto-coming-up" className="mx-6 mb-3">
      <div className="flex items-baseline gap-2 mb-2">
        <h2 id="pto-coming-up" className="text-[13px] font-semibold text-slate-800">Coming Up 🌴</h2>
        {rows.length > 0 && (
          <span className="text-[12px] text-slate-400">
            {outNow.length} out now · {later.length} later this year
          </span>
        )}
      </div>
      {loading && rows.length === 0 ? (
        <div className="flex gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="shrink-0 w-56 h-[86px] rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-[12px] text-red-600">Couldn&apos;t load upcoming time off — loadPtoUpcoming</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No One Is Out for the Rest of the Year" compact />
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {outNow.length > 0 && <GroupLabel warm>Out Now</GroupLabel>}
          {outNow.map(r => (
            <LeaveCard key={`n-${r.status}-${r.employee_id}-${r.leave_on}`} r={r} out thisYear={thisYear} />
          ))}
          {later.map((r, i) => {
            const month = r.leave_on.slice(0, 7);
            const newMonth = i === 0 || later[i - 1].leave_on.slice(0, 7) !== month;
            return (
              <Fragment key={`l-${r.status}-${r.employee_id}-${r.leave_on}`}>
                {newMonth && <GroupLabel>{MONTHS[Number(month.slice(5, 7)) - 1] ?? month}</GroupLabel>}
                <LeaveCard r={r} out={false} thisYear={thisYear} />
              </Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}
