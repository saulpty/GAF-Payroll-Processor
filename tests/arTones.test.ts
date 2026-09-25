import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { impactTone, IMPACT_DOT } from '../src/app/pages/action-required/arLogic.ts';

// AT1-AT3 (2026-09-25, Tim + Saul after 8.15.0): the dropdown list opened hidden
// behind other cells; pay impacts should be told apart by colour.

test('AT1: impact colour mirrors computeDiscount — only Unpaid impacts deduct', () => {
  assert.equal(impactTone('Unpaid'), 'unpaid');
  assert.equal(impactTone('Unpaid (without Grace)'), 'unpaid');
  assert.equal(impactTone('Unpaid (with Grace)'), 'partial');
  for (const v of ['Paid', 'Paid (Grace)', 'Paid – Exception', 'Incapacidad', 'Constancia Medica', 'Floating Holiday / B-Day Off']) {
    assert.equal(impactTone(v), 'paid', v);
  }
  assert.equal(impactTone(''), 'none');
  assert.equal(impactTone(null), 'none');
  assert.equal(IMPACT_DOT.unpaid, 'bg-status-red-ink');
});

test('AT2: the dropdown list is portalled out of the table, fixed-positioned', () => {
  const cb = readFileSync('src/app/components/ds/Combobox.tsx', 'utf8');
  assert.match(cb, /import \{ createPortal \} from 'react-dom';/);
  assert.match(cb, /createPortal\(/);
  assert.match(cb, /position: 'fixed'/);
  assert.match(cb, /window\.addEventListener\('scroll', onScroll, true\)/);
});

test('AT3: impacts carry the colour dot in the rows and the Committed list', () => {
  const row = readFileSync('src/app/pages/action-required/ArRow.tsx', 'utf8');
  const done = readFileSync('src/app/pages/action-required/ArCommitted.tsx', 'utf8');
  assert.match(row, /combo\('pay_impact_1', edit\.pay_impact_1, impactOptions, 'Impact 1', false, impactDot\)/);
  assert.match(row, /combo\('pay_impact_2', edit\.pay_impact_2, impactOptions, 'Impact 2', false, impactDot\)/);
  assert.match(done, /\{impact\(r\.pay_impact_1\)\}/);
});
