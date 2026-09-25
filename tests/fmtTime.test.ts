import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtTime, fmtWorkDays, fmtShift } from '../src/app/lib/fmtTime.ts';

// FT1-FT4 (2026-09-25, design system): Saul asked for "9AM-5PM" instead of
// "9:00 AM – 5:00 PM", and for each person's work days (Mon–Fri, Tue–Sat) next
// to their hours. docs/DESIGN-SYSTEM.md → Formats.

test('FT1: fmtTime drops :00 and the space before AM/PM', () => {
  const cases: [string | null | undefined, string][] = [
    ['9:00 AM', '9AM'], ['9:30 AM', '9:30AM'], ['5:00 PM', '5PM'], ['12:00 PM', '12PM'],
    ['12:30 AM', '12:30AM'], ['09:05 am', '9:05AM'], ['14:30', '2:30PM'], ['00:15', '12:15AM'],
    ['13:00:00', '1PM'], ['', ''], [null, ''], [undefined, ''],
  ];
  for (const [input, want] of cases) assert.equal(fmtTime(input), want, String(input));
});

test('FT2: fmtTime leaves impossible or unknown text alone', () => {
  for (const s of ['55:00 PM', '9:75 AM', '25:00', 'Form Submitted']) assert.equal(fmtTime(s), s, s);
});

test('FT3: fmtWorkDays collapses runs, including one that wraps past Sunday', () => {
  const cases: [string | null | undefined, string][] = [
    ['Mon,Tue,Wed,Thu,Fri', 'Mon–Fri'],
    ['Tue,Wed,Thu,Fri,Sat', 'Tue–Sat'],
    ['Thu,Fri,Sat,Sun,Mon', 'Thu–Mon'],   // the "Weekend Schedule Tue-Wed OFF" shape
    [' mon, tue ,wed ', 'Mon–Wed'],
    ['Mon,Wed,Fri', 'Mon, Wed, Fri'],
    ['Sat,Sun', 'Sat, Sun'],
    ['Mon', 'Mon'],
    ['Mon,Tue,Wed,Thu,Fri,Sat,Sun', 'Every day'],
    ['', ''], [null, ''],
  ];
  for (const [input, want] of cases) assert.equal(fmtWorkDays(input), want, String(input));
});

test('FT4: fmtShift joins days and hours with a middle dot', () => {
  assert.equal(fmtShift('Mon,Tue,Wed,Thu,Fri', '9:00 AM', '5:00 PM'), 'Mon–Fri · 9AM–5PM');
  assert.equal(fmtShift('Mon,Tue,Wed,Thu,Fri', '8:30 AM', '4:30 PM'), 'Mon–Fri · 8:30AM–4:30PM');
  assert.equal(fmtShift('', '9:00 AM', '5:00 PM'), '9AM–5PM');
  assert.equal(fmtShift('Tue,Wed,Thu,Fri,Sat', '', ''), 'Tue–Sat');
  assert.equal(fmtShift(null, null, null), '');
});
