// 2026-10-12 — top-bar Refresh button (prompts 2026-10-12-refresh/01–02). Source guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const SYNCS = ['AccessAutoSync', 'TeramindAutoSync', 'MondayAutoSync'];

test('RB1: the Refresh button sits left of the name pill and never reloads the browser', () => {
  const nav = read('src/app/TopNav.tsx');
  assert.match(nav, /<RefreshButton \/>\s*\{isViewingAs \? \(/, 'the button goes directly before the name pill');
  const btn = read('src/app/components/RefreshButton.tsx');
  assert.match(btn, /await runAllSyncs\(\);/);
  assert.match(btn, /bumpRefreshVersion\(\)/);
  assert.match(btn, /disabled=\{busy\}/, 'a second click must not start a second run');
  assert.doesNotMatch(btn, /location\.(reload|assign|href)/, 'the app lives in an iframe: a reload 404s');
  assert.doesNotMatch(btn, /useTeramindPull|actions\//, 'the button itself calls no action — managers can click it');
});

test('RB2: Process Payroll is never remounted by a refresh', () => {
  const btn = read('src/app/components/RefreshButton.tsx');
  assert.match(btn, /if \(!pathRef\.current\.startsWith\('\/process'\)\) bumpRefreshVersion\(\);/);
});

test('RB3: the page remounts on refreshVersion while the background syncs stay outside', () => {
  const app = read('src/app/app.tsx');
  assert.match(app, /<div key=\{refreshVersion\}/);
  assert.match(app, /<MondayAutoSync \/>\s*<RefreshBoundary>/, 'the syncs must not remount with the page');
  const ctx = read('src/app/context/GlobalFilterContext.tsx');
  assert.match(ctx, /refreshVersion, bumpRefreshVersion,/);
  assert.match(ctx, /arVersion, refreshVersion, period,/, 'a bump must reach the consumers');
});

test('RB4: a sync registers for the button only after the super-user check', () => {
  for (const name of SYNCS) {
    const src = read(`src/app/components/${name}.tsx`);
    const gate = src.indexOf('if (!isSuper) return;');
    const reg = src.indexOf('registerSync(');
    assert.ok(gate > 0 && reg > gate, `${name}: registerSync must come after the isSuper gate`);
    assert.match(src, /async function maybeSync\(force = false\)/, `${name}: timers must keep running unforced`);
    assert.match(src, /unregister\(\); \};/, `${name}: must unregister on cleanup`);
    assert.match(src, /document\.hidden/, `${name}: a background tab must still not sync`);
  }
});

test('RB5: a forced Monday run still claims each board in the database', () => {
  const src = read('src/app/components/MondayAutoSync.tsx');
  assert.match(src, /intervalMinutes: force \? 1 : intervalMinutes/);
  assert.match(src, /const due = force \? BOARDS : BOARDS\.filter/);
});

test('RB6: the refresh interval was moved to 5 minutes by a migration, not by code', () => {
  const file = readdirSync(new URL('../src/migrations/', import.meta.url)).find(f => f.endsWith('_sync_every_5_minutes.sql'));
  assert.ok(file, 'migration <n>_sync_every_5_minutes.sql is missing');
  const sql = read(`src/migrations/${file}`);
  assert.match(sql, /SET value = '5'/);
  assert.match(sql, /WHERE key = 'sync_every_minutes'/);
});
