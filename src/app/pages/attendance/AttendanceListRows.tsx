import { useState } from 'react';
import type { EmpStats } from '@/app/lib/attendanceStats';
import {
  PHONE_SORTS, filterByName, listNothingFound, phoneSort, sortEmployeeStats,
} from '@/app/lib/attendanceSort';
import MobileRow from '@/app/components/mobile/MobileRow';
import { REPORTING_TOOLTIP, ReportingBadge, STATUS_TOOLTIP, StatusBadge } from './AttendanceTable';

// Attendance → List on a phone: one row per employee, built from the same list, the same search
// and the same ordering rule as AttendanceTable. The page renders this OR the table, never both.
// The Good / Fair / At Risk pill and the Reporting pill are the table's own, imported.

type Props = {
  stats: EmpStats[];
  /** Opens the employee panel: the same callback a click on a table row calls. */
  onRowClick: (email: string) => void;
  /** The employee search box. */
  search: string;
  /** The Manager and Title filters, only to name them when nobody matches. */
  manager?: string;
  role?: string;
};

// The page has 16px side padding; a phone list runs edge to edge.
const LIST = '-mx-4 bg-white border-t border-slate-200';

/** Grey placeholder rows at the real row height, shown while the page is loading. */
export function AttendanceListLoading() {
  return (
    <div className={LIST} role="status" aria-label="Loading attendance data">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="h-[60px] border-b border-slate-200 bg-white animate-pulse px-4 py-3">
          <div className="h-3.5 w-40 rounded bg-slate-200" />
          <div className="mt-2.5 h-3 w-56 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function AttendanceListRows({ stats, onRowClick, search, manager, role }: Props) {
  const [sortKey, setSortKey] = useState<string>(PHONE_SORTS[0].key);
  const sort = phoneSort(sortKey);
  const sorted = sortEmployeeStats(filterByName(stats, search), sort.key, sort.dir);

  return (
    <div>
      <label className="flex items-center gap-3 text-[13px] font-medium text-slate-600">
        <span className="shrink-0">Sort By</span>
        <select
          value={sort.key}
          onChange={e => setSortKey(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
        >
          {PHONE_SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>

      {/* On a computer these two sentences are mouse-over notes on the column headers. */}
      <details className="mb-1 text-[12px] leading-4 text-slate-500">
        <summary className="cursor-pointer py-3.5 font-medium text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
          What Status and Reporting Mean
        </summary>
        <p className="pb-1"><span className="font-medium text-slate-700">Status.</span> {STATUS_TOOLTIP}</p>
        <p className="pb-3"><span className="font-medium text-slate-700">Reporting.</span> {REPORTING_TOOLTIP}</p>
      </details>

      {sorted.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {listNothingFound({ employee: search, manager, role })}
        </div>
      ) : (
        <div className={LIST}>
          {sorted.map(s => (
            <MobileRow
              key={s.email}
              title={s.name}
              sub={s.role || undefined}
              right={<StatusBadge pct={s.pctOnTime} days={s.days} />}
              chevron="right"
              onClick={() => onRowClick(s.email)}
              facts={
                <>
                  <span><span className="font-medium text-slate-700">{s.pctOnTime.toFixed(0)}%</span> on time</span>
                  <span>Late {s.totalLate}</span>
                  <span>Unreported {s.unreported}</span>
                  <span>Absent {s.absent}</span>
                  <span className="inline-flex items-center gap-1.5">Reporting <ReportingBadge s={s} /></span>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
