import { useEffect, useRef } from 'react';
import { useLoadAction } from '@uibakery/data';
import EmptyState from '@/app/components/EmptyState';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import loadPtoUpcomingAction from '@/actions/loadPtoUpcoming';
import { fmtDay, fmtLeaveDates } from '@/app/lib/fmtDay';

// "Coming Up" on the PTO Tracker (manager meeting, 2026-10-06): who is out now,
// then who is out for the rest of the year, grouped by month. Read-only.
// Warm look (Saul approved the mockup 2026-10-06): one white card, month headings
// above their cards, "Out Now" cards on the warm tint with a Back chip.
export interface UpcomingRow {
  employee_id: number;
  display_name: string;
  role: string | null;
  src_id: string;
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
      className={`shrink-0 w-56 rounded-lg border p-3 flex flex-col gap-1 ${out ? 'border-orange-200 bg-warm-tint' : 'border-slate-200 bg-white'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-slate-900" title={r.display_name}>{r.display_name}</span>
        <span aria-hidden="true">{fh ? '⭐' : '🌴'}</span>
      </div>
      <div className="text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
        {fmtLeaveDates(r.leave_on, r.return_on, thisYear)}
      </div>
      <div className="text-[12px] text-slate-500 whitespace-nowrap">
        {fh ? 'Floating Holiday' : 'PTO'}{days > 0 ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}
        {r.status === 'pending' ? ' · Pending' : ''}
      </div>
      {out ? (
        <span className="self-start mt-0.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-warm-text ring-1 ring-inset ring-orange-200 whitespace-nowrap">
          Back {fmtDay(r.return_on, thisYear)}
        </span>
      ) : (
        <div className="text-[12px] text-slate-500 whitespace-nowrap">Back {fmtDay(r.return_on, thisYear)}</div>
      )}
    </div>
  );
}

function GroupHeading({ label, count, warm }: { label: string; count?: number; warm?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 whitespace-nowrap">
      {warm && <span className="w-2 h-2 rounded-full bg-warm" aria-hidden="true" />}
      {label}
      {count !== undefined && <span className="font-medium text-slate-400">{count}</span>}
    </div>
  );
}

export default function PtoComingUp({ today, refreshKey }: { today: string; refreshKey: number }) {
  const { manager, employee, role, ptoVersion } = useGlobalFilters();
  const { viewAs } = useViewer();
  const thisYear = today.slice(0, 4);
  // Rest of the year; in December also show January so the strip is not empty before the holidays.
  const until = today.slice(5, 7) === '12' ? `${Number(thisYear) + 1}-01-31` : `${thisYear}-12-31`;

  const [raw, loading, error, reload] = useLoadAction(
    loadPtoUpcomingAction,
    [] as UpcomingRow[],
    { today, until, manager: manager || null, viewAs },
  );

  // Reload after the dialog saves (refreshKey) and after Withdraw / Restore (ptoVersion).
  const refreshRef = useRef(`${refreshKey}|${ptoVersion}`);
  useEffect(() => {
    const k = `${refreshKey}|${ptoVersion}`;
    if (refreshRef.current !== k) {
      refreshRef.current = k;
      reload();
    }
  }, [refreshKey, ptoVersion, reload]);

  // Same Employee / Title filters as the table below (Manager is applied in the loader).
  const rows = ((raw as UpcomingRow[]) ?? [])
    .filter(r =>
      (!employee || String(r.employee_id) === employee || r.display_name.toLowerCase().includes(employee.toLowerCase())) &&
      (!role || (r.role ?? '').toLowerCase().includes(role.toLowerCase())))
    .map(r => ({
      ...r,
      leave_on: String(r.leave_on ?? '').slice(0, 10),
      return_on: String(r.return_on ?? '').slice(0, 10),
    }));
  // The loader only returns leave whose return is after today, so starting on/before today = out now.
  const outNow = rows.filter(r => r.leave_on <= today);
  const later = rows.filter(r => r.leave_on > today);

  // Group the later ones by the month they start in (rows arrive sorted by leave_on).
  const groups: { month: string; label: string; rows: UpcomingRow[] }[] = [];
  for (const r of later) {
    const month = r.leave_on.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.month !== month) {
      g = { month, label: MONTHS[Number(month.slice(5, 7)) - 1] ?? month, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }

  return (
    <section aria-labelledby="pto-coming-up" className="mx-6 mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-baseline gap-3 mb-3">
        <h2 id="pto-coming-up" className="text-[16px] leading-[22px] font-semibold text-primary">Coming Up 🌴</h2>
        {rows.length > 0 && (
          <span className="text-[13px] text-slate-500">
            {outNow.length} out now · {later.length} later this year
          </span>
        )}
      </div>
      {loading && rows.length === 0 ? (
        <div className="flex gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="shrink-0 w-56 h-[104px] rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-[12px] text-red-600">Couldn&apos;t load upcoming time off — loadPtoUpcoming</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No One Is Out for the Rest of the Year" compact />
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-1">
          {outNow.length > 0 && (
            <div className="flex flex-col gap-2 shrink-0">
              <GroupHeading label="Out Now" warm />
              <div className="flex gap-2">
                {outNow.map(r => (
                  <LeaveCard key={r.src_id} r={r} out thisYear={thisYear} />
                ))}
              </div>
            </div>
          )}
          {outNow.length > 0 && groups.length > 0 && <div className="w-px bg-slate-200 shrink-0" />}
          {groups.map(g => (
            <div key={g.month} className="flex flex-col gap-2 shrink-0">
              <GroupHeading label={g.label} count={g.rows.length} />
              <div className="flex gap-2">
                {g.rows.map(r => (
                  <LeaveCard key={r.src_id} r={r} out={false} thisYear={thisYear} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
