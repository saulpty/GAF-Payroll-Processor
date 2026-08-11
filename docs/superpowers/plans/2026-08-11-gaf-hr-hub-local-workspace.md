# GAF HR Hub Local Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the local repository into a trustworthy mirror of the UI Bakery app, where every UIB change produces a reviewable diff.

**Architecture:** UI Bakery owns the running app and database; the local repository is a read-only mirror of its export. A Node sync tool (`tools/sync-export.mjs`) mirrors an export zip into `src/` — adding, overwriting, **and deleting** — normalizing CRLF to LF so diffs contain only real changes. Each export becomes one commit, making `git diff` the record of what a UIB prompt actually changed.

**Tech Stack:** Node 24 (native TypeScript stripping, `node:test`), git 2.54, Windows `tar` for zip extraction. No new dependencies.

## Global Constraints

- **`src/` is a mirror, never hand-edited.** All application changes go through UI Bakery. Hand-edits are destroyed by the next sync.
- **Mirror semantics are exact:** files absent from the export are deleted from `src/`.
- **Line endings are normalized to LF** on sync. CRLF noise made 142 files appear changed when only 32 were.
- **No database contents leave the machine.** Schema, DDL, counts, and aggregates only; no employee-level rows. Findings recorded with values redacted.
- **The 2026-08-11 export (`Downloads\GAF HR Hub.zip`) is the source of truth.** Where local and export disagree, the export wins.
- **Node test command:** `node --test "tests/*.test.ts"` (the bare `tests/` directory form fails with MODULE_NOT_FOUND — the glob is required).
- **Repo root:** `C:\Users\SaulFallembaum\Documents\GAF-Payroll-Processor`, permanently. The rename to `GAF-HR-Hub` planned for Task 8 was dropped by owner decision on 2026-08-11 — see Task 8. Archive filenames under `exports/` still use the `GAF-HR-Hub` project name, which is correct: that is the UIB project, not the folder.

---

### Task 1: Remote removal and branch consolidation

Measured state: `main` is 0 ahead / 17 behind `fix/discount-and-monday-alias`. `staging` is genuinely divergent (15 unique commits vs 14). Both `claude/*` branches point at root commit `f8f6a24` and hold nothing unique.

`staging` is archived as a tag rather than deleted. The `gaf-hr-hub-local-92331a` worktree is **not** touched here — the active session runs inside it; it is removed in Task 8.

**Files:**
- Modify: git refs and config only, no working-tree files

**Interfaces:**
- Consumes: nothing
- Produces: `main` as the sole working branch at former `fix/discount-and-monday-alias` tip; tag `archive/staging`; no `origin` remote

- [ ] **Step 1: Record the starting state for comparison**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git branch -a && git remote -v && git worktree list
```

Expected: branches `claude/gaf-hr-hub-local-92331a`, `claude/wizardly-curran-2e1f19`, `fix/discount-and-monday-alias` (current), `main`, `staging`; remote `origin` pointing at `github.com/saulpty/GAF-Payroll-Processor.git`; three worktrees.

- [ ] **Step 2: Archive `staging` as a tag before it is deleted**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git tag archive/staging staging
git tag -l "archive/*"
```

Expected: `archive/staging`

- [ ] **Step 3: Verify the archive tag actually preserves the divergent commits**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git rev-list --count archive/staging
git rev-list --left-right --count fix/discount-and-monday-alias...archive/staging
```

Expected: a non-zero commit count, and a **right-hand value of `15`** in the second command's output, confirming staging's 15 unique commits are reachable from the tag.

Only the right-hand number is a safety signal. The left-hand number counts commits unique to `fix/discount-and-monday-alias` and grows every time work is committed there — it was 14 when the spec was written and is 16 after the spec and plan commits. Ignore it.

If the right-hand value is not 15, stop — the tag did not capture the divergent work, and deleting `staging` in Step 6 would lose it permanently.

- [ ] **Step 4: Move `main` to the real history**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git checkout main
git merge --ff-only fix/discount-and-monday-alias
git log --oneline -1
```

