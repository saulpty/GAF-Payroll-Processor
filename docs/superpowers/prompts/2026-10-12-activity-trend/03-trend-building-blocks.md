# Activity trend, part 2a: four new building blocks (nothing visible yet)

**Copy every file and edit exactly, character for character. Do not rewrite, reformat or "improve"
anything else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these four NEW files may be created**, all in `src/app/pages/attendance/activity/`:
`TrendPill.tsx`, `ActivityCompare.tsx`, `ActivityDayChart.tsx`, `ActivityDaysSideBySide.tsx`.
**No other file may be touched.** No existing file is edited: no page, no lib, no action, no migration.
Nothing imports these files yet; the next prompt wires them in.

Design rules (src/DESIGN.md): tokens only, never a raw hex; Title Case for headings, column
headers and buttons; never ALL CAPS; numbers use `tabular-nums`.

## 1. New file `src/app/pages/attendance/activity/TrendPill.tsx` — the whole file

```tsx
import type { Measure, MeasureChange, Tone, Verdict } from '@/app/lib/activityTrend';
import { VERDICT_LABEL, changeText } from '@/app/lib/activityTrend';

// Excel status tokens for the three verdicts that mean something; neutral slate for the rest.
const LOOK: Record<Verdict, string> = {
  improved: 'bg-status-green-tint text-status-green-ink border-status-green-fill',
  worse:    'bg-status-red-tint text-status-red-ink border-status-red-fill',
  mixed:    'bg-status-yellow-tint text-status-yellow-ink border-status-yellow-fill',
  steady:   'bg-slate-100 text-slate-600 border-slate-200',
  nodata:   'bg-white text-slate-500 border-slate-200',
};

export function TrendPill({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-[3px] rounded-full text-xs font-medium border whitespace-nowrap ${LOOK[verdict]}`}>
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export const toneClass = (tone: Tone): string =>
  (tone === 'good' ? 'text-status-green-ink' : tone === 'bad' ? 'text-status-red-ink' : 'text-slate-500');

/** '12m earlier, better' — the words behind an arrow, for the tooltip and screen readers. */
export function arrowLabel(measure: Measure, change: MeasureChange): string {
  return `${changeText(measure, change)}, ${change.tone === 'good' ? 'better' : 'worse'}`;
}

/** Shown only when the measure moved past its minimum. The arrow is the direction the number
 *  went; the colour says whether that is good or bad. */
export function ChangeArrow({ measure, change }: { measure: Measure; change: MeasureChange }) {
  if (change.tone === '') return null;
  const label = arrowLabel(measure, change);
  return (
    <span className={`ml-1 text-xs font-bold ${toneClass(change.tone)}`} title={label} aria-label={label} role="img">
      {change.delta > 0 ? '↑' : '↓'}
    </span>
  );
}
```

## 2. New file `src/app/pages/attendance/activity/ActivityCompare.tsx` — the whole file

```tsx
import type { EmployeeTrend, Measure, MeasureChange } from '@/app/lib/activityTrend';
import { changeText } from '@/app/lib/activityTrend';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import { TrendPill, toneClass } from './TrendPill';

type Props = { trend: EmployeeTrend; beforeLabel: string; afterLabel: string };

const TH = 'px-3 py-2 text-right text-[12px] font-semibold text-slate-500 whitespace-nowrap';
const TD = 'px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap border-t border-slate-100';

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
```

## 3. New file `src/app/pages/attendance/activity/ActivityDayChart.tsx` — the whole file

```tsx
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
          {avg === null ? 'No days with work' : `${fmtMinutes(avg)} a day on average`}
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
        {bars.map(b => {
          const [dow, , day] = fmtDayShort(b.date).split(' ');
          return (
            <span key={b.date} className="flex-1 min-w-0 text-center text-[11px] leading-tight text-slate-500">
              {(dow ?? '').charAt(0)}<span className="block font-semibold text-slate-700">{day}</span>
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
          <span><i className={`${SWATCH} bg-primary`} />Normal day</span>
          <span><i className={`${SWATCH} bg-status-yellow-fill ring-1 ring-inset ring-status-yellow-ink`} />⚠️ Under the {fmtMinutes(p.thresholdMin)} minimum</span>
          <span><i className={`${SWATCH} bg-status-red-tint ring-1 ring-inset ring-status-red-fill`} />✕ Missed, no approved reason</span>
          <span><i className="inline-block w-4 mr-1.5 align-[3px] border-t-2 border-slate-900" />Average</span>
          <span><i className="inline-block w-4 mr-1.5 align-[3px] border-t-2 border-dashed border-status-yellow-ink" />{fmtMinutes(p.thresholdMin)} minimum</span>
        </div>
      </div>
    </div>
  );
}
```

## 4. New file `src/app/pages/attendance/activity/ActivityDaysSideBySide.tsx` — the whole file

```tsx
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
```

## Acceptance
Nothing visible changes. The four files exist and the project still builds.

When done, reply with a one-line summary per file.
