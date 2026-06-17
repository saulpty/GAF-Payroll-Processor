import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSchedule, type EmployeeRecord } from '../src/app/lib/classificationEngine.ts';

// Display model: everything is shown in US Eastern. For Eastern-synced employees
// (Standard, Monique) the US-Eastern window is CONSTANT year-round because their
// Panama hours shift with DST: summer 8-4 Panama + 1hr == 9-5 Eastern == winter
// 9-5. (Employees whose team ignores DST, e.g. Favian/Arizona, are covered in
// easternSchedule.test.ts.)

const DST_WINDOWS = [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];

const STANDARD: EmployeeRecord = {
  id: 1, display_name: 'X', teramind_email: 'x@gaf.com',
  is_grace_list: false, is_macbook_swap: false, schedule_name: 'Standard',
  dst_start: '8:00 AM', dst_end: '4:00 PM',       // Panama-summer representation
  standard_start: '9:00 AM', standard_end: '5:00 PM', // US-Eastern (display) representation
  grace_minutes: 10,
};

test('schedule shows US Eastern 9-5 during US DST (June), not Panama 8-4', () => {
  const s = getSchedule(STANDARD, new Date(2026, 5, 15, 12, 0), DST_WINDOWS);
  assert.equal(s.start, '9:00 AM');
  assert.equal(s.end, '5:00 PM');
  assert.equal(s.grace, '9:10 AM');
});

test('schedule shows the same 9-5 in winter (US standard time)', () => {
  const s = getSchedule(STANDARD, new Date(2026, 0, 15, 12, 0), DST_WINDOWS);
  assert.equal(s.start, '9:00 AM');
  assert.equal(s.end, '5:00 PM');
});

// Monique: Panama 8-3 (summer) / 9-4 (winter) == constant 9-4 in US Eastern.
test('Monique shows constant US Eastern 9-4 in summer', () => {
  const monique: EmployeeRecord = {
    ...STANDARD, display_name: 'Monique', schedule_name: 'Monique Luque schedule',
    dst_start: '8:00 AM', dst_end: '3:00 PM',
    standard_start: '9:00 AM', standard_end: '4:00 PM',
  };
  const s = getSchedule(monique, new Date(2026, 5, 15, 12, 0), DST_WINDOWS);
  assert.equal(s.start, '9:00 AM');
  assert.equal(s.end, '4:00 PM');
});
