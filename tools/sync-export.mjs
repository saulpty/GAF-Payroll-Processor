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
