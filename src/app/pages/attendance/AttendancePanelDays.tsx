import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import WhyChipBadge from './activity/WhyChipBadge';
import SourceBadge from './activity/SourceBadge';

type Props = { days: ActivityDay[] };

const TH = 'px-3 py-2 text-left text-xs font-semibold text-muted-foreground';
const TD = 'px-3 py-2 text-xs text-slate-700';

export default function AttendancePanelDays({ days }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold mb-3">
        <div className="w-0.5 h-3.5 bg-primary rounded-full" />
        Day By Day
      </div>

      {days.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No activity data for this range.
        </p>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className={TH}>Date</th>
                <th className={TH}>Entry</th>
                <th className={TH}>Exit</th>
                <th className={TH}>Active</th>
                <th className={TH}>Why</th>
                <th className={TH}>Source</th>
              </tr>
            </thead>
            <tbody>
              {days.map(d => {
                const rowBg = d.needsLook ? 'bg-amber-50 hover:bg-amber-100/20' : 'hover:bg-muted/20';
                return (
                  <tr key={d.date} className={`border-b border-border/50 ${rowBg}`}>
                    <td className={TD}>{fmtDayShort(d.date)}</td>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>
                      {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
                    </td>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>
                      {d.shownLastMin !== null
                        ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')
                        : '—'}
                    </td>
                    <td className={`${TD} tabular-nums`}>{fmtDuration(d.activeMin)}</td>
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
      )}
    </div>
  );
}
