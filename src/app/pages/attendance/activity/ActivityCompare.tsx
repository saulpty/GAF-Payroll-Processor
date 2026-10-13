import type { EmployeeTrend, Measure, MeasureChange } from '@/app/lib/activityTrend';
import { changeText } from '@/app/lib/activityTrend';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import { TrendPill, toneClass } from './TrendPill';

type Props = { trend: EmployeeTrend; beforeLabel: string; afterLabel: string };

const TH = 'px-3 py-2 text-right text-[12px] font-semibold text-slate-500 whitespace-nowrap';
const TD = 'px-3 py-2 text-right text-[13px] tabular-nums whitespace-nowrap border-t border-slate-100';

function Row({ label, before, after, measure, change }: {
  label: string; before: string; after: string; measure: Measure; change: MeasureChange;
}) {
  return (
    <tr>
      <td className={`${TD} !text-left text-slate-600`}>{label}</td>
      <td className={`${TD} text-slate-700`}>{before}</td>
      <td className={`${TD} font-semibold text-slate-900`}>{after}</td>
      <td className={`${TD} text-[13px] font-semibold ${toneClass(change.tone)}`}>{changeText(measure, change)}</td>
    </tr>
  );
}

/** Before / After / Change for one employee. Only rendered when there is enough data. */
export default function ActivityCompare({ trend, beforeLabel, afterLabel }: Props) {
  const b = trend.before, a = trend.after;
  if (!b) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200">
        <span className="text-[13px] font-bold text-slate-800">Before and After</span>
        <TrendPill verdict={trend.verdict} />
      </div>
      <table className="w-full">
        <thead>
          <tr>
            <th className={TH} />
            <th className={TH}>Before<br /><span className="font-medium">{beforeLabel}</span></th>
            <th className={TH}>After<br /><span className="font-medium">{afterLabel}</span></th>
            <th className={TH}>Change</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Avg Active" before={fmtDuration(b.avgActiveMin)} after={fmtDuration(a.avgActiveMin)} measure="active" change={trend.active} />
          <Row label="Avg Entry" before={fmtClock(b.avgEntryMin)} after={fmtClock(a.avgEntryMin)} measure="entry" change={trend.entry} />
          <Row label="⚠️ Days" before={`${b.lowDays} of ${b.worked}`} after={`${a.lowDays} of ${a.worked}`} measure="low" change={trend.low} />
          <Row label="Days Missed" before={`${b.missedDays} of ${b.scheduled}`} after={`${a.missedDays} of ${a.scheduled}`} measure="missed" change={trend.missed} />
        </tbody>
      </table>
    </div>
  );
}
