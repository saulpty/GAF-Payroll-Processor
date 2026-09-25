import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// AR-12..14 (2026-09-25): fixes from the Impeccable design review of Action Required
// (docs/findings/2026-09-25-impeccable-action-required.md).
const read = (f: string) => readFileSync(f, 'utf8');
const AR = 'src/app/pages/action-required/';

test('PL1: the commit confirmation shows everything the commit writes', () => {
  const c = read(AR + 'ArConfirm.tsx');
  assert.match(c, /rowDiscount\(row, edit\)/, 'same discount maths as the row');
  assert.match(c, /edit\.event_type_2/);
  assert.match(c, /edit\.pay_impact_2/);
  assert.match(c, /fmtDay\(row\.work_date\.slice\(0, 10\), THIS_YEAR\)/);
  assert.match(c, /IMPACT_DOT\[impactTone\(impact\)\]/);
  assert.doesNotMatch(c, /text-blue-700|GREEN|row\(s\)|⚠/);
});

test('PL2: the commit confirmation is a real dialog', () => {
  const c = read(AR + 'ArConfirm.tsx');
  assert.match(c, /role="dialog" aria-modal="true" aria-labelledby=\{titleId\}/);
  assert.match(c, /e\.key === 'Escape'/);
  assert.match(c, /confirmRef\.current\?\.focus\(\)/);
});

test('PL3: row and confirmation share one discount helper', () => {
  const row = read(AR + 'ArRow.tsx');
  assert.match(row, /const \{ late, early, discount \} = rowDiscount\(row, edit\)/);
  assert.doesNotMatch(row, /computeDiscount|computePunchMinutes/);
});

test('PL4: In, Out and Notes have names; the day sits under the employee name', () => {
  const row = read(AR + 'ArRow.tsx');
  const ti = read('src/app/components/TimeInput.tsx');
  assert.match(row, /ariaLabel=\{`In, \$\{who\}`\}/);
  assert.match(row, /ariaLabel=\{`Out, \$\{who\}`\}/);
  assert.match(row, /aria-label=\{`Notes, \$\{who\}`\}/);
  assert.match(row, /text-\[11px\] text-slate-500" aria-hidden="true">\{day\}/);
  assert.match(ti, /aria-label=\{ariaLabel\}/);
  assert.match(ti, /aria-describedby=\{bad \? errorId : undefined\}/);
});

test('PL5: toasts are announced, pause on hover, and Undo lasts 10 s', () => {
  const t = read('src/app/components/ds/Toast.tsx');
  assert.match(t, /role="alert" aria-live="assertive"/);
  assert.match(t, /role="status" aria-live="polite"/);
  assert.match(t, /t\.onUndo \? 10000 : 5000/);
  assert.match(t, /onMouseEnter=\{\(\) => setPaused\(true\)\}/);
});

test('PL6: readable placeholder; revert and period-change say what happened; locked while reloading', () => {
  assert.match(read('src/app/components/ds/Combobox.tsx'), /value \? 'text-slate-700' : 'text-slate-500'/);
  assert.match(read(AR + 'useArCommit.ts'), /back to Action Required/);
  const page = read('src/app/pages/ActionRequired.tsx');
  assert.match(page, /if \(dirtyCount > 0\) toast\.show\(\{ message: `Discarded \$\{dirtyCount\} unsaved/);
  assert.match(page, /inert=\{loading \|\| undefined\}/);
});
