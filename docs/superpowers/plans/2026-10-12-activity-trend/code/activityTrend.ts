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

/** The two periods actually compared. Today is a partial day and later days have not happened yet,
 *  so the selected range is cut back to yesterday first; the earlier period is then the same
 *  number of calendar days right before it. days = 0 on both when nothing has elapsed or the range
 *  is not valid. */
export function comparisonRanges(dateFrom: string, dateTo: string, today: string): {
  after: { from: string; to: string; days: number }; before: { from: string; to: string; days: number };
} {
  const none = { from: dateFrom, to: dateFrom, days: 0 };
  if (!YMD.test(today) || !YMD.test(dateTo)) return { after: none, before: none };
  const to = dateTo < today ? dateTo : subDays(today, 1);
  const before = previousRange(dateFrom, to);
  if (before.days === 0) return { after: none, before: none };
  return { after: { from: dateFrom, to, days: before.days }, before };
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
    // Same entry the Avg Entry cell averages (activityDays), so the arrow describes the number beside it.
    avgEntryMin: avg(worked.map((d) => d.firstMin)),
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
