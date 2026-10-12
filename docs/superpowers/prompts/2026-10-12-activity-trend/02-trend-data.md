# Activity trend, part 1: the calculation and the data (nothing visible yet)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these files may change.** One new: `src/app/lib/activityTrend.ts`. Two edited:
`src/app/pages/attendance/activity/useActivityData.ts`, `src/AGENTS.md`. **No other file may be
touched.** No migration, no action file, no page file.

Dates are 'YYYY-MM-DD' strings compared as strings. Never `new Date(str)` for date maths, never
`toISOString()`. Loader parameters stay flat (no `{ params: ... }` wrapper).

## 1. New file `src/app/lib/activityTrend.ts` — the whole file

```ts
// Activity trend: one date range against the same number of days right before it. Pure: type-only
// imports, no Date maths ('YYYY-MM-DD' strings). Contract 2026-10-12, spec
// docs/superpowers/specs/2026-10-12-activity-trend-design.md (git repo).

import type { ActivityDay, ActivityTotals } from './activityTypes';

export type TrendMinimums = { activeMinutes: number; entryMinutes: number; days: number; workedDays: number };
export const DEFAULT_TREND_MINIMUMS: TrendMinimums = { activeMinutes: 30, entryMinutes: 10, days: 2, workedDays: 5 };

/** worked = normal day with work, low = day with work under the minimum, missed = no work and no
 *  approved reason, away = approved reason, skip = not part of the comparison at all. */
export type DayKind = 'worked' | 'low' | 'missed' | 'away' | 'skip';
export type Tone = 'good' | 'bad' | '';
export type Verdict = 'improved' | 'worse' | 'mixed' | 'steady' | 'nodata';
export type Measure = 'active' | 'entry' | 'low' | 'missed';

export type PeriodSummary = {
  scheduled: number;            // days that count: worked + missed
  worked: number;               // days with work (normal + low)
  avgActiveMin: number | null; avgEntryMin: number | null;
  lowDays: number; missedDays: number;
};
export type MeasureChange = { delta: number; tone: Tone };
export type EmployeeTrend = {
  verdict: Verdict; before: PeriodSummary | null; after: PeriodSummary;
  active: MeasureChange; entry: MeasureChange; low: MeasureChange; missed: MeasureChange;
};
export type TotalsChange = { avgActiveMin: number | null; daysWorkedBefore: number; needsLook: number; lateArrivals: number };

export const VERDICT_LABEL: Record<Verdict, string> = {
  improved: 'Improved', worse: 'Worse', mixed: 'Mixed', steady: 'Steady', nodata: 'Not enough data',
};
/** Sort order for the Trend column: the people to look at first come first. */
export const VERDICT_ORDER: Record<Verdict, number> = { worse: 0, mixed: 1, steady: 2, improved: 3, nodata: 4 };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = (n: number) => (n < 10 ? '0' + n : String(n));
function daysInMonth(y: number, m: number): number {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}
function step(date: string, dir: 1 | -1): string {
  let y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10)) + dir;
  if (d < 1) { if (--m < 1) { m = 12; y -= 1; } d = daysInMonth(y, m); }
  else if (d > daysInMonth(y, m)) { d = 1; if (++m > 12) { m = 1; y += 1; } }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** '2026-10-01', 1 -> '2026-09-30'. */
export function subDays(date: string, n: number): string {
  if (!YMD.test(date)) return date;
  let cur = date;
  for (let i = 0; i < Math.max(0, Math.floor(n)); i++) cur = step(cur, -1);
  return cur;
}

/** The same number of calendar days, ending the day before dateFrom. days = 0 when the range is not valid. */
export function previousRange(dateFrom: string, dateTo: string): { from: string; to: string; days: number } {
  if (!YMD.test(dateFrom) || !YMD.test(dateTo) || dateFrom > dateTo) return { from: dateFrom, to: dateFrom, days: 0 };
  let days = 1;
  for (let cur = dateFrom; cur < dateTo && days < 1000; cur = step(cur, 1)) days += 1;
  return { from: subDays(dateFrom, days), to: subDays(dateFrom, 1), days };
}

/** 'Sep 5 – Sep 23'; years are added only when the two ends are in different years. */
export function rangeLabel(from: string, to: string): string {
  const part = (s: string, withYear: boolean) =>
    `${MON[Number(s.slice(5, 7)) - 1] ?? ''} ${Number(s.slice(8, 10))}${withYear ? ', ' + s.slice(0, 4) : ''}`;
  if (!YMD.test(from) || !YMD.test(to)) return '';
  const years = from.slice(0, 4) !== to.slice(0, 4);
  return `${part(from, years)} – ${part(to, years)}`;
}

const EXCUSED = ['pto', 'permission', 'sick', 'holiday', 'day_off'];

/** How one day counts in the comparison. Today and later never count (today is a partial day);
 *  neither does a day before the employee's start date. */
export function dayKind(d: ActivityDay, today: string, startDate = ''): DayKind {
  if (!d.scheduled || d.isToday || d.date >= today) return 'skip';
  if (startDate !== '' && d.date < startDate.slice(0, 10)) return 'skip';
  const hasActivity = d.records > 0 || d.firstMin !== null || d.officialEntryMin !== null;
  if (d.why && (EXCUSED.indexOf(d.why.kind) >= 0 || (d.why.kind === 'form' && !hasActivity))) return 'away';
  if (!hasActivity) return 'missed';
  return d.needsLook ? 'low' : 'worked';
}

function avg(vals: (number | null)[]): number | null {
  const ns = vals.filter((v): v is number => v !== null);
  return ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : null;
}

export function summarisePeriod(days: ActivityDay[], today: string, startDate = ''): PeriodSummary {
  const worked: ActivityDay[] = [];
  let lowDays = 0, missedDays = 0;
  for (const d of days ?? []) {
    const k = dayKind(d, today, startDate);
    if (k === 'missed') missedDays += 1;
    else if (k === 'worked' || k === 'low') { worked.push(d); if (k === 'low') lowDays += 1; }
  }
  return {
    scheduled: worked.length + missedDays, worked: worked.length,
    avgActiveMin: avg(worked.map((d) => d.activeMin)),
    avgEntryMin: avg(worked.map((d) => d.shownFirstMin ?? d.firstMin)),
    lowDays, missedDays,
  };
}

const NONE: MeasureChange = { delta: 0, tone: '' };
function change(before: number | null, after: number | null, min: number, lowerIsBetter: boolean): MeasureChange {
  if (before === null || after === null) return NONE;
  const delta = after - before;
  if (Math.abs(delta) < Math.max(1, min)) return { delta, tone: '' };
  return { delta, tone: (delta < 0) === lowerIsBetter ? 'good' : 'bad' };
}

export function compareEmployee(
  before: PeriodSummary | null, after: PeriodSummary, min: TrendMinimums = DEFAULT_TREND_MINIMUMS,
): EmployeeTrend {
  if (!before || before.worked < min.workedDays || after.worked < min.workedDays) {
    return { verdict: 'nodata', before, after, active: NONE, entry: NONE, low: NONE, missed: NONE };
  }
  const active = change(before.avgActiveMin, after.avgActiveMin, min.activeMinutes, false);
  const entry = change(before.avgEntryMin, after.avgEntryMin, min.entryMinutes, true);
  const low = change(before.lowDays, after.lowDays, min.days, true);
  const missed = change(before.missedDays, after.missedDays, min.days, true);
  const tones = [active.tone, entry.tone, low.tone, missed.tone];
  const good = tones.indexOf('good') >= 0, bad = tones.indexOf('bad') >= 0;
  const verdict: Verdict = good && bad ? 'mixed' : good ? 'improved' : bad ? 'worse' : 'steady';
  return { verdict, before, after, active, entry, low, missed };
}

/** Raw differences for the four top cards (no minimums). */
export function compareTotals(before: ActivityTotals, after: ActivityTotals): TotalsChange {
  return {
    avgActiveMin: before.avgActiveMin === null || after.avgActiveMin === null ? null : after.avgActiveMin - before.avgActiveMin,
    daysWorkedBefore: before.daysWorked,
    needsLook: after.needsLook - before.needsLook,
    lateArrivals: after.lateArrivals - before.lateArrivals,
  };
}

/** Same shape as fmtDuration in teramindToday: '45m', '2h', '1h 11m'. */
export function fmtMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes)), h = Math.floor(total / 60), m = total % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** The Change cell: '+1h 11m', '12m earlier', '5 fewer', or 'About the same' under the minimum. */
export function changeText(measure: Measure, c: MeasureChange): string {
  if (c.tone === '') return 'About the same';
  const n = Math.abs(c.delta);
  if (measure === 'active') return `${c.delta > 0 ? '+' : '−'}${fmtMinutes(n)}`;
  if (measure === 'entry') return `${fmtMinutes(n)} ${c.delta < 0 ? 'earlier' : 'later'}`;
  return `${n} ${c.delta < 0 ? 'fewer' : 'more'}`;
}
```

