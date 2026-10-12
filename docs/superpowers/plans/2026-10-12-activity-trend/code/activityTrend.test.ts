import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  previousRange, subDays, rangeLabel, dayKind, summarisePeriod, compareEmployee, compareTotals,
  changeText, fmtMinutes, DEFAULT_TREND_MINIMUMS, VERDICT_ORDER, VERDICT_LABEL,
  type PeriodSummary,
} from '../src/app/lib/activityTrend.ts';
import type { ActivityDay, WhyChip } from '../src/app/lib/activityTypes.ts';

// Spec: docs/superpowers/specs/2026-10-12-activity-trend-design.md

const SRC_PATH = fileURLToPath(new URL('../src/app/lib/activityTrend.ts', import.meta.url));
const TODAY = '2026-10-12';

// A scheduled, worked, normal day unless overridden.
function mkDay(date: string, o: Partial<ActivityDay> = {}): ActivityDay {
  return {
    employeeId: 1, employeeName: 'Alice', role: 'Agent', manager: 'Bob',
    date, scheduled: true, shiftMinutes: 480,
    firstMin: 540, lastMin: 1050, crossesMidnight: false,
    activeMin: 420, breaksMin: 90, largestGapMin: 0, gapStartMin: 0,
    records: 20, accounts: 1, hasManual: false,
    official: false, edited: false, officialEntryMin: null, officialExitMin: null,
    shownFirstMin: 540, shownLastMin: 1050,
    why: null, flag: null, needsLook: false, isToday: false, ghostMin: null,
    ...o,
  };
}
const low = (date: string, activeMin = 300) => mkDay(date, { activeMin, flag: 'low_activity', needsLook: true });
const missed = (date: string) => mkDay(date, {
  firstMin: null, lastMin: null, shownFirstMin: null, shownLastMin: null, activeMin: 0, records: 0,
  why: { kind: 'none', label: 'No Reports Yet', tone: 'amber' }, flag: 'low_activity', needsLook: true,
});
const away = (date: string, kind: WhyChip['kind'] = 'pto') => mkDay(date, {
  firstMin: null, lastMin: null, shownFirstMin: null, shownLastMin: null, activeMin: 0, records: 0,
  why: { kind, label: 'PTO', tone: 'blue' },
});
function sum(o: Partial<PeriodSummary> = {}): PeriodSummary {
  return { scheduled: 10, worked: 10, avgActiveMin: 400, avgEntryMin: 540, lowDays: 2, missedDays: 0, ...o };
}

