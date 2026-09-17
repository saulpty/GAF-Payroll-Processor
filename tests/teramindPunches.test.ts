import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sessionsToRawRows, sessionsToRawRowsReport, foldDays } from '../src/app/lib/teramindPunches.ts';
import type { TeramindSessionRow, TeramindRawRow } from '../src/app/lib/teramindTypes.ts';

const SRC_PATH = fileURLToPath(new URL('../src/app/lib/teramindPunches.ts', import.meta.url));
const REFUSAL_Z = /Z$/i;
const REFUSAL_OFFSET = /[T ]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2})/;

test('source has no toISOString and only import-type imports', () => {
  const src = readFileSync(SRC_PATH, 'utf8');
  assert.equal(/toISOString/.test(src), false);
  const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
  assert.ok(importLines.length > 0);
  for (const line of importLines) assert.match(line, /^\s*import type\b/);
});

function sessionRow(email: string, start: string, finish: string): TeramindSessionRow {
  return {
    agent_id: 1,
    employee_id: null,
    work_date: start.slice(0, 10),
    started_et: start,
    finished_et: finish,
    started_raw: start,
    duration_s: 0,
    computer: '',
    teramind_email: email,
  };
}

test('sessionsToRawRows lower-cases/trims email and keeps well-formed clock strings', () => {
  const rows = sessionsToRawRows([sessionRow('  Foo@Bar.com ', '2026-01-01 08:00:00', '2026-01-01 12:00:00')]);
  assert.deepEqual(rows, [{ email: 'foo@bar.com', timeStarted: '2026-01-01 08:00:00', timeFinished: '2026-01-01 12:00:00' }]);
});

test('sessionsToRawRowsReport skips and counts empty-email and bad-clock rows', () => {
  const rows: TeramindSessionRow[] = [
    sessionRow('', '2026-01-01 08:00:00', '2026-01-01 12:00:00'),
    sessionRow('a@b.com', '2026-01-01T08:00:00Z', '2026-01-01 12:00:00'),
    sessionRow('a@b.com', '2026-01-01 08:00:00', '2026-01-01 12:00:00'),
  ];
  const report = sessionsToRawRowsReport(rows);
  assert.equal(report.skippedNoEmail, 1);
  assert.equal(report.skippedBadClock, 1);
  assert.deepEqual(report.rows, [{ email: 'a@b.com', timeStarted: '2026-01-01 08:00:00', timeFinished: '2026-01-01 12:00:00' }]);
});

test('foldDays folds two sessions for one employee/day into a single min/max entry', () => {
  const rows: TeramindRawRow[] = [
    { email: 'a@b.com', timeStarted: '2026-01-01 13:00:00', timeFinished: '2026-01-01 17:30:00' },
    { email: 'a@b.com', timeStarted: '2026-01-01 09:00:00', timeFinished: '2026-01-01 12:00:00' },
  ];
  const folded = foldDays(rows);
  assert.deepEqual(folded.get('a@b.com')?.get('2026-01-01'), {
    entry: '2026-01-01 09:00:00',
    exit: '2026-01-01 17:30:00',
  });
});

test('a session crossing midnight stays keyed on the start date, exit lands on the next day', () => {
  const rows: TeramindRawRow[] = [{ email: 'a@b.com', timeStarted: '2026-01-01 23:50:00', timeFinished: '2026-01-02 00:35:00' }];
  const folded = foldDays(rows);
  assert.deepEqual(folded.get('a@b.com')?.get('2026-01-01'), {
    entry: '2026-01-01 23:50:00',
    exit: '2026-01-02 00:35:00',
  });
  assert.equal(folded.get('a@b.com')?.has('2026-01-02'), false);
});

test('foldDays keys are lower-cased', () => {
  const rows: TeramindRawRow[] = [{ email: 'A@B.COM', timeStarted: '2026-01-01 09:00:00', timeFinished: '2026-01-01 10:00:00' }];
  const folded = foldDays(rows);
  assert.ok(folded.has('a@b.com'));
  assert.equal(folded.has('A@B.COM'), false);
});

test('foldDays output strings never match the payroll refusal regexes', () => {
  const rows: TeramindRawRow[] = [{ email: 'a@b.com', timeStarted: '2026-01-01 09:00:00', timeFinished: '2026-01-01 10:00:00' }];
  const day = foldDays(rows).get('a@b.com')?.get('2026-01-01')!;
  assert.equal(REFUSAL_Z.test(day.entry), false);
  assert.equal(REFUSAL_OFFSET.test(day.entry), false);
  assert.equal(REFUSAL_Z.test(day.exit), false);
  assert.equal(REFUSAL_OFFSET.test(day.exit), false);
});

test('foldDays input order does not matter', () => {
  const a: TeramindRawRow = { email: 'a@b.com', timeStarted: '2026-01-01 09:00:00', timeFinished: '2026-01-01 12:00:00' };
  const b: TeramindRawRow = { email: 'a@b.com', timeStarted: '2026-01-01 13:00:00', timeFinished: '2026-01-01 17:30:00' };
  assert.deepEqual(foldDays([a, b]).get('a@b.com')?.get('2026-01-01'), foldDays([b, a]).get('a@b.com')?.get('2026-01-01'));
});