## 2. Edits to `src/app/pages/attendance/activity/useActivityData.ts`

Make exactly these nine edits and nothing else in this file.

**2a.** After the line `import { buildActivityDays } from '@/app/lib/activityDays';` add:

```ts
import { previousRange, summarisePeriod, compareEmployee, compareTotals, DEFAULT_TREND_MINIMUMS } from '@/app/lib/activityTrend';
import type { EmployeeTrend, TrendMinimums, TotalsChange } from '@/app/lib/activityTrend';
```

**2b.** In `ActivityDataResult`, after `settings: ActivitySettings;` add:

```ts
  prev: { from: string; to: string; days: number };
  today: string;
  trends: Record<number, EmployeeTrend>;
  prevDays: Record<number, ActivityDay[]>;
  startDates: Record<number, string>;
  totalsChange: TotalsChange | null;
  minimums: TrendMinimums;
```

**2c.** Directly above `export function useActivityData(` add:

```ts
const TREND_KEYS: [keyof TrendMinimums, string][] = [
  ['activeMinutes', 'activity_trend_min_active_minutes'],
  ['entryMinutes', 'activity_trend_min_entry_minutes'],
  ['days', 'activity_trend_min_days'],
  ['workedDays', 'activity_trend_min_worked_days'],
];

function parseMinimums(rows: ConfigRow[]): { minimums: TrendMinimums; fallbacks: string[] } {
  const minimums: TrendMinimums = { ...DEFAULT_TREND_MINIMUMS };
  const fallbacks: string[] = [];
  for (const [field, key] of TREND_KEYS) {
    const n = Number(rows.find(r => r.category === 'teramind' && r.key === key)?.value);
    if (Number.isFinite(n) && n > 0) minimums[field] = n; else fallbacks.push(key);
  }
  return { minimums, fallbacks };
}

// Postgres can hand a date back as a full timestamp: compare the first 10 characters, as strings.
const inRange = (date: string | null | undefined, from: string, to: string): boolean => {
  const d = String(date ?? '').slice(0, 10);
  return d >= from && d <= to;
};

const NO_PREV = { from: '', to: '', days: 0 };
```

