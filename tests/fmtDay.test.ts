import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekday, fmtDay, fmtDayLong, fmtRange, weekdayCount } from '../src/app/lib/fmtDay.ts';

test('D1: weekday is computed without Date — known anchors', () => {
  assert.equal(weekday('2026-09-09'), 3); // Wed
  assert.equal(weekday('2026-08-21'), 5); // Fri
  assert.equal(weekday('2026-08-24'), 1); // Mon
  assert.equal(weekday('2024-02-29'), 4); // leap day, Thu
  assert.equal(weekday('1970-01-01'), 4); // epoch Thursday
});

test('D2: fmtDay shows weekday + short month + day; the year only when it is not this year', () => {
  assert.equal(fmtDay('2026-08-17', '2026'), 'Mon Aug 17');
  assert.equal(fmtDay('2027-01-05', '2026'), 'Tue Jan 5, 2027');
  assert.equal(fmtDay('2026-08-17'), 'Mon Aug 17, 2026');
  assert.equal(fmtDay('2026-08-17T00:00:00.000Z', '2026'), 'Mon Aug 17');
  assert.equal(fmtDay(null, '2026'), '');
  assert.equal(fmtDay('garbage', '2026'), 'garbage');
});

test('D3: fmtRange collapses a missing or equal end date', () => {
  assert.equal(fmtRange('2026-08-17', '2026-08-21', '2026'), 'Mon Aug 17 → Fri Aug 21');
  assert.equal(fmtRange('2026-08-21', '2026-08-21', '2026'), 'Fri Aug 21');
  assert.equal(fmtRange('2026-08-21', null, '2026'), 'Fri Aug 21');
  assert.equal(fmtRange('2026-12-21', '2027-01-05', '2026'), 'Mon Dec 21 → Tue Jan 5, 2027');
});

test('D4: weekdayCount is Mon-Fri days in [leave, return) — what a floating holiday spends', () => {
  assert.equal(weekdayCount('2026-08-21', '2026-08-24'), 1); // Fri -> Mon
  assert.equal(weekdayCount('2026-08-21', '2026-08-22'), 1); // Fri -> Sat
  assert.equal(weekdayCount('2026-08-17', '2026-08-24'), 5); // full week
  assert.equal(weekdayCount('2026-08-22', '2026-08-23'), 0); // Sat only
  assert.equal(weekdayCount('2026-08-24', '2026-08-24'), 0);
  assert.equal(weekdayCount('2026-08-24', '2026-08-21'), 0); // reversed -> 0
});

test('D5: fmtDayLong spells the weekday and month out in full, with the year, without a Date', () => {
  assert.equal(fmtDayLong('2026-09-08'), 'Tuesday, September 8, 2026');
  assert.equal(fmtDayLong('2026-09-08T00:00:00.000Z'), 'Tuesday, September 8, 2026');
  assert.equal(fmtDayLong('2027-01-05'), 'Tuesday, January 5, 2027');
  assert.equal(fmtDayLong('2024-02-29'), 'Thursday, February 29, 2024');
  assert.equal(fmtDayLong(null), '');
  assert.equal(fmtDayLong('garbage'), 'garbage');
});
