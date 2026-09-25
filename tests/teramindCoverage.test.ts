import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unexplainedWorkdays } from '../src/app/lib/teramindCoverage.ts';
import { normalizeName } from '../src/app/lib/classificationEngine.ts';

// TC1-TC3 (2026-09-25): Carlos Aloma was flagged "Teramind covers only 6/10
// workdays" while Monday had sick forms for three of the four missing days.
// A day is a coverage gap only when nothing explains it.
const carlos = { teramind_email: 'carlos.a@passiontocarehc.com', display_name: 'Carlos Aloma' };
const workdays = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'];
const tm = new Set(['2026-09-14']);
const gaps = (holidays: string[], att: any[], perms: any[]) =>
  unexplainedWorkdays(carlos, workdays, tm, new Set(holidays), att, perms, normalizeName);

test('TC1: absence forms, permissions and holidays explain missing days', () => {
  const attendance = [
    { employeeName: 'Carlos Aloma', employeeEmail: 'carlos.a@passiontocarehc.com', date: '2026-09-15', type: 'Absence' },
    { employeeName: 'Carlos Aloma', employeeEmail: '', date: '2026-09-16', type: 'Absence' },          // name fallback
    { employeeName: 'Somebody Else', employeeEmail: 'other@x.com', date: '2026-09-17', type: 'Absence' },
    { employeeName: 'Carlos Aloma', employeeEmail: 'carlos.a@passiontocarehc.com', date: '2026-09-17', type: 'Tardiness' },
  ];
  const permissions = [{ employeeName: 'CARLOS  ALOMA', employeeEmail: '', startDate: '2026-09-18', endDate: '2026-09-18' }];
  assert.deepEqual(gaps([], attendance, permissions), ['2026-09-17']);
  assert.deepEqual(gaps(['2026-09-17'], attendance, permissions), []);
});

test('TC2: with nothing on Monday every missing workday is a gap', () => {
  assert.deepEqual(gaps([], [], []), workdays.slice(1));
});

test('TC3: Process Payroll uses it for the coverage warning and names the days', () => {
  const src = readFileSync('src/app/pages/ProcessPayroll.tsx', 'utf8');
  assert.match(src, /unexplainedWorkdays\(emp, expectedWorkdays, dayMap, holidayDates, attendance, permissions, normalizeName, coverageNames, rosterEmails\)/);
  assert.match(src, /gaps\.map\(d => fmtDay\(d, d\.slice\(0, 4\)\)\)\.join\(', '\)/);
  assert.doesNotMatch(src, /Teramind covers only/);
});

// TC4 (code review #3): match like the engine — aliases count, and an email that
// belongs to another employee never matches by name.
test('TC4: aliases explain days; someone else\'s email does not', () => {
  const gisselle = { id: 22, teramind_email: 'gisselle.r@vitasyahc.com', display_name: 'Gisselle Ramos' };
  const days = ['2026-09-14', '2026-09-15'];
  const nameMap = new Map([[normalizeName('Gisselle Ramos'), 22], [normalizeName('Gisselle Vanessa Ramos Pérez de Brown'), 22]]);
  const roster = new Set(['gisselle.r@vitasyahc.com', 'other@x.com']);
  const att = [
    { employeeName: 'Gisselle Vanessa Ramos Pérez de Brown', employeeEmail: '', date: '2026-09-14', type: 'Absence' },
    { employeeName: 'Gisselle Ramos', employeeEmail: 'other@x.com', date: '2026-09-15', type: 'Absence' },
  ];
  assert.deepEqual(unexplainedWorkdays(gisselle, days, new Set(), new Set(), att, [], normalizeName, nameMap, roster), ['2026-09-15']);
});
