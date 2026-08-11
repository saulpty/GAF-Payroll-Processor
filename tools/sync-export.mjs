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

/**
 * Copy one file into place with line endings normalized.
 *
 * Returns 'added' when the destination did not exist, 'changed' when its
 * content genuinely differs, or null when nothing worth reporting changed.
 * A file whose only difference is CRLF-vs-LF is rewritten on disk but
 * reported as null — suppressing that noise is the point of this tool.
 */
export function syncFile(srcPath, destPath) {
  const srcBody = normalizeNewlines(readFileSync(srcPath));
  if (!existsSync(destPath)) {
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, srcBody);
    return 'added';
  }
  const destRaw = readFileSync(destPath);
  if (!normalizeNewlines(destRaw).equals(srcBody)) {
    writeFileSync(destPath, srcBody);
    return 'changed';
  }
  if (!destRaw.equals(srcBody)) writeFileSync(destPath, srcBody);
  return null;
}

export function findExportRoot(extractDir) {
  if (existsSync(join(extractDir, 'version.yml'))) return extractDir;
  const candidates = readdirSync(extractDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(extractDir, e.name, 'version.yml')))
    .map((e) => join(extractDir, e.name));
  if (candidates.length > 1) {
    throw new Error(
      `Ambiguous export: ${candidates.length} directories contain version.yml in ${extractDir}`,
    );
  }
  if (candidates.length === 1) return candidates[0];
  throw new Error(`No version.yml found in export at ${extractDir}`);
}

export function extractZip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  try {
    execFileSync('tar', ['-xf', zipPath, '-C', destDir], { stdio: 'pipe' });
  } catch (err) {
    const detail = err.stderr ? err.stderr.toString().trim() : err.message;
    throw new Error(`Failed to extract ${zipPath}: ${detail}`);
  }
  return destDir;
}

export function mirrorDirectory(srcDir, destDir) {
  const srcFiles = listFilesRecursive(srcDir);
  const destFiles = listFilesRecursive(destDir);
  const added = [], changed = [], removed = [];

  for (const rel of srcFiles) {
    const outcome = syncFile(join(srcDir, rel), join(destDir, rel));
    if (outcome === 'added') added.push(rel);
    else if (outcome === 'changed') changed.push(rel);
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
      const to = join(repoRoot, f);
      if (!existsSync(from)) {
        if (existsSync(to)) {
          rmSync(to, { force: true });
          total.removed.push(f);
        }
        continue;
      }
      const outcome = syncFile(from, to);
      if (outcome) total[outcome].push(f);
    }

    // Archive the raw zip so the exact UIB output is recoverable.
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      + `T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
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
