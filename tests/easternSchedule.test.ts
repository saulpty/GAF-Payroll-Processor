import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSchedule, isDst, type EmployeeRecord } from '../src/app/lib/classificationEngine.ts';

// Display timezone = US Eastern. Schedule columns are stored in Panama time.
// During US DST, Eastern = Panama + 1hr, so the dst_* (summer-Panama) pair is
// shifted up an hour to express it in Eastern; in winter Panama == Eastern so the
// standard_* pair is used as-is.
const JUNE = new Date(2026, 5, 15, 12, 0); // US DST
const JAN  = new Date(2026, 0, 15, 12, 0); // US standard time
const WIN_NUM = [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];
const WIN_STR = [{ year: '2026' as any, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];

const base = (over: Partial<EmployeeRecord>): EmployeeRecord => ({
  id: 1, display_name: 'X', teramind_email: 'x@gaf.com',
  is_grace_list: false, is_macbook_swap: false, schedule_name: 'S',
  dst_start: '8:00 AM', dst_end: '4:00 PM', standard_start: '9:00 AM', standard_end: '5:00 PM',
  grace_minutes: 10, ...over,
});

// Standard / Monique are Eastern-synced -> constant in US Eastern (guard).
test('Standard employee: constant 9-5 Eastern (summer == winter)', () => {
  assert.deepEqual(
    { s: getSchedule(base({}), JUNE, WIN_NUM).start, e: getSchedule(base({}), JUNE, WIN_NUM).end },
    { s: '9:00 AM', e: '5:00 PM' },
  );
  assert.equal(getSchedule(base({}), JAN, WIN_NUM).start, '9:00 AM');
});

// Favian: Arizona team (no DST) -> 9-5 winter, 10-6 summer in US Eastern.
const FAVIAN = base({
  display_name: 'Favian Fortune', schedule_name: 'Favian Fortune schedule',
  dst_start: '9:00 AM', dst_end: '5:00 PM', standard_start: '9:00 AM', standard_end: '5:00 PM',
});

test('Favian: 10-6 Eastern in summer (US DST)', () => {
  const s = getSchedule(FAVIAN, JUNE, WIN_NUM);
  assert.equal(s.start, '10:00 AM');
  assert.equal(s.end, '6:00 PM');
  assert.equal(s.grace, '10:10 AM');
});

test('Favian: 9-5 Eastern in winter', () => {
  const s = getSchedule(FAVIAN, JAN, WIN_NUM);
  assert.equal(s.start, '9:00 AM');
  assert.equal(s.end, '5:00 PM');
});

// Runtime guard: the DB hands back the year as a string; isDst + the Eastern
// shift must still work, or Favian silently reverts to 9-5 all summer.
test('isDst tolerates a string year from the database', () => {
  assert.equal(isDst(JUNE, WIN_STR), true);
});

test('Favian still 10-6 in summer when DB returns a string year', () => {
  assert.equal(getSchedule(FAVIAN, JUNE, WIN_STR).start, '10:00 AM');
});
