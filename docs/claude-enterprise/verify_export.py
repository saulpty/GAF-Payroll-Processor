#!/usr/bin/env python3
"""Check a UI Bakery export against the last good one. Run by Claude in the chat sandbox.

This replaces steps 5-7 of the old change loop (sync-export, git status, node --test)
now that there is no git checkout. Same check every time, no improvising.

  python3 verify_export.py --harness hub-harness.zip --new "GAF Panama HR Hub (9).zip" \
      --base GOOD/2026-10-20-hub.zip [--other GOOD/2026-10-20-form.zip] \
      [--allow src/app/pages/PtoTracker.tsx --allow "src/actions/loadPto*.ts"] [--out report-dir]

  --new      the export UIB just produced (Hub or Disciplinary Form)
  --base     the last approved export of the SAME app (the GOOD folder)
  --other    the other app's export. The tests read both apps, so pass it for a full run
  --harness  hub-harness.zip: tests/, tools/ and the one doc the tests read
  --allow    a path (or glob) the prompt allowed to change, relative to the app root.
             Repeat it. Without it, the collateral check is skipped.

Exit 0 = PASS, 1 = FAIL, 2 = could not run.
"""
import argparse
import fnmatch
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

HUB = 'GAF Panama HR Hub'
FORM = 'GAF Disciplinary Actions Form'
SIZE_CAP = 15 * 1024
# CLAUDE.md "Payroll is untouchable" - matched by file name so a move doesn't hide one.
PROTECTED_NAMES = {'ProcessPayroll.tsx', 'PayrollMaster.tsx', 'ActionRequired.tsx',
                   'classificationEngine.ts', 'AdminLookups.tsx', 'teramindParser.ts'}
PROTECTED_DIRS = ('src/components/ui/',)
# Generated or data files: a size over 15 KB there is expected.
SIZE_EXEMPT = ('src/migrations/', 'src/components/ui/', 'src/app/assets/')
SIZE_EXEMPT_NAMES = {'package-lock.json', 'bun.lock', 'AGENTS.md'}


def die(msg):
    print(f'CANNOT RUN: {msg}')
    sys.exit(2)


def extract(zip_path, dest):
    """Unzip and return the folder that holds version.yml (the app root)."""
    if not Path(zip_path).is_file():
        die(f'file not found: {zip_path}')
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(dest)  # ZipFile.extract strips absolute paths and '..'
    roots = [p.parent for p in Path(dest).rglob('version.yml') if 'node_modules' not in p.parts]
    roots = [r for r in roots if (r / 'src').is_dir()] or roots
    if not roots:
        return Path(dest)  # the harness has no version.yml
    return min(roots, key=lambda r: len(r.parts))


def project(root):
    yml = (root / 'version.yml').read_text(encoding='utf-8', errors='replace')
    get = lambda k: (re.search(rf'^{k}:\s*(.+?)\s*$', yml, re.M) or [None, '?'])[1]
    return get('projectName').strip('\'"'), get('projectId').strip('\'"')


def files(root):
    """{relative path: sha256}, with CRLF folded to LF (exports arrive with either)."""
    out = {}
    for p in root.rglob('*'):
        if p.is_file():
            out[p.relative_to(root).as_posix()] = hashlib.sha256(
                p.read_bytes().replace(b'\r\n', b'\n')).hexdigest()
    return out


def protected(path):
    return Path(path).name in PROTECTED_NAMES or path.startswith(PROTECTED_DIRS)


def over_cap(root, path):
    if path.startswith(SIZE_EXEMPT) or Path(path).name in SIZE_EXEMPT_NAMES:
        return None
    if not path.startswith('src/') or not path.endswith(('.ts', '.tsx')):
        return None
    size = (root / path).stat().st_size
    return size if size >= SIZE_CAP else None


def build_workspace(ws, harness, hub_root, form_root):
    shutil.copytree(harness, ws, dirs_exist_ok=True)
    for name in ('src', 'version.yml', 'datasources.yml'):
        src = hub_root / name
        if src.is_dir():
            shutil.copytree(src, ws / name)
        elif src.is_file():
            shutil.copy2(src, ws / name)
    if form_root:
        shutil.copytree(form_root, ws / 'form-app')
    # Same as tools/sync-export.mjs: text files land with LF endings.
    for p in ws.rglob('*'):
        if p.is_file() and 'tests' not in p.relative_to(ws).parts[:1]:
            data = p.read_bytes()
            if b'\r\n' in data and b'\0' not in data:
                p.write_bytes(data.replace(b'\r\n', b'\n'))
    # repoHygiene.test.ts runs `git grep`, so the workspace has to be a repo.
    if shutil.which('git'):
        git = lambda *args: subprocess.run(['git', *args], cwd=ws, capture_output=True)
        git('init', '-q')
        git('add', '-A')


