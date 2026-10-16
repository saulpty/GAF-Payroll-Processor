// "Reported" from the forms on the List and the employee panel
// (prompt 2026-10-16-punctuality/05-reported-from-forms.md).
//
// EXPECTED TO FAIL until that prompt is pasted into UI Bakery and the export is synced:
// src/app/lib/formReporting.ts does not exist yet, so it is imported lazily and each test fails alone.
//
// Measured 2026-10-16 on /dev, Sep 1 - Oct 15: 462 late days; Reports (forms) said 221 reported,
// the List (payroll's filed_gaf snapshot) 196. 25 days, 12 people, always "form on file but shown
// as not reported" (Arelis Acosta 10 vs 1, Nichole Harris 4 vs 0).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AttendanceRow } from '../src/app/lib/attendanceStats.ts';
import { computeCompanyKpis } from '../src/app/lib/attendanceStats.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
type Mod = {
  reportedFromForms: (rows: AttendanceRow[], forms: unknown[], ids: Map<string, number>) => AttendanceRow[];
  idsByEmail: (emps: { email: string }[]) => Map<string, number>;
};
const load = async (): Promise<Mod> => (await import('../src/app/lib/formReporting.ts')) as Mod;

const row = (status: string, date: string, filed = false, email = 'nh@gaf.test'): AttendanceRow => ({
  email, name: 'Nichole Harris', date, entry_time: '09:20', status, bucket: null,
  filed_gaf: filed, minutes_late: status.startsWith('Late') ? 20 : 0, period_name: 'P', time_off_kind: null,
});
const form = (employee_id: number | null, form_date: string) => ({
  employee_id, form_date, form_type: 'Tardiness', reason: '', details: '', eta: '',
  submitted_at: null, employee_email_raw: '', monday_item_id: '1',
});

test('RF1: a late day with a form is reported even when payroll marked it unreported', async () => {
  const { reportedFromForms } = await load();
  const out = reportedFromForms([row('Late - Unreported', '2026-10-02')], [form(7, '2026-10-02')], new Map([['nh@gaf.test', 7]]));
  assert.equal(out[0].status, 'Late - Reported');
  assert.equal(out[0].filed_gaf, true);
});

test('RF2: a late day with no form is unreported even when payroll marked it reported', async () => {
  const { reportedFromForms } = await load();
  const out = reportedFromForms([row('Late - Reported', '2026-10-02', true)], [form(7, '2026-10-03')], new Map([['nh@gaf.test', 7]]));
  assert.equal(out[0].status, 'Late - Unreported');
  assert.equal(out[0].filed_gaf, false);
});

test('RF3: absences take filed_gaf from the forms; their status never changes', async () => {
  const { reportedFromForms } = await load();
  const out = reportedFromForms([row('Absent - Unexplained', '2026-10-05')], [form(7, '2026-10-05')], new Map([['nh@gaf.test', 7]]));
  assert.equal(out[0].status, 'Absent - Unexplained');
  assert.equal(out[0].filed_gaf, true);
});

test('RF4: on-time, time off and permission rows, and rows with no known employee, are untouched', async () => {
  const { reportedFromForms } = await load();
  const rows = [row('On Time', '2026-10-05'), row('Excused (PTO/FH/Perm)', '2026-10-06'), row('Permission', '2026-10-07'),
    row('Late - Reported', '2026-10-08', true, 'nobody@gaf.test')];
  const out = reportedFromForms(rows, [], new Map([['nh@gaf.test', 7]]));
  out.forEach((r, i) => assert.equal(r, rows[i]));
});

test('RF5: forms match by employee id and the date only (first 10 characters), unmatched forms ignored', async () => {
  const { reportedFromForms, idsByEmail } = await load();
  const ids = idsByEmail([{ email: ' NH@gaf.test ', id: 7 } as { email: string }]);
  assert.equal(ids.get('nh@gaf.test'), 7);
  const out = reportedFromForms([row('Late - Unreported', '2026-10-02T00:00:00')],
    [form(null, '2026-10-02'), form(8, '2026-10-02'), form(7, '2026-10-02T05:00:00Z')], ids);
  assert.equal(out[0].status, 'Late - Reported');
});

test('RF6: the Absent card counts an absence with a form as reported', () => {
  const k = computeCompanyKpis([row('Absent - Unexplained', '2026-10-05', true), row('Absent - Unexplained', '2026-10-06'),
    row('Late - Reported', '2026-10-07', true), row('Late - Unreported', '2026-10-08')]);
  assert.equal(k.reported - k.lateReported, 1, 'absent reported');
  assert.equal(k.unreported - k.lateUnreported, 1, 'absent not reported');
});

test('RF8: a live absence with a form on file is reported (prompt 05b, Jennette Torrano Oct 15)', async () => {
  const { reportRowToList } = await import('../src/app/lib/liveListRows.ts');
  const base = {
    employeeId: 1, employeeName: 'Ana', email: 'ana@x.com', role: '', manager: '', date: '2026-10-15',
    scheduledStart: '9:00 AM', entryTime: null, exitTime: null, minutesLate: 0, earlyLeaveMinutes: 0,
    form: null, allForms: [], coveredBy: null, countsToScore: true,
    flags: { multipleForms: false, recordedUnexplainedButFormOnFile: false, formEmailUnrecognised: false, excusedInPayrollNoRequest: false },
  };
  const as = (verdict: string) => reportRowToList({ ...base, verdict } as never)!;
  assert.equal(as('absent_reported_on_time').filed_gaf, true);
  assert.equal(as('absent_reported_late').filed_gaf, true);
  assert.equal(as('unexplained_absence').filed_gaf, false);
  assert.equal(as('absent_reported_on_time').status, 'Absent - Unexplained');
});

test('RF7: the List and the panel both run their payroll rows through the forms, and wait for them', () => {
  const list = read('src/app/pages/Attendance.tsx');
  assert.match(list, /const reported = useFormReported\(\{ rows, employees: emps, dateFrom: safeFrom, dateTo: safeTo, viewAs \}\);/);
  assert.match(list, /live\.loading \|\| reported\.loading;/);
  const panel = read('src/app/pages/attendance/useEmployeeStats.ts');
  assert.match(panel, /const reported = useFormReported\(\{ rows, employees: oneEmp, dateFrom, dateTo, viewAs \}\);/);
  assert.match(panel, /if \(live\.loading \|\| reported\.loading\) return null;/);
  const hook = read('src/app/pages/attendance/useFormReported.ts');
  assert.match(hook, /\{ dateFrom, dateTo, manager: '', viewAs \},/, 'flat params, viewer-scoped loader');
  assert.doesNotMatch(hook, /params:\s*\{/);
});