Expected: fast-forward succeeds; HEAD is the spec commit `c2fdd3c Design: GAF HR Hub local workspace and UIB change loop`. `--ff-only` is deliberate: if it refuses, `main` had unique commits and the assumption behind this task is wrong — stop and re-measure.

- [ ] **Step 5: Remove the stale worktree and its branch**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git worktree remove .claude/worktrees/wizardly-curran-2e1f19 --force
git branch -D claude/wizardly-curran-2e1f19
git worktree list
```

Expected: two worktrees remain — the repo root and `gaf-hr-hub-local-92331a`.

- [ ] **Step 6: Delete the consolidated branches**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git branch -D fix/discount-and-monday-alias staging
git branch
```

Expected: `claude/gaf-hr-hub-local-92331a` and `* main` only. The `claude/` branch survives because its worktree is still checked out; Task 8 removes it.

- [ ] **Step 7: Confirm the remote is retained** *(revised 2026-08-11 — supersedes "remove the GitHub remote")*

The user's objection was to branch/PR/merge/release ceremony, not to GitHub. Steps 5 and 6 eliminate all of that ceremony. `origin` is retained purely as an off-machine backup: without it, the entire history of a production payroll system exists on a single laptop.

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git remote -v
```

Expected: `origin  https://github.com/saulpty/GAF-Payroll-Processor.git` for both fetch and push. If absent, re-add it:

```bash
git remote add origin https://github.com/saulpty/GAF-Payroll-Processor.git
```

Do not push or fetch in this task. `remotes/origin/*` entries in `git branch -a` are expected and correct.

- [ ] **Step 8: Confirm nothing was lost**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git fsck --no-progress 2>&1 | grep -v "^Checking" || echo "fsck clean"
git log --oneline -1 archive/staging
```

Expected: no missing/broken object errors; `archive/staging` resolves to a real commit.

No commit — this task changes refs only.

---

### Task 2: Line-ending normalization and ignore rules

Without this, every sync diff is 142 files of CRLF noise hiding 32 real changes, and the change loop cannot function.

**Files:**
- Create: `.gitattributes`
- Create: `.gitignore`
- Test: `tests/repoHygiene.test.ts`

**Interfaces:**
- Consumes: `main` branch from Task 1
- Produces: LF-normalized repository; `exports/` and OS cruft ignored

- [ ] **Step 1: Write the failing test**

Create `tests/repoHygiene.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node --test "tests/repoHygiene.test.ts"
```

Expected: FAIL — `.gitattributes must exist`.

- [ ] **Step 3: Create `.gitattributes`**

```
* text=auto eol=lf

*.png binary
*.jpg binary
*.gif binary
*.ico binary
*.zip binary
*.xlsx binary
*.pdf binary
```

- [ ] **Step 4: Create `.gitignore`**

```
exports/
node_modules/
.DS_Store
Thumbs.db
*.log
```

- [ ] **Step 5: Renormalize the existing working tree**

*(Corrected 2026-08-11 after implementation revealed the real mechanism.)*

The CRLF was never in git history. This machine has `core.autocrlf=true` set globally, so every commit already stored LF and git was expanding it to CRLF **at checkout**. That is why an export (LF, straight from the zip) appeared to differ from every local file.

Consequently `git add --renormalize .` stages nothing here — the blobs are already correct. What has to change is the working tree on disk, so that the new `eol=lf` attribute takes effect:

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git add .gitattributes .gitignore
git add --renormalize .
git status --short
```

If that stages only the two new files, force a working-tree refresh. **Check the tree is clean first** — this deletes tracked files before restoring them, and would destroy uncommitted edits:

```bash
git status --short          # must be empty apart from the two new files
git ls-files -z | xargs -0 rm -f
git checkout-index -f -a
git status --short          # still only the two new files; content unchanged
```

