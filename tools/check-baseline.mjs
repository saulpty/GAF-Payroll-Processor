// Have the files a set of prepared prompts was written against changed since?
//
//   node tools/check-baseline.mjs <baseline.json>            compare, exit 1 if anything moved
//   node tools/check-baseline.mjs <baseline.json> --write f1 f2 …   (re)record the listed files
//
// baseline.json: { "commit": "<sha the prompts were written against>", "files": { "<path>": "<sha256>" } }
// Paths are relative to the repository root. A missing file is recorded as "absent".
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [, , jsonPath, flag, ...rest] = process.argv;
if (!jsonPath) {
  console.error('usage: node tools/check-baseline.mjs <baseline.json> [--write file …]');
  process.exit(2);
}

// CRLF and LF copies of the same text must hash the same: exports arrive with either.
const hashOf = (p) =>
  existsSync(p)
    ? createHash('sha256').update(readFileSync(p, 'utf8').replace(/\r\n/g, '\n')).digest('hex')
    : 'absent';

if (flag === '--write') {
  const files = Object.fromEntries(rest.sort().map((p) => [p, hashOf(p)]));
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(jsonPath, JSON.stringify({ commit, files }, null, 2) + '\n');
  console.log(`recorded ${rest.length} files at ${commit}`);
  process.exit(0);
}

const { commit, files } = JSON.parse(readFileSync(jsonPath, 'utf8'));
const moved = Object.entries(files).filter(([p, sha]) => hashOf(p) !== sha).map(([p]) => p);
if (moved.length === 0) {
  console.log(`all ${Object.keys(files).length} files unchanged since ${commit}`);
} else {
  console.log(`changed since ${commit} — re-check the prompts that edit these:`);
  for (const p of moved) console.log(`  ${p}`);
  process.exit(1);
}
