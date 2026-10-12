import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import type { PeriodSummary } from '@/app/lib/activityTrend';
import { dayKind } from '@/app/lib/activityTrend';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import WhyChipBadge from './WhyChipBadge';
import GhostMark from './GhostMark';

type Props = {
  before: ActivityDay[] | null;   // null: nothing to compare, show the current period only
  after: ActivityDay[];
  beforeLabel: string; afterLabel: string;
  beforeSum: PeriodSummary | null; afterSum: PeriodSummary;
  today: string; startDate: string;
};

const TH = 'px-3 py-1.5 text-right text-[12px] font-semibold text-slate-500 whitespace-nowrap bg-white';
const TD = 'px-3 py-1.5 text-right text-[13px] tabular-nums text-slate-700 whitespace-nowrap border-t border-slate-100';
const LEFT = '!text-left';

function DayRow({ d, today, startDate }: { d: ActivityDay; today: string; startDate: string }) {
  const kind = dayKind(d, today, startDate);
  const date = <td className={`${TD} ${LEFT}`}>{fmtDayShort(d.date)}{d.isToday ? ' · Today' : ''}</td>;

  if (kind === 'missed') {
    return (
      <tr className="bg-status-red-tint">
        {date}
        <td className={`${TD} ${LEFT} text-status-red-ink`} colSpan={5}>No work and no approved reason</td>
      </tr>
    );
  }
  if (kind === 'away') {
    return (
      <tr>
        {date}
        <td className={`${TD} ${LEFT}`} colSpan={5}>{d.why ? <WhyChipBadge chip={d.why} /> : '—'}</td>
      </tr>
    );
  }
  const worked = d.records > 0 || d.shownFirstMin !== null;
  return (
    <tr className={kind === 'low' ? 'bg-status-yellow-tint' : undefined}>
      {date}
      <td className={TD}>
        {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
        <GhostMark ghostMin={d.ghostMin} />
      </td>
      <td className={TD}>
        {d.shownLastMin !== null ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '') : '—'}
      </td>
      <td className={TD}>
        {worked ? fmtDuration(d.activeMin) : '—'}
        {kind === 'low' && <span className="ml-1" role="img" aria-label="Needs a look" title="Needs a look">⚠️</span>}
      </td>
      <td className={TD}>{d.records <= 1 ? '—' : fmtDuration(d.breaksMin)}</td>
      <td className={`${TD} ${LEFT}`}>
        <span className="inline-flex flex-wrap gap-1">
          {d.flag === 'long_break' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">Long Break</span>
          )}
          {d.why && d.why.kind !== 'none' ? <WhyChipBadge chip={d.why} /> : null}
        </span>
      </td>
    </tr>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 border-r border-slate-100 last:border-r-0">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-base font-semibold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}

function Period({ tag, label, days, sum, today, startDate, dark }: {
  tag: string; label: string; days: ActivityDay[]; sum: PeriodSummary | null;
  today: string; startDate: string; dark: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden min-w-0">
      <div className="flex items-baseline gap-2 flex-wrap px-3 py-2 border-b border-slate-200">
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${dark ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}>{tag}</span>
        <span className="text-[13px] font-bold text-slate-800">{label}</span>
        {sum && <span className="text-xs text-slate-500">{sum.worked} days with work</span>}
      </div>
      {sum && (
        <div className="grid grid-cols-4 border-b border-slate-200">
          <Figure label="Avg Active" value={fmtDuration(sum.avgActiveMin)} />
          <Figure label="Avg Entry" value={fmtClock(sum.avgEntryMin)} />
          <Figure label="⚠️ Days" value={`${sum.lowDays} of ${sum.worked}`} />
          <Figure label="Days Missed" value={`${sum.missedDays} of ${sum.scheduled}`} />
        </div>
      )}
      {days.length === 0 ? (
        <p className="px-3 py-4 text-[13px] text-slate-500">No scheduled days in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={`${TH} ${LEFT}`}>Date</th><th className={TH}>Entry</th><th className={TH}>Exit</th>
                <th className={TH}>Active</th><th className={TH}>Breaks</th><th className={`${TH} ${LEFT}`}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {days.map(d => <DayRow key={d.date} d={d} today={today} startDate={startDate} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Every day of both periods, newest first, the earlier period on the left. */
export default function ActivityDaysSideBySide(p: Props) {
  if (p.before === null) {
    return <Period tag="Selected" label={p.afterLabel} days={p.after} sum={null} today={p.today} startDate={p.startDate} dark />;
  }
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Period tag="Before" label={p.beforeLabel} days={p.before} sum={p.beforeSum} today={p.today} startDate={p.startDate} dark={false} />
      <Period tag="After" label={p.afterLabel} days={p.after} sum={p.afterSum} today={p.today} startDate={p.startDate} dark />
    </div>
  );
}
