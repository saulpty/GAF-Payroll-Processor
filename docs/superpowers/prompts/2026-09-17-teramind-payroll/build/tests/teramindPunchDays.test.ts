// Saved Teramind days → payroll's raw rows (what the uploaded file used to provide).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punchDaysToRawRows, foldDays, type PunchDay } from '../src/app/lib/teramindPunches.ts';

const day = (o: Partial<PunchDay>): PunchDay => ({
  teramind_email: 'Some.P@Example.com', first_ymd: 20260811, first_min: 536, last_ymd: 20260811, last_min: 1021, ...o,
});
const CLOCK = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:00$/;
const REFUSED = (s: string) => /Z$/i.test(s) || /[T ]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2})/.test(s);

test('the probe day becomes 08:56 → 17:01, minute precision, lower-case email', () => {
  const { rows, skipped } = punchDaysToRawRows([day({})]);
  assert.equal(skipped, 0);
  assert.deepEqual(rows, [{ email: 'some.p@example.com', timeStarted: '2026-08-11 08:56:00', timeFinished: '2026-08-11 17:01:00' }]);
});

test('every string is one the payroll parser accepts (no T, no Z, no offset, seconds always 00)', () => {
  const { rows } = punchDaysToRawRows([day({}), day({ first_min: 0, last_min: 1439 }), day({ last_ymd: 20260812, last_min: 35 })]);
  for (const r of rows) for (const s of [r.timeStarted, r.timeFinished]) { assert.match(s, CLOCK); assert.equal(REFUSED(s), false); }
});

test('a day whose last record ends after midnight keeps its start date as the key', () => {
  const { rows } = punchDaysToRawRows([day({ first_min: 290, last_ymd: 20260812, last_min: 35 })]);
  assert.equal(rows[0].timeFinished, '2026-08-12 00:35:00');
  const d = foldDays(rows).get('some.p@example.com')!;
  assert.deepEqual([...d.keys()], ['2026-08-11']);
});

test('bad rows are skipped and counted, never guessed at', () => {
  const bad: PunchDay[] = [
    day({ teramind_email: '' }), day({ first_ymd: 20261311 }), day({ first_min: 1440 }), day({ last_min: -1 }),
    day({ first_ymd: NaN as unknown as number }), day({ last_ymd: 20260810 }), // finish before start
    day({ first_min: 8.5 }),
  ];
  const { rows, skipped } = punchDaysToRawRows(bad);
  assert.equal(rows.length, 0); assert.equal(skipped, bad.length);
});

test('numbers that arrive as strings are accepted (the data layer sometimes stringifies ints)', () => {
  const { rows } = punchDaysToRawRows([day({ first_ymd: '20260811' as unknown as number, first_min: '536' as unknown as number })]);
  assert.equal(rows[0].timeStarted, '2026-08-11 08:56:00');
});
