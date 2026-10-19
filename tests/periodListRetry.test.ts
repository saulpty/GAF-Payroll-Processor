// Period dropdown (2026-10-19): a failed loadPeriods left the Payroll Master dropdown with only
// "Choose A Period" and "All Periods" until a full reload, because FilterBar ignored the loader's
// error and never refetched. Prompt 2026-10-19-period-dropdown/01. Fails until the export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PL1: FilterBar reads the period loader\'s loading and error values', () => {
  const fb = read('src/app/FilterBar.tsx');
  assert.match(fb, /const \[periodsRaw, periodsLoading, periodsError, refetchPeriods\] = useLoadAction\(loadPeriodsAction, \[\] as PeriodRow\[\]\);/);
});

test('PL2: a failed period load is retried, capped at 3 tries', () => {
  const fb = read('src/app/FilterBar.tsx');
  assert.match(fb, /periodRetries\.current >= 3/);
  assert.match(fb, /setTimeout\(\(\) => refetchPeriods\(\), 2000\)/);
  assert.match(fb, /clearTimeout\(t\)/);
});

test('PL3: an empty list says it is loading or failing instead of looking like no periods', () => {
  const fb = read('src/app/FilterBar.tsx');
  assert.match(fb, /Couldn't load periods, retrying…/);
  assert.match(fb, /Loading periods…/);
  assert.ok(Buffer.byteLength(fb) < 15000, 'FilterBar stays under 15 KB');
});
