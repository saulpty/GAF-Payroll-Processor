// Mirror a UI Bakery export zip into this repository.
//
// The mirror is EXACT: files absent from the export are deleted from the
// destination. Without that, files UIB intentionally removed linger locally
// and pollute every future diff.
//
// Usage: node tools/sync-export.mjs "C:\path\to\GAF HR Hub.zip"
//        node tools/sync-export.mjs "C:\path\to\GAF Disciplinary Actions Form.zip" --app form
//
// Two UIB apps are mirrored here. The Hub (default) lands at the repo root;
// the Disciplinary Actions Form (--app form) lands under form-app/.

import { execFileSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, rmSync, readdirSync, readFileSync,
  writeFileSync, copyFileSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, sep } from 'node:path';

const MIRRORED_DIRS = ['src'];
const MIRRORED_FILES = ['version.yml', 'datasources.yml'];

export const FORM_PROJECT_NAME = 'GAF Disciplinary Actions Form';
export const APPS = {
  hub: { destPrefix: '', archiveName: 'GAF-HR-Hub' },
  form: { destPrefix: 'form-app', archiveName: 'GAF-Disciplinary-Form' },
};

/**
 * Refuse to sync a zip into the wrong mirror. Reads projectName from the
 * export's version.yml: --app form must be the Form; the Hub must not be.
 * Without this, a Form zip synced by default would wipe the whole of src/.
 */
export function checkProjectName(root, app) {
  const yml = readFileSync(join(root, 'version.yml'), 'utf8');
  const m = yml.match(/^projectName:\s*(.+?)\s*$/m);
  const name = m ? m[1].replace(/^['"]|['"]$/g, '') : '';
  if (app === 'form' && name !== FORM_PROJECT_NAME) {
    throw new Error(`--app form expects projectName "${FORM_PROJECT_NAME}", but this export is "${name}"`);
  }
  if (app !== 'form' && name === FORM_PROJECT_NAME) {
    throw new Error(`This export is "${name}" - sync it with --app form, not into src/`);
  }
  return name;
}

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

/**
 * Mirror an unpacked export root into destRoot (the repo root for the Hub,
 * form-app/ for the Form). Paths in the result are relative to destRoot.
 */
export function mirrorExport(root, destRoot) {
  const total = { added: [], changed: [], removed: [] };

  for (const d of MIRRORED_DIRS) {
    const r = mirrorDirectory(join(root, d), join(destRoot, d));
    for (const k of ['added', 'changed', 'removed']) {
      total[k].push(...r[k].map((f) => `${d}/${f}`));
    }
  }

  for (const f of MIRRORED_FILES) {
    const from = join(root, f);
    const to = join(destRoot, f);
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

  return total;
}

export function syncExport(zipPath, repoRoot, { app = 'hub' } = {}) {
  if (!Object.hasOwn(APPS, app)) throw new Error(`Unknown --app "${app}" (expected hub or form)`);
  const { destPrefix, archiveName } = APPS[app];
  const destRoot = destPrefix ? join(repoRoot, destPrefix) : repoRoot;
  const work = mkdtempSync(join(tmpdir(), 'uib-export-'));
  try {
    const root = findExportRoot(extractZip(zipPath, work));
    checkProjectName(root, app);
    const total = mirrorExport(root, destRoot);

    // Archive the raw zip so the exact UIB output is recoverable.
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      + `T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const archiveDir = destPrefix ? join(repoRoot, 'exports', destPrefix) : join(repoRoot, 'exports');
    mkdirSync(archiveDir, { recursive: true });
    copyFileSync(zipPath, join(archiveDir, `${stamp}-${archiveName}.zip`));

    return total;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].endsWith('sync-export.mjs')) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--app');
  const app = i === -1 ? 'hub' : args[i + 1];
  const zip = args.filter((_, j) => i === -1 || (j !== i && j !== i + 1))[0];
  if (!zip || !Object.hasOwn(APPS, app)) {
    console.error('Usage: node tools/sync-export.mjs "<path to export zip>" [--app hub|form]');
    process.exit(1);
  }
  const r = syncExport(zip, join(import.meta.dirname, '..'), { app });
  console.log(`added:   ${r.added.length}`);
  console.log(`changed: ${r.changed.length}`);
  console.log(`removed: ${r.removed.length}`);
  for (const f of r.removed) console.log(`  - ${f}`);
}
