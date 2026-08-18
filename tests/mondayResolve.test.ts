import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResolver } from '../src/app/lib/mondayResolve.ts';
// The real engine normalizer is injected, so these tests prove the resolver
// works with the exact function the app uses -- not a stand-in.
import { normalizeName } from '../src/app/lib/classificationEngine.ts';

const employees = [
  { id: 1, display_name: 'Eddy Cedeño', teramind_email: 'eddy.c@vitasyahc.com' },
  { id: 2, display_name: 'Jose De Hermoso', teramind_email: 'jose.d@avondalecaregrouppa.com' },
  { id: 3, display_name: 'No Email Person', teramind_email: null },
];
const aliases = [{ alias_text: 'Joseph De Hermoso', employee_id: 2 }];
const resolve = buildResolver(employees, aliases, normalizeName);

test('email wins, case-insensitively, even when the name would not match', () => {
  assert.equal(resolve('Somebody Else', 'EDDY.C@vitasyahc.com'), 1);
});

test('alias is tried before the display name', () => {
  assert.equal(resolve('Joseph De Hermoso', null), 2);
});

test('normalized display name: accents, case and whitespace do not matter', () => {
  assert.equal(resolve('  eddy   CEDENO ', ''), 1);
  assert.equal(resolve('no email person', undefined), 3);
});

test('no match returns null, never a guess', () => {
  assert.equal(resolve('Unknown Person', 'nobody@example.com'), null);
  assert.equal(resolve(null, null), null);
});

test('buildResolver has no module imports of its own', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/app/lib/mondayResolve.ts', 'utf8');
  assert.ok(!/^\s*import\s/m.test(src),
    'mondayResolve.ts must stay dependency-free so node can load it directly');
});
