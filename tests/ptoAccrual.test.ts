import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  days360, accruedPto, takenPto, defaultTotalDays, fhEligibleDate, fhRemaining,
} from '../src/app/lib/ptoAccrual.ts';

const ASOF = '2026-08-11'; // the sheet's TODAY() when it was saved

test('days360 matches Excel (US method) for rows taken from the sheet', () => {
  assert.equal(days360('2025-04-21', ASOF), 470); // Timothy Moore  -> 42.7273
  assert.equal(days360('2025-03-01', ASOF), 520); // Reggina Sandoval -> 47.2727
  assert.equal(days360('2025-01-29', ASOF), 552); // Luis Abad -> 50.1818
  assert.equal(days360('2025-09-08', ASOF), 333); // Juan Fonseca -> 30.2727
  assert.equal(days360('2026-02-24', ASOF), 167); // Charles Bush -> 15.1818
});

test('days360 handles the 31st exactly as Excel does', () => {
  assert.equal(days360('2025-01-31', '2025-03-01'), 31); // start 31 -> 30
  assert.equal(days360('2025-01-30', '2025-03-31'), 60); // end 31, start >= 30 -> 30
  assert.equal(days360('2025-01-15', '2025-03-31'), 76); // end 31, start < 30 -> 1st of next month
  assert.equal(days360('2025-02-28', '2025-03-30'), 30); // start = last day of Feb -> 30
});

test('days360 is zero on the same day and never negative for start <= end', () => {
  assert.equal(days360(ASOF, ASOF), 0);
  assert.equal(days360('2026-08-10', ASOF), 1);
});

test('accruedPto = days360 / 11, matching the sheet to 4 decimals', () => {
  assert.equal(accruedPto('2025-04-21', ASOF).toFixed(4), '42.7273');
  assert.equal(accruedPto('2026-02-24', ASOF).toFixed(4), '15.1818');
});

test('takenPto sums recorded rows only, tolerating string numerics from SQL', () => {
  const rows = [
    { total_days: '15', status: 'recorded' },
    { total_days: 4.5, status: 'recorded' },
    { total_days: 7, status: 'pending' },
    { total_days: 3, status: 'withdrawn' },
  ];
  assert.equal(takenPto(rows), 19.5);
  assert.equal(takenPto([]), 0);
});

test('defaultTotalDays is calendar days between leave and return, as every sheet row is', () => {
  assert.equal(defaultTotalDays('2025-09-22', '2025-10-06'), 14); // Luis Abad row 4
  assert.equal(defaultTotalDays('2026-03-16', '2026-03-17'), 1);
  assert.equal(defaultTotalDays('2026-02-27', '2026-03-02'), 3);  // crosses Feb end
});

test('floating holidays: eligible 90 calendar days after hire; remaining never negative', () => {
  assert.equal(fhEligibleDate('2025-04-21'), '2025-07-20'); // sheet: 45858
  assert.equal(fhEligibleDate('2026-06-15'), '2026-09-13'); // Eder Quintero: 46278
  assert.equal(fhRemaining(2, 0), 2);
  assert.equal(fhRemaining(2, 2), 0);
  assert.equal(fhRemaining(2, 3), 0);
});
