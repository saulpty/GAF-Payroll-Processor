// Tests for teramindTime.ts: instant parsing (ISO Z/offset, epoch s/ms), naive-clock
// detection, Eastern wall-clock conversion across DST boundaries, pure clock/date
// arithmetic, session assembly, and the payroll-refusal regex + source hygiene checks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseInstant,
  isNaiveClock,
  easternClock,
  easternDate,
  addSecondsToClock,
  addDays,
  sessionClock,
  hasTimezone, easternMinutes } from '../src/app/lib/teramindTime.ts';

const CLOCK_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

test('UTC Z instant, summer (EDT -4)', () => {
  const ms = parseInstant('2026-08-10T14:30:00Z');
  assert.ok(ms !== null);
  assert.equal(easternClock(ms as number), '2026-08-10 10:30:00');
});

test('UTC Z instant, winter (EST -5)', () => {
  const ms = parseInstant('2026-01-10T14:30:00Z');
  assert.ok(ms !== null);
  assert.equal(easternClock(ms as number), '2026-01-10 09:30:00');
});

test('Panama -05:00 offset in summer becomes +1h vs local', () => {
  const ms = parseInstant('2026-08-10T09:00:00-05:00');
  assert.ok(ms !== null);
  assert.equal(easternClock(ms as number), '2026-08-10 10:00:00');
});

test('Panama -05:00 offset in winter matches local clock (EST is also -05:00)', () => {
  const ms = parseInstant('2026-01-10T09:00:00-05:00');
  assert.ok(ms !== null);
  assert.equal(easternClock(ms as number), '2026-01-10 09:00:00');
});

test('+00:00 offset', () => {
  const ms = parseInstant('2026-08-10T14:30:00+00:00');
  assert.equal(easternClock(ms as number), '2026-08-10 10:30:00');
});

test('offset without colon', () => {
  // -0500 (Panama, no colon) in summer is 1h behind EDT (-0400), same shape as the
  // colon-offset Panama test above but exercising the no-colon branch of the regex.
  const ms = parseInstant('2026-08-10T09:00:00-0500');
  assert.equal(easternClock(ms as number), '2026-08-10 10:00:00');
});

test('fractional seconds', () => {
  const ms = parseInstant('2026-08-10T14:30:00.123Z');
  assert.ok(ms !== null);
  assert.equal((ms as number) % 1000, 123);
  assert.equal(easternClock(ms as number), '2026-08-10 10:30:00');
});

test('space instead of T', () => {
  const ms = parseInstant('2026-08-10 14:30:00Z');
  assert.equal(easternClock(ms as number), '2026-08-10 10:30:00');
});

test('late-night UTC is still the previous Eastern date', () => {
  const ms = parseInstant('2026-08-11T03:30:00Z');
  assert.ok(ms !== null);
  assert.equal(easternClock(ms as number), '2026-08-10 23:30:00');
  assert.equal(easternDate(ms as number), '2026-08-10');
});

test('spring-forward 2026-03-08: last EST second, then jump to EDT', () => {
  const before = parseInstant('2026-03-08T06:59:59Z');
  const after = parseInstant('2026-03-08T07:00:00Z');
  assert.equal(easternClock(before as number), '2026-03-08 01:59:59');
  assert.equal(easternClock(after as number), '2026-03-08 03:00:00');
});

test('fall-back 2026-11-01: both sides of the repeated hour read 01:30', () => {
  const edt = parseInstant('2026-11-01T05:30:00Z');
  const est = parseInstant('2026-11-01T06:30:00Z');
  assert.equal(easternClock(edt as number), '2026-11-01 01:30:00');
  assert.equal(easternClock(est as number), '2026-11-01 01:30:00');
});

test('epoch seconds, number and numeric string', () => {
  const sec = Math.floor(Date.UTC(2026, 7, 10, 14, 30, 0) / 1000);
  const fromNumber = parseInstant(sec);
  const fromString = parseInstant(String(sec));
  assert.equal(fromNumber, sec * 1000);
  assert.equal(fromString, sec * 1000);
  assert.equal(easternClock(fromNumber as number), '2026-08-10 10:30:00');
});

test('epoch milliseconds, number and numeric string', () => {
  const msVal = Date.UTC(2026, 7, 10, 14, 30, 0);
  const fromNumber = parseInstant(msVal);
  const fromString = parseInstant(String(msVal));
  assert.equal(fromNumber, msVal);
  assert.equal(fromString, msVal);
  assert.equal(easternClock(fromNumber as number), '2026-08-10 10:30:00');
});

test('naive input passes through normalised (no seconds -> :00)', () => {
  assert.equal(isNaiveClock('2026-08-10T09:05'), true);
  const sc = sessionClock('2026-08-10T09:05', 0);
  assert.ok(sc !== null);
  assert.equal(sc?.started_et, '2026-08-10 09:05:00');
});

test('isNaiveClock is false for anything carrying a zone, true for bare clock text', () => {
  assert.equal(isNaiveClock('2026-08-10T09:05:00Z'), false);
  assert.equal(isNaiveClock('2026-08-10T09:05:00-05:00'), false);
  assert.equal(isNaiveClock('2026-08-10 09:05:00'), true);
  assert.equal(isNaiveClock('2026-08-10T09:05:00.500'), true);
});

