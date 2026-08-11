import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeNewlines, listFilesRecursive, findExportRoot, mirrorDirectory, syncFile,
} from '../tools/sync-export.mjs';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'sync-test-'));
}
function write(root, rel, body) {
  const full = join(root, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, body);
}

test('normalizeNewlines converts CRLF to LF', () => {
  assert.equal(normalizeNewlines(Buffer.from('a\r\nb\r\n')).toString(), 'a\nb\n');
});

test('normalizeNewlines leaves LF text untouched', () => {
  assert.equal(normalizeNewlines(Buffer.from('a\nb\n')).toString(), 'a\nb\n');
});

test('normalizeNewlines leaves binary content untouched', () => {
  const bin = Buffer.from([0x00, 0x0d, 0x0a, 0x01]);
  assert.deepEqual(normalizeNewlines(bin), bin);
});

test('listFilesRecursive returns sorted POSIX-relative paths', () => {
  const d = tmp();
  write(d, 'b.txt', 'x');
  write(d, join('a', 'c.txt'), 'y');
  assert.deepEqual(listFilesRecursive(d), ['a/c.txt', 'b.txt']);
  rmSync(d, { recursive: true, force: true });
});

test('findExportRoot locates the directory holding version.yml', () => {
  const d = tmp();
  write(d, join('GAF HR Hub', 'version.yml'), 'projectName: X');
  write(d, join('GAF HR Hub', 'src', 'app.tsx'), 'x');
  assert.equal(findExportRoot(d), join(d, 'GAF HR Hub'));
  rmSync(d, { recursive: true, force: true });
});

test('findExportRoot throws when no version.yml is present', () => {
  const d = tmp();
  write(d, 'nope.txt', 'x');
  assert.throws(() => findExportRoot(d), /version\.yml/);
  rmSync(d, { recursive: true, force: true });
});

test('mirrorDirectory adds, overwrites, and DELETES to match source exactly', () => {
  const src = tmp(), dest = tmp();
  write(src, 'keep.txt', 'new content\n');
  write(src, 'added.txt', 'brand new\n');
  write(dest, 'keep.txt', 'old content\n');
  write(dest, 'stale.txt', 'should be deleted\n');

  const result = mirrorDirectory(src, dest);

  assert.deepEqual(result.added, ['added.txt']);
  assert.deepEqual(result.changed, ['keep.txt']);
  assert.deepEqual(result.removed, ['stale.txt']);
  assert.equal(readFileSync(join(dest, 'keep.txt'), 'utf8'), 'new content\n');
  assert.ok(existsSync(join(dest, 'added.txt')));
  assert.ok(!existsSync(join(dest, 'stale.txt')), 'stale file must be deleted');
  rmSync(src, { recursive: true, force: true });
  rmSync(dest, { recursive: true, force: true });
});

test('mirrorDirectory normalizes CRLF so it reports no spurious change', () => {
  const src = tmp(), dest = tmp();
  write(src, 'f.ts', 'const a = 1;\r\nconst b = 2;\r\n');
  write(dest, 'f.ts', 'const a = 1;\nconst b = 2;\n');

  const result = mirrorDirectory(src, dest);

  assert.deepEqual(result.changed, [], 'CRLF-only difference must not count as a change');
  rmSync(src, { recursive: true, force: true });
  rmSync(dest, { recursive: true, force: true });
});

test('listFilesRecursive sorts entries that the filesystem returns out of order', () => {
  // A directory `a` beside a file `a.txt`: the depth-first walk emits
  // a/b.txt first, but '.' (0x2E) sorts below '/' (0x2F), so correct
  // order puts a.txt first. Without the sort, these differ.
  const d = tmp();
  write(d, join('a', 'b.txt'), 'x');
  write(d, 'a.txt', 'y');
  assert.deepEqual(listFilesRecursive(d), ['a.txt', 'a/b.txt']);
  rmSync(d, { recursive: true, force: true });
});

