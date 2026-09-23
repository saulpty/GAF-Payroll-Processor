// Structural guards for prompt 2026-09-23-review-fixes/07: the Payroll Master
// ALL / GREEN / YELLOW / RED tabs must filter in the database (loadPayrollMaster's
// status param), not only the 500 rows already loaded, and a tab change must go
// back to page 1. Pages are .tsx and cannot be executed here, so the guard reads
// the source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PM = 'src/app/pages/PayrollMaster.tsx';
const LOAD = 'src/actions/loadPayrollMaster.ts';
const COUNT = 'src/actions/countPayrollMaster.ts';
const STATUS_SQL = "(COALESCE({{params.status}}, '') = '' OR pe.status_current = {{params.status}})";

const pm = () => readFileSync(PM, 'utf8');

test('PMT1: loadPayrollMaster and countPayrollMaster both filter on the status param', () => {
  for (const f of [LOAD, COUNT]) {
    assert.ok(readFileSync(f, 'utf8').includes(STATUS_SQL), `${f} must keep ${STATUS_SQL}`);
  }
});

test('PMT2: both loaders get their params flat, never wrapped in { params: ... }', () => {
  const src = pm();
  assert.ok(
    /useLoadAction\(loadPayrollMasterAction,\s*\[\] as EntryRow\[\],\s*params,/.test(src),
    'loadPayrollMaster must receive the params state object directly as the third argument',
  );
  assert.ok(
    /useLoadAction\(countPayrollMasterAction,[^;]*status:\s*params\.status/.test(src),
    'countPayrollMaster must receive status: params.status so the total is the tab total',
  );
  assert.ok(!/useLoadAction\([^;]*\{\s*params\s*:/.test(src), 'no useLoadAction call may use the { params: ... } wrapper');
});

test('PMT3: the initial params.status comes from the tab, not a hardcoded empty string', () => {
  const src = pm();
  const start = src.indexOf('const [params, setParams] = useState(');
  assert.ok(start >= 0, 'params state must exist');
  const init = src.slice(start, src.indexOf('});', start));
  assert.ok(!/status:\s*''\s*,/.test(init), "params.status must not start as a hardcoded ''");
  assert.ok(/status:\s*activeTab === 'ALL' \? '' : activeTab/.test(init),
    "params.status must start as activeTab === 'ALL' ? '' : activeTab");
});

test('PMT4: changing tab sets params.status from the tab, resets offset to 0 and goes to page 1', () => {
  const src = pm();
  const effects = [...src.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\);/g)];
  const tabEffect = effects.find(m => m[2].split(',').map(s => s.trim()).includes('activeTab'));
  assert.ok(tabEffect, 'a useEffect with activeTab in its dependency list must exist');
  const body = tabEffect![1];
  assert.ok(/status:\s*activeTab === 'ALL' \? '' : activeTab/.test(body),
    "the tab effect must set status: activeTab === 'ALL' ? '' : activeTab");
  assert.ok(/offset:\s*0/.test(body), 'the tab effect must reset offset to 0');
  assert.ok(/setPage\(0\)/.test(body), 'the tab effect must go back to page 1 (setPage(0))');
  assert.ok(!body.includes('discardAll('), 'switching tab must not throw away unsaved drafts');
});

test('PMT5: the Export CSV button says it exports only the current page when there are several', () => {
  const src = pm();
  const btn = src.indexOf('onClick={exportCsv}');
  assert.ok(btn >= 0, 'Export CSV button must exist');
  const before = src.slice(Math.max(0, btn - 600), btn);
  assert.ok(before.includes('totalPages > 1'), 'the note must only show when there is more than one page');
  assert.ok(before.includes('CSV exports this page only'), 'the note text must be "CSV exports this page only"');
});