test('T1: source is pure (type-only imports, no Date) and under 15 KB', () => {
  const src = readFileSync(SRC_PATH, 'utf8');
  const runtimeImports = src.split('\n').filter((l) => /^\s*import\b/.test(l) && !/^\s*import\s+type\b/.test(l));
  assert.deepEqual(runtimeImports, []);
  assert.equal(/new Date\s*\(|Date\.now|toISOString/.test(src), false);
  assert.ok(Buffer.byteLength(src, 'utf8') < 15 * 1024);
});

test('T2: previousRange is the same number of days ending the day before', () => {
  assert.deepEqual(previousRange('2026-09-24', '2026-10-12'), { from: '2026-09-05', to: '2026-09-23', days: 19 });
  assert.deepEqual(previousRange('2026-10-12', '2026-10-12'), { from: '2026-10-11', to: '2026-10-11', days: 1 });
});

test('T3: previousRange crosses a month end, a year end and a leap day', () => {
  assert.deepEqual(previousRange('2026-10-01', '2026-10-15'), { from: '2026-09-16', to: '2026-09-30', days: 15 });
  assert.deepEqual(previousRange('2027-01-01', '2027-01-10'), { from: '2026-12-22', to: '2026-12-31', days: 10 });
  assert.deepEqual(previousRange('2028-03-01', '2028-03-02'), { from: '2028-02-28', to: '2028-02-29', days: 2 });
});

test('T4: a bad or backwards range gives days 0 instead of throwing', () => {
  assert.equal(previousRange('', '2026-10-12').days, 0);
  assert.equal(previousRange('2026-10-12', '2026-10-01').days, 0);
  assert.equal(previousRange('garbage', 'more').days, 0);
  assert.equal(subDays('garbage', 3), 'garbage');
});

test('T5: rangeLabel adds years only when the ends differ', () => {
  assert.equal(rangeLabel('2026-09-05', '2026-09-23'), 'Sep 5 – Sep 23');
  assert.equal(rangeLabel('2026-12-22', '2027-01-10'), 'Dec 22, 2026 – Jan 10, 2027');
  assert.equal(rangeLabel('', '2026-09-23'), '');
});

test('T6: dayKind sorts a day into worked, low, missed, away or skip', () => {
  assert.equal(dayKind(mkDay('2026-10-08'), TODAY), 'worked');
  assert.equal(dayKind(low('2026-10-08'), TODAY), 'low');
  assert.equal(dayKind(missed('2026-10-08'), TODAY), 'missed');
  assert.equal(dayKind(away('2026-10-08', 'pto'), TODAY), 'away');
  assert.equal(dayKind(away('2026-10-08', 'sick'), TODAY), 'away');
  assert.equal(dayKind(away('2026-10-08', 'holiday'), TODAY), 'away');
  assert.equal(dayKind(mkDay('2026-10-10', { scheduled: false }), TODAY), 'skip');
});

test('T7: today and later never count, even with work', () => {
  assert.equal(dayKind(mkDay(TODAY, { isToday: true, activeMin: 60 }), TODAY), 'skip');
  assert.equal(dayKind(missed('2026-10-13'), TODAY), 'skip');
});

test('T8: a day before the start date does not count as missed', () => {
  assert.equal(dayKind(missed('2026-09-08'), TODAY, '2026-09-14'), 'skip');
  assert.equal(dayKind(missed('2026-09-14'), TODAY, '2026-09-14'), 'missed');
  assert.equal(dayKind(missed('2026-09-14'), TODAY, '2026-09-14T00:00:00.000Z'), 'missed');
});

test('T9: a form excuses a day only when there was no work; a permission day with work is away', () => {
  const form: WhyChip = { kind: 'form', label: 'Tardiness', tone: 'blue' };
  assert.equal(dayKind(mkDay('2026-10-08', { why: form }), TODAY), 'worked');
  assert.equal(dayKind(mkDay('2026-10-08', { why: form, records: 0, firstMin: null }), TODAY), 'away');
  assert.equal(dayKind(mkDay('2026-10-08', { why: { kind: 'permission', label: 'Permission', tone: 'blue' }, activeMin: 200 }), TODAY), 'away');
});

test('T10: hand-typed payroll punches with no Teramind record still mean the person worked', () => {
  assert.equal(dayKind(mkDay('2026-10-08', { records: 0, firstMin: null, officialEntryMin: 545 }), TODAY), 'worked');
});

test('T11: summarisePeriod counts each kind once and averages only days with work', () => {
  const s = summarisePeriod([
    mkDay('2026-10-05', { activeMin: 420, shownFirstMin: 540 }),
    low('2026-10-06', 300),
    missed('2026-10-07'),
    away('2026-10-08'),
    mkDay(TODAY, { isToday: true, activeMin: 10 }),
  ], TODAY);
  assert.deepEqual(s, { scheduled: 3, worked: 2, avgActiveMin: 360, avgEntryMin: 540, lowDays: 1, missedDays: 1 });
});

test('T12: an empty period summarises to zeros and nulls', () => {
  assert.deepEqual(summarisePeriod([], TODAY), { scheduled: 0, worked: 0, avgActiveMin: null, avgEntryMin: null, lowDays: 0, missedDays: 0 });
});

test('T13: the entry average uses the official punch when one was captured', () => {
  const s = summarisePeriod([mkDay('2026-10-05', { firstMin: 600, shownFirstMin: 540 })], TODAY);
  assert.equal(s.avgEntryMin, 540);
});

test('T14: verdicts — improved, worse, mixed, steady', () => {
  assert.equal(compareEmployee(sum(), sum({ avgActiveMin: 440 })).verdict, 'improved');
  assert.equal(compareEmployee(sum(), sum({ avgActiveMin: 350 })).verdict, 'worse');
  assert.equal(compareEmployee(sum(), sum({ avgActiveMin: 440, avgEntryMin: 555 })).verdict, 'mixed');
  assert.equal(compareEmployee(sum(), sum({ avgActiveMin: 410, avgEntryMin: 545 })).verdict, 'steady');
});

test('T15: each minimum is inclusive (30 min, 10 min, 2 days) and one short of it is no change', () => {
  assert.equal(compareEmployee(sum(), sum({ avgActiveMin: 429 })).active.tone, '');
  assert.equal(compareEmployee(sum(), sum({ avgActiveMin: 430 })).active.tone, 'good');
  assert.equal(compareEmployee(sum(), sum({ avgEntryMin: 531 })).entry.tone, '');
  assert.equal(compareEmployee(sum(), sum({ avgEntryMin: 530 })).entry.tone, 'good');
  assert.equal(compareEmployee(sum(), sum({ avgEntryMin: 550 })).entry.tone, 'bad');
  assert.equal(compareEmployee(sum(), sum({ lowDays: 3 })).low.tone, '');
  assert.equal(compareEmployee(sum(), sum({ lowDays: 4 })).low.tone, 'bad');
  assert.equal(compareEmployee(sum(), sum({ lowDays: 0 })).low.tone, 'good');
  assert.equal(compareEmployee(sum(), sum({ missedDays: 1 })).missed.tone, '');
  assert.equal(compareEmployee(sum(), sum({ missedDays: 2 })).missed.tone, 'bad');
});

test('T16: fewer than 5 days with work in either period is not enough data', () => {
  assert.equal(compareEmployee(sum({ worked: 4 }), sum({ avgActiveMin: 480 })).verdict, 'nodata');
  assert.equal(compareEmployee(sum(), sum({ worked: 4, avgActiveMin: 480 })).verdict, 'nodata');
  assert.equal(compareEmployee(null, sum()).verdict, 'nodata');
  assert.equal(compareEmployee(sum({ worked: 5 }), sum({ worked: 5, avgActiveMin: 480 })).verdict, 'improved');
  const t = compareEmployee(sum({ worked: 4 }), sum({ avgActiveMin: 480 }));
  assert.deepEqual([t.active.tone, t.entry.tone, t.low.tone, t.missed.tone], ['', '', '', '']);
});

test('T17: the minimums come from the settings, not from constants', () => {
  const strict = { ...DEFAULT_TREND_MINIMUMS, activeMinutes: 60 };
  assert.equal(compareEmployee(sum(), sum({ avgActiveMin: 440 }), strict).verdict, 'steady');
});

test('T18: compareTotals gives raw differences and survives an empty period', () => {
  const b = { avgActiveMin: 400, daysWorked: 498, needsLook: 50, lateArrivals: 56 };
  const a = { avgActiveMin: 414, daysWorked: 512, needsLook: 41, lateArrivals: 63 };
  assert.deepEqual(compareTotals(b, a), { avgActiveMin: 14, daysWorkedBefore: 498, needsLook: -9, lateArrivals: 7 });
  assert.equal(compareTotals({ ...b, avgActiveMin: null }, a).avgActiveMin, null);
});

test('T19: changeText reads like the mockup', () => {
  assert.equal(changeText('active', { delta: 71, tone: 'good' }), '+1h 11m');
  assert.equal(changeText('active', { delta: -50, tone: 'bad' }), '−50m');
  assert.equal(changeText('entry', { delta: -12, tone: 'good' }), '12m earlier');
  assert.equal(changeText('entry', { delta: 14, tone: 'bad' }), '14m later');
  assert.equal(changeText('low', { delta: -5, tone: 'good' }), '5 fewer');
  assert.equal(changeText('missed', { delta: 3, tone: 'bad' }), '3 more');
  assert.equal(changeText('active', { delta: 12, tone: '' }), 'About the same');
  assert.equal(fmtMinutes(120), '2h');
});

test('T20: Trend sorts Worse first and Not enough data last; every verdict has a label', () => {
  const order = (['improved', 'nodata', 'steady', 'worse', 'mixed'] as const).slice().sort((x, y) => VERDICT_ORDER[x] - VERDICT_ORDER[y]);
  assert.deepEqual(order, ['worse', 'mixed', 'steady', 'improved', 'nodata']);
  assert.equal(VERDICT_LABEL.nodata, 'Not enough data');
});
