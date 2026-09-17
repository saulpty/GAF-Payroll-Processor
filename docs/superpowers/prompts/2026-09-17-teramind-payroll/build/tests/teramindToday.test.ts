import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildToday, fmtClock, fmtDuration,
  type TodayEmployee, type TodayPunch, type TodayHelpers, type TodayInput, type TodayRow,
} from '../src/app/lib/teramindToday.ts';

const SRC_PATH = fileURLToPath(new URL('../src/app/lib/teramindToday.ts', import.meta.url));

// ── Fake helpers (mirroring the real classificationEngine/attendanceReport contract) ──────────

function parseTimeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3]!)) h += 12;
  return h * 60 + Number(m[2]);
}

function minutesToClock(min: number): string {
  const h24 = ((Math.floor(min / 60) % 24) + 24) % 24;
  const m = ((min % 60) + 60) % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m < 10 ? '0' + m : m} ${period}`;
}

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isScheduledWorkDay(date: Date, workDays: string | undefined): boolean {
  const dow = date.getDay();
  if (workDays && workDays.trim() !== '') {
    const list = workDays.split(',').map((s) => s.trim());
    return list.includes(DOW_NAMES[dow]!);
  }
  return dow >= 1 && dow <= 5;
}

function getSchedule(
  emp: { standard_start: string; standard_end: string; grace_minutes: number },
): { start: string; end: string; grace: string } {
  const startMin = parseTimeToMinutes(emp.standard_start);
  return { start: emp.standard_start, end: emp.standard_end, grace: minutesToClock(startMin + emp.grace_minutes) };
}

const helpers: TodayHelpers = { isScheduledWorkDay, getSchedule: (e, d) => getSchedule(e), parseTimeToMinutes };

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────

const THURSDAY = '2026-09-17'; // scheduled Mon-Fri work day
const SATURDAY = '2026-09-19'; // weekend

function mkEmp(overrides: Partial<TodayEmployee> = {}): TodayEmployee {
  return {
    id: 1, name: 'Alice', email: 'alice@x.com', role: 'Agent', manager: 'Bob',
    work_days: '', start_date: '2020-01-01',
    standard_start: '9:00 AM', standard_end: '5:00 PM', dst_start: '9:00 AM', dst_end: '5:00 PM',
    grace_minutes: 10,
    ...overrides,
  };
}

function mkPunch(overrides: Partial<TodayPunch> = {}): TodayPunch {
  return {
    employee_id: 1, first_min: 540, last_ymd: 20260917, last_min: 545,
    records: 5, active_s: 3000, has_manual: false,
    ...overrides,
  };
}

function run(overrides: Partial<TodayInput>): { rows: TodayRow[]; summary: ReturnType<typeof buildToday>['summary'] } {
  return buildToday({
    day: THURSDAY, nowMin: 560, isToday: true,
    employees: [mkEmp()], punches: [], holidays: [], dstWindows: [], helpers,
    ...overrides,
  });
}

// ── Source hygiene ──────────────────────────────────────────────────────────────────────────

test('source has no imports, no Date.now, no toISOString, no Intl', () => {
  const src = readFileSync(SRC_PATH, 'utf8');
  assert.equal(/^\s*import\b/m.test(src), false);
  assert.equal(/Date\.now/.test(src), false);
  assert.equal(/toISOString/.test(src), false);
  assert.equal(/\bIntl\b/.test(src), false);
});

// ── fmtClock / fmtDuration ──────────────────────────────────────────────────────────────────

test('fmtClock formats minutes since midnight', () => {
  assert.equal(fmtClock(536), '8:56 AM');
  assert.equal(fmtClock(0), '12:00 AM');
  assert.equal(fmtClock(720), '12:00 PM');
  assert.equal(fmtClock(900), '3:00 PM');
  assert.equal(fmtClock(null), '—');
  assert.equal(fmtClock(undefined), '—');
});

test('fmtDuration formats minutes as hours/minutes', () => {
  assert.equal(fmtDuration(0), '0m');
  assert.equal(fmtDuration(75), '1h 15m');
  assert.equal(fmtDuration(120), '2h');
  assert.equal(fmtDuration(null), '—');
});

// ── Status: not_started ─────────────────────────────────────────────────────────────────────

test('not_started when start_date is later than day', () => {
  const { rows } = run({ employees: [mkEmp({ start_date: '2026-09-18' })] });
  assert.equal(rows[0]!.status, 'not_started');
  assert.equal(rows[0]!.scheduled, false);
});

// ── Status: holiday ─────────────────────────────────────────────────────────────────────────

test('holiday status set, and holiday with records keeps entry fields filled', () => {
  const { rows } = run({
    holidays: [{ date: THURSDAY, name: 'Founders Day' }],
    punches: [mkPunch()],
  });
  assert.equal(rows[0]!.status, 'holiday');
  assert.equal(rows[0]!.holidayName, 'Founders Day');
  assert.equal(rows[0]!.scheduled, false);
  assert.equal(rows[0]!.entryMin, 540);
});

// ── Status: day_off ─────────────────────────────────────────────────────────────────────────

test('day_off on a weekend, and day_off with records keeps entry fields filled', () => {
  const { rows } = run({ day: SATURDAY, punches: [mkPunch()] });
  assert.equal(rows[0]!.status, 'day_off');
  assert.equal(rows[0]!.scheduled, false);
  assert.equal(rows[0]!.entryMin, 540);
});

test('day_off honors a custom work_days list', () => {
  const { rows } = run({ employees: [mkEmp({ work_days: 'Mon,Tue,Wed,Fri' })] }); // Thu excluded
  assert.equal(rows[0]!.status, 'day_off');
});

// ── Status: not_in_yet / late_not_in ────────────────────────────────────────────────────────

test('not_in_yet: isToday, before grace, no punch', () => {
  const { rows } = run({ nowMin: 545 }); // grace = 9:00+10 = 550
  assert.equal(rows[0]!.status, 'not_in_yet');
});

test('late_not_in: isToday, past grace, no punch', () => {
  const { rows } = run({ nowMin: 551 });
  assert.equal(rows[0]!.status, 'late_not_in');
});

test('late_not_in: past day with no records at all', () => {
  const { rows } = run({ isToday: false, nowMin: 300 });
  assert.equal(rows[0]!.status, 'late_not_in');
});

// ── Grace boundary ──────────────────────────────────────────────────────────────────────────

test('entry exactly at graceUntil is NOT lateAfterGrace; one minute later it is', () => {
  const { rows: onTime } = run({ punches: [mkPunch({ first_min: 550 })] }); // grace until 550
  assert.equal(onTime[0]!.lateAfterGrace, false);
  assert.equal(onTime[0]!.graceUntilMin, 550);

  const { rows: late } = run({ punches: [mkPunch({ first_min: 551 })] });
  assert.equal(late[0]!.lateAfterGrace, true);
  assert.equal(late[0]!.minutesLate, 11); // 551 - 540
});

test('graceUntilMin falls back to scheduledStartMin + grace_minutes when schedule.grace does not parse', () => {
  const brokenHelpers: TodayHelpers = { ...helpers, getSchedule: () => ({ start: '9:00 AM', end: '5:00 PM', grace: '' }) };
  const { rows } = run({ helpers: brokenHelpers });
  assert.equal(rows[0]!.graceUntilMin, 540 + 10);
});

// ── Status: working / away / finished ───────────────────────────────────────────────────────

test('working: isToday, entry present, last activity within awayAfterMinutes', () => {
  const { rows } = run({ nowMin: 560, punches: [mkPunch({ first_min: 540, last_min: 555, last_ymd: 20260917 })] });
  assert.equal(rows[0]!.status, 'working');
  assert.equal(rows[0]!.idleMinutes, 5);
});

test('working via cross-midnight last activity (lastActivityNextDay)', () => {
  const { rows } = run({ nowMin: 60, punches: [mkPunch({ first_min: 540, last_min: 30, last_ymd: 20260918 })] });
  assert.equal(rows[0]!.status, 'working');
  assert.equal(rows[0]!.lastActivityNextDay, true);
  assert.equal(rows[0]!.idleMinutes, null);
});

test('away: isToday, entry present, activity stale, before scheduled end', () => {
  const { rows } = run({ nowMin: 600, punches: [mkPunch({ first_min: 540, last_min: 550, last_ymd: 20260917 })] });
  assert.equal(rows[0]!.status, 'away');
  assert.equal(rows[0]!.idleMinutes, 50);
});

test('finished: isToday, activity stale, at/after scheduled end', () => {
  const { rows } = run({ nowMin: 1020, punches: [mkPunch({ first_min: 540, last_min: 950, last_ymd: 20260917 })] });
  assert.equal(rows[0]!.status, 'finished');
});

test('finished: a past day with records is always finished, regardless of activity time', () => {
  const { rows } = run({ isToday: false, nowMin: 560, punches: [mkPunch({ first_min: 540, last_min: 559, last_ymd: 20260917 })] });
  assert.equal(rows[0]!.status, 'finished');
});

// ── Coercion and merging ────────────────────────────────────────────────────────────────────

test('string-typed numeric punch fields are coerced', () => {
  const p = { employee_id: 1, first_min: '540', last_ymd: '20260917', last_min: '555', records: '3', active_s: '900', has_manual: false } as unknown as TodayPunch;
  const { rows } = run({ nowMin: 560, punches: [p] });
  assert.equal(rows[0]!.entryMin, 540);
  assert.equal(rows[0]!.activeMinutes, 15);
});

test('non-finite punch numbers fall back to null/0', () => {
  const p = { employee_id: 1, first_min: 'nope', last_ymd: null, last_min: null, records: 'x', active_s: 'x', has_manual: false } as unknown as TodayPunch;
  const { rows } = run({ punches: [p] });
  assert.equal(rows[0]!.entryMin, null);
  assert.equal(rows[0]!.records, 0);
  assert.equal(rows[0]!.activeMinutes, 0);
});

test('duplicate punch rows for one employee are merged: min first, max last, summed records/active_s, OR has_manual', () => {
  const rowsIn = [
    mkPunch({ first_min: 545, last_min: 600, last_ymd: 20260917, records: 2, active_s: 500, has_manual: false }),
    mkPunch({ first_min: 540, last_min: 610, last_ymd: 20260917, records: 3, active_s: 700, has_manual: true }),
  ];
  const { rows } = run({ nowMin: 700, punches: rowsIn });
  assert.equal(rows[0]!.entryMin, 540);
  assert.equal(rows[0]!.lastActivityMin, 610);
  assert.equal(rows[0]!.records, 5);
  assert.equal(rows[0]!.activeMinutes, 20);
  assert.equal(rows[0]!.hasManual, true);
});

test('duplicate punch rows pick the later (ymd, min) pair for last activity', () => {
  const rowsIn = [
    mkPunch({ last_ymd: 20260917, last_min: 900 }),
    mkPunch({ last_ymd: 20260918, last_min: 10 }),
  ];
  const { rows } = run({ punches: rowsIn });
  assert.equal(rows[0]!.lastActivityMin, 10);
  assert.equal(rows[0]!.lastActivityNextDay, true);
});

// ── Sort order and summary ──────────────────────────────────────────────────────────────────

test('rows sort by status precedence then by name', () => {
  const employees: TodayEmployee[] = [
    mkEmp({ id: 1, name: 'Zed' }),   // finished (past day, has punch)
    mkEmp({ id: 2, name: 'Amy' }),   // late_not_in (no punch, past grace)
    mkEmp({ id: 3, name: 'Bob' }),   // late_not_in (no punch, past grace)
  ];
  const punches: TodayPunch[] = [mkPunch({ employee_id: 1, first_min: 540, last_min: 559 })];
  const { rows } = run({ isToday: false, nowMin: 600, employees, punches });
  assert.deepEqual(rows.map((r) => `${r.status}:${r.name}`), ['late_not_in:Amy', 'late_not_in:Bob', 'finished:Zed']);
});

test('summary counts add up to total and lateArrivals counts lateAfterGrace rows', () => {
  const employees: TodayEmployee[] = [
    mkEmp({ id: 1, name: 'A', start_date: '2099-01-01' }), // not_started
    mkEmp({ id: 2, name: 'B' }),                            // late_not_in (late arrival)
  ];
  const { rows, summary } = run({ nowMin: 560, employees, punches: [mkPunch({ employee_id: 2, first_min: null as unknown as number })] });
  assert.equal(summary.total, rows.length);
  const sumStatuses = summary.working + summary.away + summary.notInYet + summary.lateNotIn
    + summary.finished + summary.dayOff + summary.holiday + (rows.filter((r) => r.status === 'not_started').length);
  assert.equal(sumStatuses, summary.total);
  assert.equal(summary.lateArrivals, rows.filter((r) => r.lateAfterGrace).length);
});