test('findExportRoot accepts an export that is already at the top level', () => {
  const d = tmp();
  write(d, 'version.yml', 'projectName: X');
  write(d, join('src', 'app.tsx'), 'x');
  assert.equal(findExportRoot(d), d);
  rmSync(d, { recursive: true, force: true });
});

test('findExportRoot refuses an ambiguous export with two candidate roots', () => {
  const d = tmp();
  write(d, join('App One', 'version.yml'), 'projectName: One');
  write(d, join('App Two', 'version.yml'), 'projectName: Two');
  assert.throws(() => findExportRoot(d), /Ambiguous export/);
  rmSync(d, { recursive: true, force: true });
});

test('mirrorDirectory rewrites a CRLF destination to LF without reporting a change', () => {
  const src = tmp(), dest = tmp();
  write(src, 'f.ts', 'const a = 1;\nconst b = 2;\n');
  write(dest, 'f.ts', 'const a = 1;\r\nconst b = 2;\r\n');

  const result = mirrorDirectory(src, dest);

  assert.deepEqual(result.changed, [], 'line endings alone are not a change');
  assert.equal(readFileSync(join(dest, 'f.ts'), 'utf8'), 'const a = 1;\nconst b = 2;\n',
    'destination must be normalized on disk even though nothing was reported');
  rmSync(src, { recursive: true, force: true });
  rmSync(dest, { recursive: true, force: true });
});

test('mirrorDirectory reports a real change even when line endings also differ', () => {
  const src = tmp(), dest = tmp();
  write(src, 'f.ts', 'const a = 99;\n');
  write(dest, 'f.ts', 'const a = 1;\r\n');

  const result = mirrorDirectory(src, dest);

  assert.deepEqual(result.changed, ['f.ts']);
  assert.equal(readFileSync(join(dest, 'f.ts'), 'utf8'), 'const a = 99;\n');
  rmSync(src, { recursive: true, force: true });
  rmSync(dest, { recursive: true, force: true });
});

test('syncFile reports added when the destination does not exist', () => {
  const src = tmp(), dest = tmp();
  write(src, 'f.ts', 'const a = 1;\n');
  assert.equal(syncFile(join(src, 'f.ts'), join(dest, 'nested', 'f.ts')), 'added');
  assert.equal(readFileSync(join(dest, 'nested', 'f.ts'), 'utf8'), 'const a = 1;\n');
  rmSync(src, { recursive: true, force: true });
  rmSync(dest, { recursive: true, force: true });
});

test('syncFile reports changed when content genuinely differs', () => {
  const src = tmp(), dest = tmp();
  write(src, 'f.ts', 'const a = 99;\n');
  write(dest, 'f.ts', 'const a = 1;\n');
  assert.equal(syncFile(join(src, 'f.ts'), join(dest, 'f.ts')), 'changed');
  assert.equal(readFileSync(join(dest, 'f.ts'), 'utf8'), 'const a = 99;\n');
  rmSync(src, { recursive: true, force: true });
  rmSync(dest, { recursive: true, force: true });
});

test('syncFile reports null but still normalizes a CRLF-only difference', () => {
  const src = tmp(), dest = tmp();
  write(src, 'f.ts', 'const a = 1;\n');
  write(dest, 'f.ts', 'const a = 1;\r\n');
  assert.equal(syncFile(join(src, 'f.ts'), join(dest, 'f.ts')), null);
  assert.equal(readFileSync(join(dest, 'f.ts'), 'utf8'), 'const a = 1;\n',
    'must be normalized on disk even though nothing is reported');
  rmSync(src, { recursive: true, force: true });
  rmSync(dest, { recursive: true, force: true });
});

test('syncFile reports null when the files are already identical', () => {
  const src = tmp(), dest = tmp();
  write(src, 'f.ts', 'const a = 1;\n');
  write(dest, 'f.ts', 'const a = 1;\n');
  assert.equal(syncFile(join(src, 'f.ts'), join(dest, 'f.ts')), null);
  rmSync(src, { recursive: true, force: true });
  rmSync(dest, { recursive: true, force: true });
});