**2d.** Replace

```ts
export function useActivityData({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }): ActivityDataResult {
```

with

```ts
// compare: also load the same number of days right before the range and work out each
// employee's trend. Only the Activity page asks for it; the side panel loads its range only.
export function useActivityData({ dateFrom, dateTo, compare = false }: { dateFrom: string; dateTo: string; compare?: boolean }): ActivityDataResult {
```

**2e.** After the line `const safeTo   = dateTo   || toLocalYMD(new Date());` add:

```ts

  const prev = compare ? previousRange(safeFrom, safeTo) : NO_PREV;
  const spanFrom = prev.days > 0 ? prev.from : safeFrom;
```

**2f.** In the four loader lines for `loadTeramindActivityDaysAction`, `loadAttendanceReportDaysAction`, `loadMondayAttendanceFormsRangeAction` and `loadMondayRequestsRangeAction`, replace `dateFrom: safeFrom, dateTo: safeTo` with `dateFrom: spanFrom, dateTo: safeTo`. Change nothing else on those lines.

**2g.** In the `if (error) { … }` branch of the `useMemo`, replace `configFallbacks: [],` with:

```ts
        configFallbacks: [],
        prev, today: toLocalYMD(new Date()), trends: {}, prevDays: {}, startDates: {},
        totalsChange: null, minimums: { ...DEFAULT_TREND_MINIMUMS },
```

