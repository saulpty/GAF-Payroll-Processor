import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// NT1 (2026-09-25): Tim's "Save crashes Payroll Master". Every reload swapped the
// whole table (444 rows, 28k <option>s) for "Loading…" and rebuilt it, freezing
// the tab for over a minute. The table must stay mounted while data reloads;
// the full-page spinner is only for the very first load.
const pm = readFileSync('src/app/pages/PayrollMaster.tsx', 'utf8');

test('NT1: Payroll Master keeps the table mounted during reloads', () => {
  assert.doesNotMatch(pm, /\{periodChosen && !loading && \(/);
  assert.match(pm, /periodChosen && !\(loading && allRows\.length === 0\)/);
  assert.match(pm, /periodChosen && loading && allRows\.length === 0 &&/);
});
