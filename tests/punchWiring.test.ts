// Structural guards for the 2026-09-11 punch-minutes wiring: the pages must
// recompute late/early minutes from the row's punches on save and write them
// through updatePunchTimes. Pages are .tsx and cannot be executed here, so the
// guard reads the source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const ACTION = 'src/actions/updatePunchTimes.ts';
const PM = 'src/app/pages/PayrollMaster.tsx';

test('PW1: updatePunchTimes writes both times and all three minute columns', () => {
  assert.ok(existsSync(ACTION), `${ACTION} should exist`);
  const src = readFileSync(ACTION, 'utf8');
  for (const col of ['entry_time = {{params.entry_time}}', 'exit_time = {{params.exit_time}}']) {
    assert.ok(src.includes(col), `${ACTION} must set ${col}`);
  }
  for (const col of ['late_minutes', 'late_after_grace', 'early_leave_minutes']) {
    assert.ok(src.includes(`${col} = {{params.${col}}}::int`), `${ACTION} must set ${col} = {{params.${col}}}::int`);
  }
  assert.ok(/WHERE id = \{\{params\.id\}\}::bigint/.test(src), 'must be keyed by id');
});

test('PW2: PayrollMaster saves through computePunchMinutes + updatePunchTimes, not updateEntryExit', () => {
  const src = readFileSync(PM, 'utf8');
  assert.ok(src.includes("from '@/app/lib/punchMinutes'"), 'PayrollMaster must import computePunchMinutes');
  assert.ok(src.includes("from '@/actions/updatePunchTimes'"), 'PayrollMaster must import updatePunchTimes');
  assert.ok(!src.includes('updateEntryExit'), 'PayrollMaster must no longer reference updateEntryExit');
  const start = src.indexOf('const handleSave');
  const body = src.slice(start, src.indexOf('const toggleSelect', start));
  assert.ok(body.includes('computePunchMinutes('), 'handleSave must recompute minutes');
  assert.ok(/late_minutes:\s*mins\.late_minutes/.test(body), 'computeDerivedFields must receive the recomputed late_minutes');
  assert.ok(/early_leave_minutes:\s*mins\.early_leave_minutes/.test(body), 'computeDerivedFields must receive the recomputed early_leave_minutes');
  assert.ok(!/late_minutes:\s*row\.late_minutes/.test(body), 'handleSave must not feed the stale row.late_minutes into the derived fields');
});
