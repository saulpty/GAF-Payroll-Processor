# PTO Tracker: "Coming Up" strip — who is out now and who is out later this year

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

A row of small cards between the page header and the table: everyone out **right now**
(highlighted), then everyone with PTO or a Floating Holiday booked for the **rest of this year**,
grouped by month. Pending Monday requests and recorded ones both show; withdrawn ones do not.
Each viewer only sees the employees they can already see in the tracker.

**Only these three files may change:**
- **New** `src/actions/loadPtoUpcoming.ts`: whole file below (read-only SQL).
- **New** `src/app/pages/pto/PtoComingUp.tsx`: whole file below.
- `src/app/pages/PtoTracker.tsx`: two edits below (one import, one line). Nothing else in it changes.

No other file may be touched (not `PtoTable.tsx`, `PtoRow.tsx`, `PtoBreakdown.tsx`,
`PtoSubRow.tsx`, `fmtDay.ts`, any other action, or `src/components/ui/*`).

## `src/actions/loadPtoUpcoming.ts` (whole file)

```ts
import { action } from '@uibakery/data';

// PTO + Floating Holiday that is happening now or starts on/before {{params.until}}.
// Pending = on Monday with no pto_approvals row (same test as loadPtoEmployeeDetail);
// recorded = pto_approvals.status 'recorded' (withdrawn left out). Scoped to the viewer.
function loadPtoUpcoming() {
  return action('loadPtoUpcoming', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT u.* FROM (
        SELECT e.id AS employee_id, e.display_name,
               CASE WHEN r.request_type = 'Floating Holiday' THEN 'floating_holiday' ELSE 'pto' END AS leave_type,
               r.start_date::text AS leave_on, r.return_date::text AS return_on,
               NULLIF(r.total_days_requested, 'NaN'::numeric)::numeric AS total_days,
               'pending' AS status
        FROM monday_requests r
        JOIN employees e ON e.id = r.employee_id
        LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
        WHERE r.request_type IN ('PTO / Vacation','Floating Holiday')
          AND r.deleted_on_monday = false AND a.id IS NULL
          AND r.return_date > {{params.today}}::date
          AND r.start_date <= {{params.until}}::date
          AND r.return_date >= r.start_date
          AND e.active = true
          AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.id IN (SELECT vm.employee_id FROM public.v_employee_managers vm WHERE vm.manager_name = {{params.manager}}::text))
          AND e.id IN (SELECT va.employee_id FROM public.v_employee_access va
                        WHERE va.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
        UNION ALL
        SELECT e.id AS employee_id, e.display_name,
               a.leave_type::text AS leave_type,
               a.leave_on::text AS leave_on, a.return_on::text AS return_on,
               a.total_days::numeric AS total_days,
               'recorded' AS status
        FROM pto_approvals a
        JOIN employees e ON e.id = a.employee_id
        WHERE a.status = 'recorded'
          AND a.return_on > {{params.today}}::date
          AND a.leave_on <= {{params.until}}::date
          AND a.return_on >= a.leave_on
          AND e.active = true
          AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.id IN (SELECT vm.employee_id FROM public.v_employee_managers vm WHERE vm.manager_name = {{params.manager}}::text))
          AND e.id IN (SELECT va.employee_id FROM public.v_employee_access va
                        WHERE va.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ) u
      ORDER BY u.leave_on, u.display_name
    `,
  });
}

export default loadPtoUpcoming;
```

## `src/app/pages/pto/PtoComingUp.tsx` (whole file)

```tsx
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
```

## `src/app/pages/PtoTracker.tsx`: two edits

1. After the line `import RecordApprovalDialog from './pto/RecordApprovalDialog';` add exactly:

```tsx
import PtoComingUp from './pto/PtoComingUp';
```

2. Directly after the closing `/>` of `<PageHeader ... />` and before
`<div className="flex-1 min-h-0 flex flex-col">`, add exactly this one line (same indentation as
`<PageHeader`):

```tsx
      <PtoComingUp today={today} refreshKey={refreshKey} />
```

## Report
- Byte size of the three files; confirm no other file changed, the PTO Tracker shows the
  Coming Up strip above the table, and there are no console errors.
