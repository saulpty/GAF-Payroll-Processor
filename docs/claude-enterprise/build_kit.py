#!/usr/bin/env python3
"""Build hr-hub-kit.zip: the folder Saul extracts once (see 01-SETUP.md).

  python3 docs/claude-enterprise/build_kit.py <out.zip>      (run from the repo root)

Also builds hub-harness.zip inside it: everything the tests need besides the two app exports.
Rebuild whenever tests/, tools/ or a knowledge file changes.
"""
import io
import sys
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
KIT = REPO / 'docs' / 'claude-enterprise'
LATEST_HANDOFF = 'docs/HANDOFF-2026-10-20-manager-refresh.md'

# The tests read these besides src/ and form-app/ (found by running them in a bare workspace).
HARNESS = ['tests', 'tools', '.gitattributes', '.gitignore',
           'docs/superpowers/prompts/2026-10-13-mobile-rows/README.md']

KNOWLEDGE = {
    '03-HUB-KIT.md': KIT / '03-HUB-KIT.md',
    'AGENTS.md': REPO / 'src' / 'AGENTS.md',
    'LESSONS.md': REPO / 'docs' / 'LESSONS.md',
    'BACKLOG.md': REPO / 'docs' / 'BACKLOG.md',
    'DESIGN-SYSTEM.md': REPO / 'docs' / 'DESIGN-SYSTEM.md',
    Path(LATEST_HANDOFF).name: REPO / LATEST_HANDOFF,
    'verify_export.py': KIT / 'verify_export.py',
}
KIT_FILES = ['01-SETUP.md', '02-project-instructions.md', '04-CHEATSHEET.md',
             '05-GITHUB-MIGRATION.md', 'verify_export.py']
EMPTY_DIRS = {
    'GOOD': 'Approved exports go here, named "YYYY-MM-DD hub - topic.zip" / "... form - topic.zip".\n'
            'The newest of each is the baseline. Never delete old ones: they are the history.\n',
    'prompts': 'One folder per piece of work: YYYY-MM-DD-topic\\NN-slug.md\n',
}


def harness_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for entry in HARNESS:
            p = REPO / entry
            paths = [p] if p.is_file() else sorted(q for q in p.rglob('*') if q.is_file())
            for q in paths:
                z.write(q, q.relative_to(REPO).as_posix())
    return buf.getvalue()


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else 'hr-hub-kit.zip')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for name in KIT_FILES:
            z.write(KIT / name, f'HR Hub/kit/{name}')
        for name, src in KNOWLEDGE.items():
            z.write(src, f'HR Hub/kit/knowledge/{name}')
        z.writestr('HR Hub/kit/hub-harness.zip', harness_zip())
        z.write(REPO / LATEST_HANDOFF, f'HR Hub/handoffs/{Path(LATEST_HANDOFF).name}')
        for d, text in EMPTY_DIRS.items():
            z.writestr(f'HR Hub/{d}/README.txt', text)
    print(out)


if __name__ == '__main__':
    main()
