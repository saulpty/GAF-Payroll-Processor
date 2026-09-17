// Time Records grid rows (the source of payroll's export file) — real shapes from 2026-09-17.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTimeRecord } from '../src/app/lib/teramindRows.ts';
import { sessionClock } from '../src/app/lib/teramindTime.ts';
import { recordWindow, inDateRange } from '../src/app/lib/teramindPull.ts';
import { sessionsToRawRows, foldDays } from '../src/app/lib/teramindPunches.ts';

const rec = (start: number, end: number, extra: Record<string, unknown> = {}) => ({
  meta: { id: 1, computer_id: 481 }, agent: { name: 'Some Person', agent_id: 374, email: 'some.p@example.com' },
  task: { name: 'My task', task_id: 1 }, duration: end - start, period: [start, end], is_manual: false,
  started_at: 'ignored display text', finished_at: 'ignored display text', ...extra,
});

test('a real record: instants become Eastern clock text; display strings are ignored', () => {
  // 1789673965 = 2026-09-17 15:39:25 EDT, 120 s long
  const s = normalizeTimeRecord(rec(1789673965, 1789674085), sessionClock)!;
  assert.equal(s.agent_id, 374);
  assert.equal(s.work_date, '2026-09-17');
  assert.equal(s.started_et, '2026-09-17 15:39:25');
  assert.equal(s.finished_et, '2026-09-17 15:41:25');
  assert.equal(s.started_raw, '1789673965');
  assert.equal(s.duration_s, 120);
  assert.equal(s.computer, '481');
  assert.equal(s.source, 'time_record');
  assert.equal(s.is_manual, false);
});

test('winter (EST) and a manual record', () => {
  const start = Date.UTC(2026, 0, 12, 13, 56, 0) / 1000; // 08:56 EST
  const s = normalizeTimeRecord(rec(start, start + 600, { is_manual: true }), sessionClock)!;
  assert.equal(s.started_et, '2026-01-12 08:56:00');
  assert.equal(s.is_manual, true);
});

test('a record that crosses midnight stays on its start date', () => {
  const start = Date.UTC(2026, 7, 12, 3, 50, 0) / 1000; // 2026-08-11 23:50 EDT
  const s = normalizeTimeRecord(rec(start, start + 2700), sessionClock)!;
  assert.equal(s.work_date, '2026-08-11');
  assert.equal(s.finished_et, '2026-08-12 00:35:00');
});

test('bad rows are refused', () => {
  assert.equal(normalizeTimeRecord({ agent: { agent_id: 374 }, period: [] }, sessionClock), null);
  assert.equal(normalizeTimeRecord({ agent: {}, period: [1789673965, 1789674085] }, sessionClock), null);
  assert.equal(normalizeTimeRecord(rec(0, 10), sessionClock), null);
});

test('end before start falls back to the duration field, never negative', () => {
  const s = normalizeTimeRecord(rec(1789673965, 1789673000, { duration: 90 }), sessionClock)!;
  assert.equal(s.duration_s, 90);
  const z = normalizeTimeRecord(rec(1789673965, 1789673000, { duration: -5 }), sessionClock)!;
  assert.equal(z.duration_s, 0);
});

test('the asked window is wider than the dates, and inDateRange trims it back', () => {
  const w = recordWindow('2026-08-10', '2026-08-24');
  assert.equal(w.periodStart, Date.UTC(2026, 7, 9) / 1000);
  assert.equal(w.periodEnd, Date.UTC(2026, 7, 26) / 1000 - 1);
  // Eastern midnight of the first and last day are inside the window in both DST regimes
  assert.ok(w.periodStart < Date.UTC(2026, 7, 10, 4) / 1000);
  assert.ok(w.periodEnd > Date.UTC(2026, 7, 25, 5) / 1000);
  assert.equal(inDateRange('2026-08-10', '2026-08-10', '2026-08-24'), true);
  assert.equal(inDateRange('2026-08-09', '2026-08-10', '2026-08-24'), false);
  assert.equal(inDateRange('2026-08-25', '2026-08-10', '2026-08-24'), false);
});

test('Aug 11 for the probe employee folds to 08:56 -> 17:01, the same as payroll', () => {
  const at = (h: number, m: number) => Date.UTC(2026, 7, 11, h + 4, m, 0) / 1000; // EDT = UTC-4
  const recs = [rec(at(16, 57), at(17, 1) + 30), rec(at(15, 20), at(16, 57)), rec(at(8, 56), at(10, 21))];
  const saved = recs.map(r => normalizeTimeRecord(r, sessionClock)!);
  const days = foldDays(sessionsToRawRows(saved.map(s => ({ ...s, teramind_email: 'Some.P@Example.com' }))));
  const d = days.get('some.p@example.com')!.get('2026-08-11')!;
  assert.equal(d.entry.slice(11, 16), '08:56');
  assert.equal(d.exit.slice(11, 16), '17:01');
});
