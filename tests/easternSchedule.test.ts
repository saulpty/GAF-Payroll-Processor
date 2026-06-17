import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSchedule, isDst, type EmployeeRecord } from '../src/app/lib/classificationEngine.ts';

// Schedule columns are stored in US Eastern: dst_* = Summer (ET), standard_* =
// Winter (ET). getSchedule picks the summer pair during US DST and the winter
// pair otherwise — no timezone conversion (the stored value IS what shows).
const JUNE = new Date(2026, 5, 15, 12, 0); // US DST
const JAN  = new Date(2026, 0, 15, 12, 0); // US standard time
const WIN_NUM = [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];
const WIN_STR = [{ year: '2026' as any, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];

const base = (o: Partial<EmployeeRecord>): EmployeeRecord => ({
  id: 1, display_name: 'X', teramind_email: 'x@gaf.com',
  is_grace_list: false, is_macbook_swap: false, schedule_name: 'S',
  dst_start: '9:00 AM', dst_end: '5:00 PM', standard_start: '9:00 AM', standard_end: '5:00 PM',
  grace_minutes: 10, ...o,
});

test('Standard: constant 9-5 ET in both seasons (stored Eastern, no conversion)', () => {
  const s = getSchedule(base({}), JUNE, WIN_NUM);
  assert.equal(s.start, '9:00 AM');
  assert.equal(s.end, '5:00 PM');
  assert.equal(s.grace, '9:10 AM');
  assert.equal(getSchedule(base({}), JAN, WIN_NUM).start, '9:00 AM');
});

test('Monique: constant 9-4 ET in both seasons', () => {
  const m = base({ dst_end: '4:00 PM', standard_end: '4:00 PM' });
  assert.equal(getSchedule(m, JUNE, WIN_NUM).end, '4:00 PM');
  assert.equal(getSchedule(m, JAN, WIN_NUM).end, '4:00 PM');
});

// Favian (Arizona, no DST): stored 10-6 summer / 9-5 winter, in US Eastern.
const FAVIAN = base({ dst_start: '10:00 AM', dst_end: '6:00 PM', standard_start: '9:00 AM', standard_end: '5:00 PM' });

test('Favian: 10-6 ET in summer (US DST)', () => {
  const s = getSchedule(FAVIAN, JUNE, WIN_NUM);
  assert.equal(s.start, '10:00 AM');
  assert.equal(s.end, '6:00 PM');
  assert.equal(s.grace, '10:10 AM');
});

test('Favian: 9-5 ET in winter', () => {
  const s = getSchedule(FAVIAN, JAN, WIN_NUM);
  assert.equal(s.start, '9:00 AM');
  assert.equal(s.end, '5:00 PM');
});

// Runtime guard: the DB may hand back the year as a string; isDst (and therefore
// the summer/winter pick) must still work.
test('isDst tolerates a string year from the database', () => {
  assert.equal(isDst(JUNE, WIN_STR), true);
});

test('Favian still 10-6 in summer when the DB returns a string year', () => {
  assert.equal(getSchedule(FAVIAN, JUNE, WIN_STR).start, '10:00 AM');
});
