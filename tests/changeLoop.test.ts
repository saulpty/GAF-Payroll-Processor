import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mirrorDirectory } from '../tools/sync-export.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'loop-test-')); }
function write(root, rel, body) {
  const full = join(root, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, body);
}

// Simulates: "fix Period Log" but UIB also edits classificationEngine.
test('an edit outside the requested scope is reported', () => {
  const baseline = tmp(), incoming = tmp();

  for (const d of [baseline, incoming]) {
    write(d, 'app/pages/PeriodLog.tsx', 'export const PeriodLog = 1;\n');
    write(d, 'app/lib/classificationEngine.ts', 'export const rate = 1.0;\n');
  }
  // UIB changes the requested file AND one it was told not to touch.
  write(incoming, 'app/pages/PeriodLog.tsx', 'export const PeriodLog = 2;\n');
  write(incoming, 'app/lib/classificationEngine.ts', 'export const rate = 9.9;\n');

  const result = mirrorDirectory(incoming, baseline);
  const requestedScope = ['app/pages/PeriodLog.tsx'];
  const outOfScope = [...result.added, ...result.changed, ...result.removed]
    .filter((f) => !requestedScope.includes(f));

  assert.deepEqual(outOfScope, ['app/lib/classificationEngine.ts'],
    'collateral damage must be surfaced');

  rmSync(baseline, { recursive: true, force: true });
  rmSync(incoming, { recursive: true, force: true });
});

test('a clean, in-scope change reports nothing out of scope', () => {
  const baseline = tmp(), incoming = tmp();
  for (const d of [baseline, incoming]) {
    write(d, 'app/lib/classificationEngine.ts', 'export const rate = 1.0;\n');
  }
  write(baseline, 'app/pages/PeriodLog.tsx', 'export const PeriodLog = 1;\n');
  write(incoming, 'app/pages/PeriodLog.tsx', 'export const PeriodLog = 2;\n');

  const result = mirrorDirectory(incoming, baseline);
  const requestedScope = ['app/pages/PeriodLog.tsx'];
  const outOfScope = [...result.added, ...result.changed, ...result.removed]
    .filter((f) => !requestedScope.includes(f));

  assert.deepEqual(outOfScope, []);
  rmSync(baseline, { recursive: true, force: true });
  rmSync(incoming, { recursive: true, force: true });
});
