import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// AP1 (AR-11, Saul 2026-09-25): Late and Early read as plain dark text, like the
// rest of the row. Only the Discount pill carries red/yellow.
test('AP1: Late and Early cells are plain dark text, not red/yellow', () => {
  const src = readFileSync('src/app/pages/action-required/ArRow.tsx', 'utf8');
  assert.match(src, /late > 0 \? 'text-slate-800' : 'text-slate-300'/);
  assert.match(src, /early > 0 \? 'text-slate-800' : 'text-slate-300'/);
  assert.doesNotMatch(src, /(late|early) > 0 \? 'font-semibold text-status-/);
});