test('cross-midnight session from an instant keeps work_date on the start date', () => {
  // 23:50 EDT on 2026-08-10 = 2026-08-11T03:50:00Z; 45 minutes later crosses midnight ET.
  const sc = sessionClock('2026-08-11T03:50:00Z', 45 * 60);
  assert.ok(sc !== null);
  assert.equal(sc?.started_et, '2026-08-10 23:50:00');
  assert.equal(sc?.finished_et, '2026-08-11 00:35:00');
  assert.equal(sc?.work_date, '2026-08-10');
});

test('cross-midnight session from a naive clock keeps work_date on the start date', () => {
  const sc = sessionClock('2026-08-10 23:50:00', 45 * 60);
  assert.ok(sc !== null);
  assert.equal(sc?.started_et, '2026-08-10 23:50:00');
  assert.equal(sc?.finished_et, '2026-08-11 00:35:00');
  assert.equal(sc?.work_date, '2026-08-10');
});

test('sessionClock returns null for unparseable raw', () => {
  assert.equal(sessionClock('not-a-date', 60), null);
  assert.equal(sessionClock('', 60), null);
});

test('sessionClock treats negative/NaN duration as 0', () => {
  const scNeg = sessionClock('2026-08-10T14:30:00Z', -100);
  const scNaN = sessionClock('2026-08-10T14:30:00Z', NaN);
  assert.equal(scNeg?.started_et, scNeg?.finished_et);
  assert.equal(scNaN?.started_et, scNaN?.finished_et);
});

test('sessionClock started_raw preserves the original value as a string', () => {
  const scStr = sessionClock('2026-08-10T14:30:00Z', 60);
  assert.equal(scStr?.started_raw, '2026-08-10T14:30:00Z');
  const sec = Math.floor(Date.UTC(2026, 7, 10, 14, 30, 0) / 1000);
  const scNum = sessionClock(sec, 60);
  assert.equal(scNum?.started_raw, String(sec));
});

test('addSecondsToClock is pure wall-clock arithmetic (no timezone)', () => {
  assert.equal(addSecondsToClock('2026-08-10 23:59:30', 45), '2026-08-11 00:00:15');
  assert.equal(addSecondsToClock('2026-08-10 10:00:00', 0), '2026-08-10 10:00:00');
});

test('addDays across month, year end, and leap day', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29'); // 2028 is a leap year
  assert.equal(addDays('2028-02-29', 1), '2028-03-01');
});

test('hasTimezone matches the payroll refusal regex exactly (OR of both patterns)', () => {
  assert.equal(hasTimezone('2026-08-10 10:30:00Z'), true);
  assert.equal(hasTimezone('2026-08-10T10:30:00-05:00'), true);
  assert.equal(hasTimezone('2026-08-10T10:30-0500'), true);
  assert.equal(hasTimezone('2026-08-10 10:30:00'), false);
  assert.equal(hasTimezone('2026-08-10'), false);
});

test('every string from easternClock/sessionClock is zone-free and well-formed', () => {
  const ms = parseInstant('2026-08-10T14:30:00Z') as number;
  const clock = easternClock(ms);
  assert.match(clock, CLOCK_RE);
  assert.equal(hasTimezone(clock), false);

  const sc = sessionClock('2026-08-10T14:30:00Z', 120) as NonNullable<ReturnType<typeof sessionClock>>;
  assert.match(sc.started_et, CLOCK_RE);
  assert.match(sc.finished_et, CLOCK_RE);
  assert.equal(hasTimezone(sc.started_et), false);
  assert.equal(hasTimezone(sc.finished_et), false);
});

test('garbage inputs return null', () => {
  assert.equal(parseInstant('garbage'), null);
  assert.equal(parseInstant('2026-08-10'), null);
  assert.equal(parseInstant('2026-08-10T09:05'), null); // naive: no zone, not an instant
  assert.equal(parseInstant('12345'), null); // wrong digit count
  assert.equal(parseInstant(NaN), null);
  assert.equal(parseInstant(1.5), null);
  assert.equal(sessionClock('garbage', 60), null);
});

test('source has no toISOString and no runtime imports (import type only)', () => {
  const src = readFileSync(
    new URL('../src/app/lib/teramindTime.ts', import.meta.url),
    'utf8',
  );
  assert.equal(/toISOString/.test(src), false);
  const badImport = /^import\s+(?!type\s)/m.test(src);
  assert.equal(badImport, false);
});

test('easternMinutes: the Eastern wall-clock minute of an instant, summer and winter', () => {
  assert.equal(easternMinutes(Date.parse('2026-09-17T19:43:00Z')), 15 * 60 + 43); // EDT
  assert.equal(easternMinutes(Date.parse('2026-01-12T13:56:30Z')), 8 * 60 + 56);  // EST, seconds cut
  assert.equal(easternMinutes(Date.parse('2026-08-11T03:30:00Z')), 23 * 60 + 30); // previous Eastern day
});