`git grep` searches the **working tree**, so the Step 1 test measures exactly the thing this step fixes.

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git add .gitattributes .gitignore
git add --renormalize .
git status --short | head -20
```

Expected: many `M` entries — these are CRLF→LF conversions with no content change.

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node --test "tests/repoHygiene.test.ts"
```

Expected: PASS, 3/3.

- [ ] **Step 7: Confirm the existing suite still passes after renormalization**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node --test "tests/*.test.ts"
```

Expected: `pass 39`, `fail 0` (36 existing + 3 new).

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git add -A
git commit -m "chore: normalize line endings to LF and add ignore rules

CRLF-vs-LF differences made all 142 files in the 2026-08-11 export
appear changed when only 32 had real content changes. Normalizing is a
precondition for the export diff to be reviewable."
```

---

### Task 3: The export sync tool

A Node module so it is unit-testable and shell-independent. Extraction shells out to Windows `tar`, which handles zip natively — verified against the 2026-08-11 export (142 files).

**Files:**
- Create: `tools/sync-export.mjs`
- Test: `tests/syncExport.test.ts`

**Interfaces:**
- Consumes: `.gitattributes` from Task 2
- Produces:
  - `normalizeNewlines(buf: Buffer): Buffer` — CRLF→LF; returns input unchanged if it contains a NUL byte
  - `listFilesRecursive(root: string): string[]` — relative paths, POSIX separators, sorted
  - `findExportRoot(extractDir: string): string` — the directory containing `version.yml`
  - `mirrorDirectory(srcDir: string, destDir: string): {added: string[], changed: string[], removed: string[]}`
  - `syncExport(zipPath: string, repoRoot: string): {added, changed, removed}`

- [ ] **Step 1: Write the failing test**

Create `tests/syncExport.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeNewlines, listFilesRecursive, findExportRoot, mirrorDirectory,
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node --test "tests/syncExport.test.ts"
```

Expected: FAIL — cannot resolve `../tools/sync-export.mjs`.

- [ ] **Step 3: Write the implementation**

Create `tools/sync-export.mjs`:

