import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ActivityDay, ActivitySettings } from '@/app/lib/activityDays';
import { fmtDayShort, addDays, thresholdFor } from '@/app/lib/activityDays';
import { fmtDuration } from '@/app/lib/teramindToday';
import WhyChipBadge from './WhyChipBadge';

type Props = {
  days: ActivityDay[];
  dateTo: string;
  settings: ActivitySettings;
  onPick?: (employeeId: number) => void;
};

const TH = 'px-2 py-1 text-left text-[10px] font-semibold text-amber-700 uppercase tracking-wide whitespace-nowrap';
const TD = 'px-2 py-1.5 text-xs text-amber-900 align-middle';

/** True when `date` falls in the last 7 calendar days of the range (inclusive). */
function inLast7(date: string, dateTo: string): boolean {
  // d is in window iff d <= dateTo AND addDays(d, 6) >= dateTo
  return date <= dateTo && addDays(date, 6) >= dateTo;
}

/**
 * Step a YYYY-MM-DD string back by one day using the same month-length
 * arithmetic addDays uses — no new Date(), no toISOString().
 */
function stepBack(date: string): string {
  let y = Number(date.slice(0, 4));
  let m = Number(date.slice(5, 7));
  let d = Number(date.slice(8, 10)) - 1;
  if (d < 1) {
    if (--m < 1) { m = 12; y -= 1; }
    // days in the new month
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const DIMS = [0,31,isLeap?29:28,31,30,31,30,31,31,30,31,30,31];
    d = DIMS[m];
  }
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Derive the earliest date in the last-7 window by stepping back from dateTo
 * up to 6 times — giving the window start regardless of which dates are present.
 */
function windowStartDate(dateTo: string): string {
  let cur = dateTo;
  for (let i = 0; i < 6; i++) cur = stepBack(cur);
  return cur;
}

export default function ActivityNeedsLook({ days, dateTo, settings, onPick }: Props) {
  const flagged = days.filter(d => d.needsLook);
  const totalFlagged = flagged.length;

  const windowRows = useMemo(() => {
    const inWindow = flagged.filter(d => inLast7(d.date, dateTo));
    // Sort: lowest activeMin first, then newest date first, then name
    inWindow.sort((a, b) => {
      if (a.activeMin !== b.activeMin) return a.activeMin - b.activeMin;
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return a.employeeName.localeCompare(b.employeeName);
    });
    return inWindow.slice(0, 10);
  }, [days, dateTo]);

  if (totalFlagged === 0) return null;

  const headingStart = fmtDayShort(windowStartDate(dateTo));
  const headingEnd   = fmtDayShort(dateTo);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-sm font-semibold text-amber-800">
            Needs A Look — Worst 10, {headingStart} – {headingEnd}
          </span>
        </div>
        <span className="text-xs text-amber-600 whitespace-nowrap">
          {totalFlagged} flagged {totalFlagged === 1 ? 'day' : 'days'} in the whole range
        </span>
      </div>

      {windowRows.length === 0 ? (
        <p className="text-xs text-amber-700/70 italic py-1">Nothing To Look At In The Last 7 Days</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-amber-200">
                <th className={TH}>Employee</th>
                <th className={TH}>Date</th>
                <th className={TH}>Active</th>
                <th className={TH}>Short By</th>
                <th className={TH}>Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {windowRows.map(d => {
                const threshold = thresholdFor(d.shiftMinutes, settings);
                const shortBy   = Math.max(0, threshold - d.activeMin);
                return (
                  <tr
                    key={`${d.employeeId}-${d.date}`}
                    className={onPick ? 'cursor-pointer hover:bg-amber-100/60 transition-colors' : ''}
                    onClick={onPick ? () => onPick(d.employeeId) : undefined}
                  >
                    <td className={`${TD} font-medium`}>
                      {onPick ? (
                        <button
                          type="button"
                          className="hover:underline underline-offset-2 text-amber-900 transition-colors text-left"
                          onClick={e => { e.stopPropagation(); onPick(d.employeeId); }}
                        >
                          {d.employeeName}
                        </button>
                      ) : (
                        d.employeeName
                      )}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{fmtDayShort(d.date)}</td>
                    <td className={`${TD} tabular-nums whitespace-nowrap`}>
                      {d.records === 0 ? 'No Records' : fmtDuration(d.activeMin)}
                    </td>
                    <td className={`${TD} tabular-nums whitespace-nowrap`}>
                      {shortBy > 0 ? fmtDuration(shortBy) : '—'}
                    </td>
                    <td className={TD}>
                      {d.why ? <WhyChipBadge chip={d.why} /> : <span className="text-amber-700/50">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
