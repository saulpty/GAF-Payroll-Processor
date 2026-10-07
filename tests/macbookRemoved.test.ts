// The MacBook-swap feature was a one-time thing and is gone (Saul, 2026-10-07).
// Prompts: docs/superpowers/prompts/2026-10-07-macbook-removal/01..02.
// The DB column employees.is_macbook_swap stays (unused, DEFAULT FALSE); no code reads or writes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap(n => {
    const p = `${dir}/${n}`;
    return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
  });
}

test('MB1: no app code or action reads or writes is_macbook_swap', () => {
  const files = [...walk('src/app'), ...walk('src/actions')].filter(f => /\.tsx?$/.test(f));
  const hits = files.filter(f => /is_macbook_swap/.test(read(f)));
  assert.deepEqual(hits, []);
});

test('MB2: the engine has no MacBook-swap step; no-data days still go to Step 5', () => {
  const eng = read('src/app/lib/classificationEngine.ts');
  assert.doesNotMatch(eng, /Macbook swap|macbook-swap/i);
  assert.match(eng, /\/\/ ── Step 3: Absence form ──/);
  assert.match(eng, /\/\/ ── Step 5: No data \+ no form ──\s*\n\s*if \(!tmEntry\) \{/);
});

test('MB3: the Roster has no Macbook column', () => {
  const t = read('src/app/pages/admin/employees/rosterTypes.ts');
  assert.doesNotMatch(t, /Macbook|Laptop/);
  assert.equal((t.match(/\{ key: '/g) ?? []).length, 3, 'Grace, Excluded, Active');
});
