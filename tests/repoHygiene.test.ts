import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');

test('.gitattributes exists and normalizes text to LF', () => {
  const p = join(ROOT, '.gitattributes');
  assert.ok(existsSync(p), '.gitattributes must exist');
  const body = readFileSync(p, 'utf8');
  assert.match(body, /^\* text=auto eol=lf$/m, 'must normalize all text files to LF');
});

test('.gitignore excludes the raw export archive directory', () => {
  const p = join(ROOT, '.gitignore');
  assert.ok(existsSync(p), '.gitignore must exist');
  const body = readFileSync(p, 'utf8');
  assert.match(body, /^exports\/$/m, 'raw export zips must not be committed');
});

test('no source file in src/ contains a CR character', () => {
  // git grep exits 1 when there are no matches, which is the passing case,
  // so a non-zero exit must not be treated as an error.
  let out = '';
  try {
    out = execFileSync('git', ['grep', '-Il', '\r', '--', 'src/'], {
      cwd: ROOT, encoding: 'utf8',
    }).trim();
  } catch (err) {
    if (err.status !== 1) throw err; // 1 = no matches; anything else is real
    out = '';
  }
  assert.equal(out, '', `files still contain CR: ${out}`);
});
