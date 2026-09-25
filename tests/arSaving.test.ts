import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// AS1-AS4 (2026-09-25, AR-2/AR-3): Saul's Action Required notes — the screen
// flashed on every commit, rows showed old values after saving ("doesn't change
// but does change"), refused rows came back as a browser alert, and the red/yellow
// counts and nav badge went stale after commits.
const page = readFileSync('src/app/pages/ActionRequired.tsx', 'utf8');
// AR-3 moved commit / undo / revert into this hook.
const HOOK = 'src/app/pages/action-required/useArCommit.ts';
const hook = existsSync(HOOK) ? readFileSync(HOOK, 'utf8') : '';
const commitSrc = page + hook;
const ctx = readFileSync('src/app/context/GlobalFilterContext.tsx', 'utf8');
const bar = readFileSync('src/app/FilterBar.tsx', 'utf8');
const nav = readFileSync('src/app/TopNav.tsx', 'utf8');
const app = readFileSync('src/app/app.tsx', 'utf8');

test('AS1: only the very first load replaces the page with a spinner', () => {
  assert.match(page, /const firstLoad = loading && \(rows as EntryRow\[\]\)\.length === 0;/);
  assert.match(page, /\{firstLoad && \(/);
  assert.doesNotMatch(page, /\{loading && \(\s*<div/);
  assert.match(page, /\{!firstLoad && allRows\.length > 0 && \(/);
});

test('AS2: drafts are dropped only after the reload, and GREEN rows leave at once', () => {
  assert.match(hook, /await refresh\(\);\s*\}\s*finally\s*\{[^}]*savedIds\.forEach\(id => markSaved\(id\)\)/, 'markSaved must follow the reload');
  assert.match(hook, /setHiddenIds\(prev => new Set\(prev\)\.add\(row\.id\)\)/);
});

test('AS3: no browser alert; results go to the toast, with Undo; the page owns its provider', () => {
  assert.doesNotMatch(commitSrc, /window\.alert/);
  assert.match(page, /<ToastProvider>/);
  assert.match(hook, /onUndo:/);
  assert.doesNotMatch(app, /ToastProvider/, 'page-by-page rollout: app.tsx stays untouched');
});

test('AS4: commits, reverts and undo refresh the counts and the nav badge', () => {
  assert.match(hook, /const refresh = async \(\) => \{\s*live\.current\.bumpArVersion\(\);/);
  assert.equal((hook.match(/await refresh\(\);/g) ?? []).length, 3, 'commit, undo and revert all refresh');
  assert.match(ctx, /arVersion: number;/);
  assert.match(ctx, /const bumpArVersion = \(\) => setArVersion\(v => v \+ 1\);/);
  assert.match(bar, /reloadCounts\(\);/);
  assert.match(nav, /reloadUnresolved\(\);/);
});
