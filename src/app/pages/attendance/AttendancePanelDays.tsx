import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import { STATUS_COLORS } from './AttendancePanelBody';
import WhyChipBadge from './activity/WhyChipBadge';
import SourceBadge from './activity/SourceBadge';
import GhostMark from './activity/GhostMark';

type Props = {
  days: ActivityDay[];
  attendanceRows?: AttendanceRow[];
};

const TH = 'px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap';
const TD = 'px-3 py-2 text-xs text-slate-700';

function toDateKey(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

export default function AttendancePanelDays({ days, attendanceRows = [] }: Props) {
  // Index attendance rows by YYYY-MM-DD for O(1) lookup
  const attByDate = new Map<string, AttendanceRow>();
  for (const r of attendanceRows) {
    const key = toDateKey(r.date);
    if (key) attByDate.set(key, r);
  }

  // Newest first
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold mb-3">
        <div className="w-0.5 h-3.5 bg-primary rounded-full" />
        Day By Day
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No activity data for this range.
        </p>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className={TH}>Date</th>
                  <th className={TH}>Entry</th>
                  <th className={TH}>Exit</th>
                  <th className={TH}>Active</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Late</th>
                  <th className={TH}>Why</th>
                  <th className={TH}>Source</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(d => {
                  const att = attByDate.get(d.date);
                  const rowBg = d.needsLook ? 'bg-amber-50 hover:bg-amber-100/20' : 'hover:bg-muted/20';
                  return (
                    <tr key={d.date} className={`border-b border-border/50 ${rowBg}`}>
                      <td className={TD}>{fmtDayShort(d.date)}</td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>
                        {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
                        <GhostMark ghostMin={d.ghostMin} />
                      </td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>
                        {d.shownLastMin !== null
                          ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')
                          : '—'}
                      </td>
                      <td className={`${TD} tabular-nums`}>{fmtDuration(d.activeMin)}</td>
                      <td className={TD}>
                        {att ? (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: STATUS_COLORS[att.status] ?? '#ccc' }}
                            />
                            <span className="whitespace-nowrap">{att.status}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className={`${TD} tabular-nums whitespace-nowrap`}>
                        {att && att.minutes_late > 0
                          ? <span className="text-amber-700">{att.minutes_late}m</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={TD}>
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
                          {d.why ? <WhyChipBadge chip={d.why} /> : <span className="text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className={TD}>
                        <SourceBadge official={d.official} edited={d.edited} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