**2h.** Replace everything from the line `const { settings, fallbacks: configFallbacks } = parseSettings(configRows);` down to and including `return { days, byEmployee, totals, settings, configFallbacks };` with:

```ts
    const { settings, fallbacks: settingFallbacks } = parseSettings(configRows);
    const { minimums, fallbacks: minimumFallbacks } = parseMinimums(configRows);
    const configFallbacks = [...settingFallbacks, ...minimumFallbacks];

    const activityEmployees: ActivityEmployee[] = employees.map(e => ({
      id: e.id,
      name: e.name,
      role: e.role,
      manager: e.manager,
      work_days: e.work_days,
      schedule_start: e.standard_start,
      schedule_end: e.standard_end,
    }));

    const isScheduledFor = (emp: unknown, date: string) =>
      isScheduledWorkDay(
        new Date(date + 'T12:00:00'),
        (emp as { work_days?: string }).work_days,
      );

    const today = toLocalYMD(new Date());

    // One period, built the way the tab has always built its range: the attendance report over
    // that period's own payroll rows and forms, then the activity days on top of it. The loaders
    // return both periods; each build sees only its own, so the selected range is unchanged.
    const build = (from: string, to: string) => {
      const { rows: reportRows } = buildAttendanceReport({
        dateFrom: from,
        dateTo: to,
        employees,
        payrollRows: payrollRows.filter((r) => inRange(r.work_date, from, to)),
        forms: forms.filter((f) => inRange(f.form_date, from, to)),
        requests,
        holidays,
        periods,
        dstWindows,
        helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
      });
      return buildActivityDays({
        dateFrom: from,
        dateTo: to,
        today,
        employees: activityEmployees,
        rows: tmRows as unknown as ActivityDayRow[],
        reportRows,
        requests,
        settings,
        isScheduledWorkDay: isScheduledFor,
      });
    };

    const { days, byEmployee, totals } = build(safeFrom, safeTo);
    const before = prev.days > 0 ? build(prev.from, prev.to) : null;

    const prevDays: Record<number, ActivityDay[]> = {};
    for (const b of before?.byEmployee ?? []) prevDays[b.employeeId] = b.days;
    const startDates: Record<number, string> = {};
    for (const e of employees) startDates[Number(e.id)] = String(e.start_date ?? '').slice(0, 10);
    const trends: Record<number, EmployeeTrend> = {};
    for (const e of byEmployee) {
      const start = startDates[e.employeeId] ?? '';
      const earlier = prevDays[e.employeeId];
      trends[e.employeeId] = compareEmployee(
        earlier ? summarisePeriod(earlier, today, start) : null,
        summarisePeriod(e.days, today, start),
        minimums,
      );
    }
    const totalsChange = before ? compareTotals(before.totals, totals) : null;

    return { days, byEmployee, totals, settings, configFallbacks, prev, today, trends, prevDays, startDates, totalsChange, minimums };
```

Note: the existing `new Date(date + 'T12:00:00')` inside `isScheduledFor` is unchanged existing code, kept exactly.

**2i.** In the `useMemo` dependency array, add `spanFrom` after `safeTo`.

## 3. `src/AGENTS.md`

In the section "Activity feature and auto-sync (added 2026-09-18)", add this paragraph at the end of that section. Change nothing else in the file.

```markdown
**Activity trend (added 2026-10-12).** `src/app/lib/activityTrend.ts` (pure, `import type` only)
compares the selected range with the same number of calendar days right before it.
`useActivityData({ ..., compare: true })` loads both periods in the same queries and builds each
on its own payroll rows and forms, so the selected range's numbers never depend on the earlier
one. A day counts only if it is scheduled, before today, on or after the employee's start date
and has no approved reason. Day with work → `worked` or `low` (under the existing threshold);
no work → `missed`. Minimums for "changed" are the four `activity_trend_min_*` rows in
`classification_config` (30 min active, 10 min entry, 2 days, 5 days with work). The side panel
calls the hook without `compare` and loads its own range only.
```

## Acceptance
The Activity tab looks and behaves exactly as before. Every number for the selected dates is unchanged. The employee side panel still loads.

When done, reply with a one-line summary per file.
