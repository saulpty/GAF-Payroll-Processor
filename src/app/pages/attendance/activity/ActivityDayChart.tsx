import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { dayKind, fmtMinutes } from '@/app/lib/activityTrend';

type Props = {
  before: ActivityDay[]; after: ActivityDay[];
  beforeLabel: string; afterLabel: string;
  beforeAvg: number | null; afterAvg: number | null;
  today: string; startDate: string;
  thresholdMin: number;   // the low-activity minimum for this person's shift
};

type Bar = { date: string; kind: 'worked' | 'low' | 'missed'; activeMin: number };

// Only days that count in the comparison get a bar; oldest on the left.
function barsOf(days: ActivityDay[], today: string, startDate: string): Bar[] {
  const out: Bar[] = [];
  for (const d of days) {
    const k = dayKind(d, today, startDate);
    if (k === 'worked' || k === 'low' || k === 'missed') out.push({ date: d.date, kind: k, activeMin: d.activeMin });
  }
  return out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

function Group({ tag, label, bars, avg, scale, thresholdMin, withAxis, dark }: {
  tag: string; label: string; bars: Bar[]; avg: number | null; scale: number;
  thresholdMin: number; withAxis: boolean; dark: boolean;
}) {
  const pct = (m: number) => `${Math.min(100, Math.round((m / scale) * 1000) / 10)}%`;
  const ticks: number[] = [];
  for (let h = 0; h * 60 <= scale; h += 2) ticks.push(h);
  const summary = `${tag}, ${label}: ${bars.length} days, ${avg === null ? 'no days with work' : fmtMinutes(avg) + ' a day on average'}`;

  return (
    <div className="min-w-0" style={{ flex: Math.max(1, bars.length) }} role="img" aria-label={summary}>
      <div className={`flex items-baseline gap-2 flex-wrap px-2 py-1.5 rounded-t-md text-xs text-slate-600 ${dark ? 'bg-primary/10' : 'bg-slate-100'}`}>
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${dark ? 'bg-primary text-white' : 'bg-white text-slate-600'}`}>{tag}</span>
        <span className="text-[13px] font-bold text-slate-800">{label}</span>
        <span className="ml-auto text-sm font-bold text-slate-900 whitespace-nowrap">
          {avg === null ? 'No Days With Work' : `Avg Active ${fmtMinutes(avg)}`}
        </span>
      </div>
      <div className="relative h-40 flex items-end gap-1 px-1.5 border-x border-slate-200 border-b border-b-slate-400">
        {ticks.map(h => (
          <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: pct(h * 60) }}>
            {withAxis && <span className="absolute -left-11 w-9 -translate-y-1/2 text-right text-[11px] text-slate-500">{h}h</span>}
          </div>
        ))}
        <div className="absolute inset-x-0 z-[2] border-t-2 border-dashed border-status-yellow-ink" style={{ bottom: pct(thresholdMin) }} />
        {avg !== null && (
          <div className="absolute inset-x-0 z-[3] border-t-2 border-slate-900" style={{ bottom: pct(avg) }}>
            <span className="absolute right-1 bottom-0.5 px-1 rounded bg-white/90 text-[11px] font-bold text-slate-900 whitespace-nowrap">
              Average {fmtMinutes(avg)}
            </span>
          </div>
        )}
        {bars.map(b => (b.kind === 'missed' ? (
          <div key={b.date} title={`${fmtDayShort(b.date)}: missed`}
            className="relative flex-1 h-full flex items-center justify-center rounded-t bg-status-red-tint text-status-red-ink text-sm font-bold">✕</div>
        ) : (
          <div key={b.date} title={`${fmtDayShort(b.date)}: ${fmtMinutes(b.activeMin)} active`} className="relative flex-1 h-full flex items-end">
            <div className={`w-full rounded-t ${b.kind === 'low' ? 'bg-status-yellow-fill ring-1 ring-inset ring-status-yellow-ink' : 'bg-primary'}`}
              style={{ height: pct(b.activeMin) }} />
          </div>
        )))}
      </div>
      <div className="flex gap-1 px-1.5 pt-1" aria-hidden="true">
        {bars.map((b, i) => {
          const [dow, , day] = fmtDayShort(b.date).split(' ');
          // A long range has too many bars to label each one: label Mondays (and the first bar) only.
          const show = bars.length <= 26 || dow === 'Mon' || i === 0;
          return (
            <span key={b.date} className="flex-1 min-w-0 flex flex-col items-center text-[11px] leading-tight text-slate-500 whitespace-nowrap">
              {show ? <>{(dow ?? '').charAt(0)}<span className="block font-semibold text-slate-700">{day}</span></> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const SWATCH = 'inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]';

/** Hours active each day: one bar per day that counts, the earlier period on the left. */
export default function ActivityDayChart(p: Props) {
  const before = barsOf(p.before, p.today, p.startDate);
  const after = barsOf(p.after, p.today, p.startDate);
  const top = Math.max(480, p.thresholdMin, ...before.map(b => b.activeMin), ...after.map(b => b.activeMin));
  const scale = Math.ceil(top / 120) * 120;   // whole 2-hour steps

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200 text-[13px] font-bold text-slate-800">Hours Active Each Day</div>
      <div className="p-3">
        <p className="text-[13px] text-slate-600 mb-3">
          Each bar is one work day. A taller bar means more active time. The black line is the average for that period.
        </p>
        <div className="flex gap-5 ml-11">
          <Group tag="Before" label={p.beforeLabel} bars={before} avg={p.beforeAvg} scale={scale} thresholdMin={p.thresholdMin} withAxis dark={false} />
          <Group tag="After" label={p.afterLabel} bars={after} avg={p.afterAvg} scale={scale} thresholdMin={p.thresholdMin} withAxis={false} dark />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 ml-11 text-xs text-slate-600">
          <span><i className={`${SWATCH} bg-primary`} />Normal Day</span>
          <span><i className={`${SWATCH} bg-status-yellow-fill ring-1 ring-inset ring-status-yellow-ink`} />⚠️ Under the {fmtMinutes(p.thresholdMin)} Minimum</span>
          <span><i className={`${SWATCH} bg-status-red-tint ring-1 ring-inset ring-status-red-fill`} />✕ Missed, No Approved Reason</span>
          <span><i className="inline-block w-4 mr-1.5 align-[3px] border-t-2 border-slate-900" />Average</span>
          <span><i className="inline-block w-4 mr-1.5 align-[3px] border-t-2 border-dashed border-status-yellow-ink" />{fmtMinutes(p.thresholdMin)} Minimum</span>
        </div>
      </div>
    </div>
  );
}
