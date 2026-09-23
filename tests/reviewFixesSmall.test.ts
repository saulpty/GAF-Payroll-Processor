// 2026-09-23 review fixes 03 and 04 — source guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('RF3: the access-groups auto-sync never runs for a manager', () => {
  const src = read('src/app/components/AccessAutoSync.tsx');
  assert.match(src, /import \{ useViewer \} from '@\/app\/context\/ViewerContext'/);
  assert.match(src, /const \{ isSuper \} = useViewer\(\)/);
  assert.match(src, /useEffect\(\(\) => \{\s*if \(!isSuper\) return;/);
  assert.match(src, /\}, \[isSuper\]\);/);
});

test('RF4: a re-run that writes a day again makes it a live row, not a hidden one', () => {
  const src = read('src/actions/upsertPayrollEntries.ts');
  const set = src.slice(src.indexOf('DO UPDATE SET'));
  assert.match(set, /deleted_at\s*=\s*NULL/);
  assert.match(set, /deleted_by\s*=\s*NULL/);
  assert.doesNotMatch(src, /'\{\{params\./, 'no param inside quotes');
});