def run_tests(ws):
    if not (ws / 'tests').is_dir():
        die('the harness has no tests/ folder')
    r = subprocess.run(['node', '--test', '--test-reporter=tap', 'tests/*.test.ts'],
                       cwd=ws, capture_output=True, text=True, timeout=900)
    out = r.stdout
    count = lambda k: int((re.search(rf'^# {k} (\d+)$', out, re.M) or [0, 0])[1])
    fails, lines = {}, out.splitlines()
    for i, line in enumerate(lines):
        m = re.match(r'^not ok \d+ - (.*)$', line)
        if m:
            body = [l.strip() for l in lines[i + 1:i + 40] if l.strip() and l.strip() not in ('---', '...')]
            err = [l for l in body if not l.startswith(('duration_ms', 'type:', 'location:', 'failureType'))]
            fails[m.group(1)] = ' | '.join(err[:6])[:400]
    if count('tests') == 0:
        tail = (r.stderr or out)[-1500:]
        die(f'node --test ran no tests. Output tail:\n{tail}')
    return {'tests': count('tests'), 'pass': count('pass'), 'fail': count('fail'), 'fails': fails}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--new', required=True)
    ap.add_argument('--base')
    ap.add_argument('--other')
    ap.add_argument('--harness', required=True)
    ap.add_argument('--allow', action='append', default=[])
    ap.add_argument('--out', default='.')
    a = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix='verify-'))
    new = extract(a.new, tmp / 'new')
    base = extract(a.base, tmp / 'base') if a.base else None
    other = extract(a.other, tmp / 'other') if a.other else None
    harness = extract(a.harness, tmp / 'harness')
    # A harness zipped as a folder ("hub-harness/tests/...") has its content one level down.
    if not (harness / 'tests').is_dir():
        inner = [d for d in harness.iterdir() if (d / 'tests').is_dir()]
        harness = inner[0] if inner else harness

    name, pid = project(new)
    if name not in (HUB, FORM):
        die(f'--new is "{name}", expected "{HUB}" or "{FORM}"')
    red, notes = [], []
    rows = []
    same = False

    # 1. Same app
    if base:
        bname, bpid = project(base)
        # Older exports carry no projectId; fall back to the name.
        same = bpid == pid if '?' not in (bpid, pid) else bname == name
        rows.append(('Same app as baseline', 'PASS' if same else 'FAIL',
                     f'{name} ({pid})' if same else f'new is {name} ({pid}), base is {bname} ({bpid})'))
        if not same:
            red.append('the baseline is a different app, so the diff means nothing')
    else:
        rows.append(('Same app as baseline', 'SKIPPED', 'no --base given'))

    # 2. What changed. Steps 2-5 need a baseline of the same app.
    has_base = bool(base) and same
    added = changed = removed = []
    if has_base:
        fb, fn = files(base), files(new)
        added = sorted(set(fn) - set(fb))
        removed = sorted(set(fb) - set(fn))
        changed = sorted(p for p in set(fn) & set(fb) if fn[p] != fb[p])
        rows.append(('Files changed', 'INFO',
                     f'{len(added)} added, {len(changed)} changed, {len(removed)} removed'))

    touched = added + changed + removed
    # 3. Collateral
    if has_base and a.allow:
        allowed = lambda p: any(fnmatch.fnmatch(p, g) for g in a.allow)
        collateral = [p for p in touched if not allowed(p)]
        rows.append(('Only allowed files touched', 'FAIL' if collateral else 'PASS',
                     f'{len(collateral)} outside the prompt: ' + ', '.join(collateral[:8]) if collateral
                     else f'all {len(touched)} inside the allowed list'))
        if collateral:
            red.append(f'{len(collateral)} file(s) changed that the prompt did not allow')
    elif has_base:
        rows.append(('Only allowed files touched', 'SKIPPED', 'no --allow given'))

    # 4. Payroll files
    hit = [p for p in touched if protected(p)]
    if hit:
        unapproved = [p for p in hit if not any(fnmatch.fnmatch(p, g) for g in a.allow)]
        rows.append(('Payroll / ui files untouched', 'FAIL' if unapproved else 'WARN', ', '.join(hit)))
        if unapproved:
            red.append('a protected payroll or ui file changed without being allowed')
        else:
            notes.append('a protected file changed. It was allowed, but it needs Saul\'s explicit OK')
    elif has_base:
        rows.append(('Payroll / ui files untouched', 'PASS', 'none touched'))

    # 5. 15 KB cap, only for files this change touched
    if has_base:
        big = []
        for p in added + changed:
            size = over_cap(new, p)
            if size:
                before = over_cap(base, p) if (base / p).exists() else None
                big.append(f'{p} {size:,} B' + (' (already over before)' if before else ''))
        newly = [b for b in big if 'already over' not in b]
        rows.append(('Touched files under 15 KB', 'FAIL' if newly else ('WARN' if big else 'PASS'),
                     '; '.join(big) or 'all under the cap'))
        if newly:
            red.append('a file this change touched is now over 15 KB, so split it')

    # 6. Tests: new export, and the baseline for comparison
    if name == FORM and not other:
        die('--new is the Form app; pass the Hub export as --other so the tests have a src/ to read')
    hub_new, form_new = (new, other) if name == HUB else (other, new)
    build_workspace(tmp / 'ws-new', harness, hub_new, form_new)
    t_new = run_tests(tmp / 'ws-new')
    t_base = None
    if has_base:
        hub_b, form_b = (base, other) if name == HUB else (other, base)
        build_workspace(tmp / 'ws-base', harness, hub_b, form_b)
        t_base = run_tests(tmp / 'ws-base')
    old_fails = set(t_base['fails']) if t_base else set()
    # Without a baseline there is nothing to call "new": list the failures, don't judge them.
    new_fails = [f for f in t_new['fails'] if f not in old_fails] if t_base else []
    fixed = sorted(old_fails - set(t_new['fails']))
    status = 'FAIL' if new_fails else ('PASS' if t_base or not t_new['fails'] else 'WARN')
    rows.append(('Tests', status,
                 f"{t_new['pass']}/{t_new['tests']} pass" +
                 (f"; baseline {t_base['pass']}/{t_base['tests']}" if t_base else '') +
                 (f'; {len(new_fails)} NEW failure(s)' if new_fails else '') +
                 (f'; {len(fixed)} fixed' if fixed else '') +
                 ('; no baseline to compare' if not t_base and t_new['fails'] else '')))
    if new_fails:
        red.append(f'{len(new_fails)} test(s) fail now that passed on the baseline')
    if not other:
        notes.append('no --other export: tests that read the other app may fail for that reason alone')

    verdict = 'FAIL' if red else 'PASS'
    md = [f'# Export check: {verdict}', '', f'App: **{name}** (`{pid}`)  ', f'New: `{Path(a.new).name}`  ',
          f'Base: `{Path(a.base).name}`' if a.base else 'Base: none', '',
          '| Check | Result | Detail |', '|---|---|---|']
    md += [f'| {c} | {r} | {d} |' for c, r, d in rows]
    if red:
        md += ['', '## Why it failed'] + [f'- {x}' for x in red]
    if notes:
        md += ['', '## Notes'] + [f'- {x}' for x in notes]
    if has_base and touched:
        md += ['', '## Files']
        md += [f'- added `{p}`' for p in added] + [f'- changed `{p}`' for p in changed] + \
              [f'- removed `{p}`' for p in removed]
    if new_fails:
        md += ['', '## New test failures'] + [f'- **{f}**: {t_new["fails"][f]}' for f in new_fails]
    still = [f for f in t_new['fails'] if f in old_fails]
    if still:
        md += ['', '## Already failing on the baseline (known reds)'] + [f'- {f}' for f in still]
    if fixed:
        md += ['', '## Fixed by this change'] + [f'- {f}' for f in fixed]
    if not t_base and t_new['fails']:
        md += ['', '## Failing tests (no baseline to compare)'] + \
              [f'- **{f}**: {e}' for f, e in t_new['fails'].items()]
    report = '\n'.join(md) + '\n'
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'verify-report.md').write_text(report, encoding='utf-8')
    print(report)
    shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(1 if red else 0)


if __name__ == '__main__':
    main()
