import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const body = readFileSync(join(import.meta.dirname, '..', 'src', 'AGENTS.md'), 'utf8');

test('AGENTS.md is not empty', () => {
  assert.ok(body.trim().length > 1000, 'AGENTS.md must have real content');
});

for (const heading of [
  'Schema', 'Timezone', 'Classification', 'File map', 'Hard constraints',
]) {
  test(`AGENTS.md covers "${heading}"`, () => {
    assert.match(body, new RegExp(`^#{1,3}\\s.*${heading}`, 'im'));
  });
}

test('AGENTS.md states the US Eastern timezone invariant', () => {
  assert.match(body, /US Eastern/i);
  assert.match(body, /Panama/i);
});

test('AGENTS.md names the high-blast-radius files', () => {
  for (const f of ['ProcessPayroll', 'PayrollMaster', 'classificationEngine']) {
    assert.match(body, new RegExp(f), `must warn about ${f}`);
  }
});