```js
// Mirror a UI Bakery export zip into this repository.
//
// The mirror is EXACT: files absent from the export are deleted from the
// destination. Without that, files UIB intentionally removed linger locally
// and pollute every future diff.
//
// Usage: node tools/sync-export.mjs "C:\path\to\GAF HR Hub.zip"

import { execFileSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, rmSync, readdirSync, readFileSync,
  writeFileSync, copyFileSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, sep } from 'node:path';

const MIRRORED_DIRS = ['src'];
const MIRRORED_FILES = ['version.yml', 'datasources.yml'];

export function normalizeNewlines(buf) {
  if (buf.includes(0x00)) return buf; // binary — leave alone
  const text = buf.toString('utf8');
  if (!text.includes('\r\n')) return buf;
  return Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8');
}

export function listFilesRecursive(root) {
  const out = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(root, full).split(sep).join('/'));
    }
  }
  if (existsSync(root)) walk(root);
  return out.sort();
}

export function findExportRoot(extractDir) {
  if (existsSync(join(extractDir, 'version.yml'))) return extractDir;
  for (const entry of readdirSync(extractDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(extractDir, entry.name);
    if (existsSync(join(candidate, 'version.yml'))) return candidate;
  }
  throw new Error(`No version.yml found in export at ${extractDir}`);
}

export function extractZip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  execFileSync('tar', ['-xf', zipPath, '-C', destDir], { stdio: 'pipe' });
  return destDir;
}

export function mirrorDirectory(srcDir, destDir) {
  const srcFiles = listFilesRecursive(srcDir);
  const destFiles = listFilesRecursive(destDir);
  const added = [], changed = [], removed = [];

  for (const rel of srcFiles) {
    const srcBody = normalizeNewlines(readFileSync(join(srcDir, rel)));
    const destPath = join(destDir, rel);
    if (!existsSync(destPath)) {
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, srcBody);
      added.push(rel);
    } else if (!normalizeNewlines(readFileSync(destPath)).equals(srcBody)) {
      writeFileSync(destPath, srcBody);
      changed.push(rel);
    }
  }

  for (const rel of destFiles) {
    if (!srcFiles.includes(rel)) {
      rmSync(join(destDir, rel), { force: true });
      removed.push(rel);
    }
  }

  return { added, changed, removed };
}

export function syncExport(zipPath, repoRoot) {
  const work = mkdtempSync(join(tmpdir(), 'uib-export-'));
  try {
    const root = findExportRoot(extractZip(zipPath, work));
    const total = { added: [], changed: [], removed: [] };

    for (const d of MIRRORED_DIRS) {
      const r = mirrorDirectory(join(root, d), join(repoRoot, d));
      for (const k of ['added', 'changed', 'removed']) {
        total[k].push(...r[k].map((f) => `${d}/${f}`));
      }
    }

    for (const f of MIRRORED_FILES) {
      const from = join(root, f);
      if (!existsSync(from)) continue;
      const to = join(repoRoot, f);
      const body = normalizeNewlines(readFileSync(from));
      const isNew = !existsSync(to);
      if (isNew || !normalizeNewlines(readFileSync(to)).equals(body)) {
        writeFileSync(to, body);
        total[isNew ? 'added' : 'changed'].push(f);
      }
    }

    // Archive the raw zip so the exact UIB output is recoverable.
    const stamp = new Date().toISOString().slice(0, 10);
    const archiveDir = join(repoRoot, 'exports');
    mkdirSync(archiveDir, { recursive: true });
    copyFileSync(zipPath, join(archiveDir, `${stamp}-GAF-HR-Hub.zip`));

    return total;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].endsWith('sync-export.mjs')) {
  const zip = process.argv[2];
  if (!zip) {
    console.error('Usage: node tools/sync-export.mjs "<path to export zip>"');
    process.exit(1);
  }
  const r = syncExport(zip, join(import.meta.dirname, '..'));
  console.log(`added:   ${r.added.length}`);
  console.log(`changed: ${r.changed.length}`);
  console.log(`removed: ${r.removed.length}`);
  for (const f of r.removed) console.log(`  - ${f}`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node --test "tests/syncExport.test.ts"
```

Expected: PASS, 8/8. The two critical assertions are that `stale.txt` is deleted and that a CRLF-only difference reports no change.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git add tools/sync-export.mjs tests/syncExport.test.ts
git commit -m "feat: add UIB export sync tool

Mirrors an export zip into src/ with exact semantics — including deleting
files the export no longer contains — and normalizes CRLF to LF so diffs
show only real changes. Archives the raw zip to exports/."
```

---

### Task 4: Sync the 2026-08-11 export as the baseline

The commit that makes local match UIB. Everything after this is measured against it.

**Files:**
- Modify: `src/**` (mirrored from export)
- Modify: `version.yml`
- Create: `datasources.yml`
- Create: `exports/2026-08-11-GAF-HR-Hub.zip` (gitignored)
- Create: `docs/findings/2026-08-11-baseline-sync.md`

**Interfaces:**
- Consumes: `syncExport()` from Task 3
- Produces: `src/` identical to the 2026-08-11 export; a recorded test-result baseline

- [ ] **Step 1: Capture the pre-sync test baseline**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node --test "tests/*.test.ts" 2>&1 | tail -8
```

Expected: `pass 47`, `fail 0` (36 original + 3 hygiene + 8 sync). Record the number — Step 5 compares against it.

- [ ] **Step 2: Run the sync**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node tools/sync-export.mjs "C:/Users/SaulFallembaum/Downloads/GAF HR Hub.zip"
```

Expected, based on the 2026-08-11 review: roughly 13 added, 32 changed, and exactly 2 removed —
`src/app/pages/admin/AdminGraceList.tsx` and `src/app/pages/admin/AdminMacbookSwap.tsx`.
If `removed` lists anything else, stop and investigate before committing.

- [ ] **Step 3: Verify the mirror is exact by re-running the sync**

A second run must be a no-op. If it is not, the tool is non-deterministic.

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node tools/sync-export.mjs "C:/Users/SaulFallembaum/Downloads/GAF HR Hub.zip"
```

Expected: `added: 0`, `changed: 0`, `removed: 0`.

- [ ] **Step 4: Review the diff before trusting it**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git status --short
git diff --stat | tail -5
```

Expected: changes confined to `src/`, `version.yml`, and a new `datasources.yml`. `exports/` must **not** appear — if it does, `.gitignore` from Task 2 is not in effect.

- [ ] **Step 5: Run the tests against the new source and record what breaks**

The tests import from `src/`, which just changed. Failures here are **findings, not blockers** — the export is the source of truth. A failure means either a real regression UIB introduced or a test encoding a now-obsolete assumption.

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node --test "tests/*.test.ts" 2>&1 | tail -30
```

- [ ] **Step 6: Record the findings**

Create `docs/findings/2026-08-11-baseline-sync.md`:

```markdown
# Baseline sync — 2026-08-11 export

Source: `Downloads\GAF HR Hub.zip` (142 files, uiBakeryVersion 3.192.0-rc.0)

## Sync result
- Added: <count> files
- Changed: <count> files
- Removed: <count> files — <list them>

## Test results after sync
- Before: 47 passing
- After: <pass> passing, <fail> failing

### Failures
<For each: test name, file, assertion, and a one-line judgement —
"real regression in UIB" or "test encodes an obsolete assumption".
If there were none, write "None.">

## Notes
- `src/AGENTS.md` is 0 bytes in this export — addressed in Task 7.
- `src/migrations/applied.txt` disagrees with the previous local ledger —
  addressed in Task 6.
```

Fill every `<placeholder>` with real values before committing.

- [ ] **Step 7: Commit the baseline**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git add -A
git commit -m "sync: 2026-08-11 UIB export (GAF HR Hub) as baseline

Mirrors the export exactly. Adds FilterBar, GlobalFilterContext, soft
delete/restore actions, renamePeriod, loadActionRequiredCounts and 9 new
migrations. Removes AdminGraceList and AdminMacbookSwap, which UIB
consolidated away.

This commit is the reference point for all future export diffs."
```

---

### Task 5: Prove the change loop catches out-of-scope edits

The loop's entire value is that step 4 catches collateral damage. That claim must be tested, not assumed.

**Files:**
- Test: `tests/changeLoop.test.ts`
- Create: `docs/CHANGE-LOOP.md`

**Interfaces:**
- Consumes: `mirrorDirectory()` from Task 3; baseline commit from Task 4
- Produces: a regression test proving out-of-scope changes are reported

- [ ] **Step 1: Write the failing test**

Create `tests/changeLoop.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node --test "tests/changeLoop.test.ts"
```

Expected: PASS, 2/2. It passes immediately — `mirrorDirectory` already provides the behavior. The test's job is to lock it in so a future change to the tool cannot silently break the safety net.

- [ ] **Step 3: Document the loop**

Create `docs/CHANGE-LOOP.md`:

```markdown
# The UIB change loop

`src/` is a mirror of the UI Bakery export. It is never hand-edited —
the next sync destroys hand-edits. All application changes go through UIB.

## Per change

1. **Baseline.** `git status` must be clean. If not, sync and commit first.
2. **Design the prompt locally.** Read the real code. Write a prompt that
   names every file that may change, names the functions involved, lists
   what must not be touched, and states acceptance criteria as observable
   outcomes. One coherent change per prompt.
3. **Execute in UIB.**
4. **Export and sync.**
   ```bash
   node tools/sync-export.mjs "C:/Users/SaulFallembaum/Downloads/GAF HR Hub.zip"
   git status --short
   ```
5. **Review.** Every file listed must be one you expected. Anything else is
   collateral damage — send it back to UIB as a correction naming the exact
   files to revert.
6. **Test.** `node --test "tests/*.test.ts"`
7. **Commit,** with a message naming the change that produced it. Or
   `git checkout -- src/` to discard and retry.
8. **Back up.** `git push`

## Why the git here is simple

One branch, `main`. No pull requests, no merges, no releases — those are
collaboration features and there is one person on this project. The only
remote command in this workflow is `git push` in step 8, and its only job
is keeping an off-machine copy so the project does not live on one laptop.

If `git push` is ever refused, it means the remote has commits the local
repository does not — which cannot happen while one person works from one
machine. Stop and investigate rather than forcing it.

## Prompt rules

Derived from observed failure modes:

- Name every file that may be modified; state no other file may be touched.
- Name functions and components, not just the feature.
- State acceptance criteria as observable outcomes.
- For anything touching times or dates, restate the timezone invariant from
  `src/AGENTS.md` explicitly. This codebase has ~10 migrations that are all
  successive fixes to the same timezone bug.
- One coherent change per prompt. Bundled changes produce unreviewable diffs.

## High-blast-radius files

Changes here affect payroll correctness. Review with extra care:

| File | Size |
|---|---|
| `src/app/pages/ProcessPayroll.tsx` | 53 KB |
| `src/app/pages/PayrollMaster.tsx` | 43 KB |
| `src/app/pages/admin/AdminEmployeeSync.tsx` | 36 KB |
| `src/app/lib/classificationEngine.ts` | 35 KB |
| `src/app/pages/ActionRequired.tsx` | 34 KB |
| `src/app/pages/admin/AdminLookups.tsx` | 30 KB |
```

- [ ] **Step 4: Run the full suite**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node --test "tests/*.test.ts" 2>&1 | tail -8
```

Expected: `fail 0`, except any failures already recorded and explained in `docs/findings/2026-08-11-baseline-sync.md`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git add tests/changeLoop.test.ts docs/CHANGE-LOOP.md
git commit -m "test: lock in out-of-scope change detection, document the loop"
```

---

### Task 6: Reconcile migrations and undocumented schema

Requires the user to run SQL in the UIB Database tab and paste results back. Schema and aggregates only — no employee-level rows.

**Files:**
- Create: `docs/findings/2026-08-11-schema-reconciliation.md`
- Create: `docs/sql/schema-audit.sql`

**Interfaces:**
- Consumes: baseline `src/migrations/` from Task 4
- Produces: documented true applied-migration state; an explanation for `pto_approvals`, `pto_employees`, `pto_floating_holidays`

- [ ] **Step 1: Write the query pack**

Create `docs/sql/schema-audit.sql`:

```sql
-- Schema audit for GAF Planilla DB.
-- Schema and aggregates only — returns no employee-level data.
-- Run each query in the UIB Database tab; paste results into
-- docs/findings/2026-08-11-schema-reconciliation.md

-- Q1. The true applied-migration ledger.
SELECT * FROM uib_migrations ORDER BY 1;

-- Q2. Every table and view actually present.
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Q3. Structure of the three undocumented pto_* tables.
SELECT table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name LIKE 'pto\_%'
ORDER BY table_name, ordinal_position;

-- Q4. Are the pto_* tables in use, or empty scaffolding?
SELECT 'pto_approvals' AS table_name, count(*) AS rows FROM pto_approvals
UNION ALL SELECT 'pto_employees', count(*) FROM pto_employees
UNION ALL SELECT 'pto_floating_holidays', count(*) FROM pto_floating_holidays;

-- Q5. Did 1781402000_add_work_days_to_schedules actually apply?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'schedules'
ORDER BY ordinal_position;

-- Q6. Did 1781402100_add_soft_delete_to_payroll_entries actually apply?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payroll_entries'
ORDER BY ordinal_position;

-- Q7. Does hrk_exports exist? (1781401000, absent from the export ledger)
SELECT count(*) AS hrk_exports_row_count FROM hrk_exports;
```

- [ ] **Step 2: Ask the user to run it**

Present `docs/sql/schema-audit.sql` and ask for the results of Q1–Q7. State explicitly that the queries return schema and counts only, no personal data. This step blocks on the user's reply.

- [ ] **Step 3: Build the expected-migration list from the repository**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
ls src/migrations/*.sql | wc -l
cat src/migrations/applied.txt
```

Expected: 32 `.sql` files; `applied.txt` listing 14 entries, jumping from `1781275100` (2026-06-12) to `1781803200` (2026-08-07).

- [ ] **Step 4: Record the reconciliation**

Create `docs/findings/2026-08-11-schema-reconciliation.md`:

```markdown
# Schema and migration reconciliation — 2026-08-11

Source: `docs/sql/schema-audit.sql`, run against GAF Planilla DB.
Schema and aggregates only. No employee-level data recorded here.

## Migration ledger

| Migration file | In export applied.txt | In uib_migrations | Effect present in schema |
|---|---|---|---|
| <one row per .sql file in src/migrations/> | | | |

**Discrepancy count:** <n> files present on disk with no `uib_migrations` row.

**Root cause:** <e.g. project cloned/renamed and the ledger did not carry
over; or migrations genuinely never ran>

**Consequence:** <does UIB risk re-running these? are any effects missing?>

## Undocumented tables

### pto_approvals / pto_employees / pto_floating_holidays
- Columns: <from Q3>
- Row counts: <from Q4>
- Referenced anywhere in `src/`: **no** (verified by grep, 2026-08-11)
- Origin: <abandoned work | manual change | feature under construction>
- Decision: <document only | write a migration to capture them | drop>

## Verified-applied spot checks
- `schedules.work_days` present: <yes/no>  (1781402000)
- `payroll_entries` soft-delete columns present: <yes/no>  (1781402100)
- `hrk_exports` exists: <yes/no>  (1781401000)

## Actions arising
<numbered list, or "None.">
```

Fill every `<placeholder>` with real values.

- [ ] **Step 5: Verify the grep claim in the document**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
grep -rn "pto_approvals\|pto_employees\|pto_floating_holidays" src/ || echo "NO REFERENCES"
```

Expected: matches only inside `src/migrations/1781803200_fix_directory_sync_emails_and_duplicates.sql`, and nothing in `src/actions/` or `src/app/`. If application code does reference them, correct the document.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git add docs/sql/schema-audit.sql docs/findings/2026-08-11-schema-reconciliation.md
git commit -m "docs: reconcile migration ledger and undocumented pto_* tables"
```

---

### Task 7: Author `src/AGENTS.md`

Currently 0 bytes. This is UIB's standing instruction file — the cheapest available improvement to edit quality.

`src/AGENTS.md` lives inside the mirror, so it is the one exception to "never hand-edit `src/`": it is authored locally, then **pasted into UIB**, and the next export round-trips it back. Until that paste happens, UIB has not received it.

**Files:**
- Modify: `src/AGENTS.md`
- Test: `tests/agentsDoc.test.ts`

**Interfaces:**
- Consumes: schema truth from Task 6; file inventory from Task 4
- Produces: a non-empty `AGENTS.md` covering schema, timezone rules, classification, file map, and hard constraints

- [ ] **Step 1: Write the failing test**

Create `tests/agentsDoc.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node --test "tests/agentsDoc.test.ts"
```

Expected: FAIL — `AGENTS.md must have real content`.

- [ ] **Step 3: Gather the facts the document must state**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
cat src/migrations/1781400000_us_eastern_schedules.sql
cat src/migrations/1781400100_history_panama_to_eastern.sql
grep -n "^export function\|^export const\|^function " src/app/lib/classificationEngine.ts | head -40
cat src/app/app.tsx
ls src/actions/ | wc -l
```

The timezone section must be written from the actual migration SQL, not from memory — it is the invariant most often reintroduced as a bug.

- [ ] **Step 4: Write `src/AGENTS.md`**

Replace the empty file with content covering, in this order:

1. **What this app is** — payroll and attendance for GAF Healthcare staff; UIB vibe project; datasources GAF Planilla DB (primary), Monday.com API, Monday.com API v2.
2. **Schema** — every table from Task 6's Q2 result, one line each on purpose and key relationships. Note the `pto_*` tables and their status per Task 6.
3. **Timezone rules** — the US-Eastern-native model; that historical data was Panama-local and was converted by `1781400100`; the `history_tz_converted` flag in `classification_config`; the list of migrations that were successive fixes to this same bug (`1781400000`, `1781400100`, `1781400500`–`700`, `1781401100`–`1400`, `1781401900`); and the invariant, stated as an imperative, that must never be violated.
4. **Classification model** — how `event_types`, `event_type_rules`, `pay_impacts`, and `classification_config` combine to produce a status and a pay impact; where the grace-period logic lives.
5. **File map** — each page under `src/app/pages/` and what it owns; the role of `src/actions/` (one action per file, `@uibakery/data`); `src/app/lib/` helpers.
6. **Hard constraints** — no schema change without a migration; never edit `applied.txt` by hand; the high-blast-radius file list from `docs/CHANGE-LOOP.md`; one coherent change per prompt; restate the timezone invariant before touching any time or date logic.

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node --test "tests/agentsDoc.test.ts"
```

Expected: PASS, 8/8.

- [ ] **Step 6: Transfer it into UI Bakery**

Open `src/AGENTS.md` in UIB and paste the content in. **Until this is done the work has no effect** — the local file is only a mirror.

Then export, sync, and confirm the round-trip:

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
node tools/sync-export.mjs "C:/Users/SaulFallembaum/Downloads/GAF HR Hub.zip"
```

Expected: `changed: 0` for `src/AGENTS.md` — meaning UIB now holds byte-identical content. If it reports the file as changed, the paste was incomplete.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/SaulFallembaum/Documents/GAF-Payroll-Processor"
git add src/AGENTS.md tests/agentsDoc.test.ts
git commit -m "docs: write AGENTS.md — standing instructions for the UIB agent

Was 0 bytes, so every UIB prompt started with no context about the schema,
the timezone model, or the classification engine. Covers schema, timezone
invariants (the source of ~10 successive fix-migrations), the
classification model, a file map, and hard constraints."
```

---

### Task 8: Rename the folder and remove the last worktree — DROPPED

> **Not done, by owner decision on 2026-08-11.** The rename is cosmetic, and
> both steps delete the directory the running session occupies, costing a
> session restart for no functional gain. The folder keeps the name
> `GAF-Payroll-Processor`; only its name differs from the UIB project.
>
> The stale worktree at `.claude/worktrees/gaf-hr-hub-local-92331a` remains.
> It sits at the repository root commit and holds nothing unique. Remove it
> opportunistically from a session that is not inside it:
>
> ```bash
> git worktree remove .claude/worktrees/gaf-hr-hub-local-92331a --force
> git branch -D claude/gaf-hr-hub-local-92331a
> ```
>
> The original step-by-step text is preserved in git history at commit
> 8cb85b2 should the rename ever be revisited.

---

## Completion

At this point Project A is done and Project B can begin against a known-good baseline. Each Project B item — the wrong numbers, the timezone bugs, the UX work, the feature backlog — gets its own design → plan → build cycle, executed through the loop in `docs/CHANGE-LOOP.md`.
