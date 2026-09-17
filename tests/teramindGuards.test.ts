// Teramind saved copy — structural guards (2026-09-17).
// The Teramind API cannot be scoped to a viewer: UIB builds the HTTP request in the browser, and
// the login-session cube cannot even be filtered by agent. So the rules are structural:
// only the admin pull hook talks to Teramind, only linked agents are saved, managers read the
// scoped saved copy, and every timezone conversion lives in one tested file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(join(root, dir))) {
    const rel = `${dir}/${f}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(rel);
  }
  return out;
}

const HTTP_ACTIONS = ['loadTeramindAgentDirectory', 'loadTeramindLoginSessions'];
// Files allowed to import the HTTP actions. Add a file here in the same commit that needs one,
// and only if it runs for super users.
const HTTP_CALLERS = ['src/app/pages/admin/teramind/useTeramindPull.ts'];
const LIBS = ['teramindTypes', 'teramindTime', 'teramindRows', 'teramindPunches', 'teramindPull'];

test('T1: the throwaway probe action is gone', () => {
  assert.equal(existsSync(join(root, 'src/actions/zzProbeTeramind.ts')), false);
  for (const f of readdirSync(join(root, 'src/actions'))) assert.doesNotMatch(f, /^zz/i, `${f} looks like a probe`);
});

test('T2: Teramind HTTP actions name the datasource, take no pass-through url/body, and never quote a param', () => {
  for (const name of HTTP_ACTIONS) {
    const src = read(`src/actions/${name}.ts`);
    assert.match(src, /datasourceName: 'Teramind API'/, `${name}: wrong datasource string`);
    assert.doesNotMatch(src, /\{\{params\.(url|body|method|queryParams)\}\}/, `${name} forwards a raw request`);
    assert.doesNotMatch(src, /['"]\{\{params\.[^}]+\}\}['"]/, `${name} has a quoted {{params}}`);
  }
});

test('T3: only the admin pull hook imports the Teramind HTTP actions', () => {
  for (const file of walk('src/app')) {
    const src = read(file);
    for (const name of HTTP_ACTIONS) {
      if (new RegExp(`actions/${name}['"]`).test(src)) {
        assert.ok(HTTP_CALLERS.includes(file), `${file} imports ${name} — managers must never trigger a Teramind pull`);
      }
    }
  }
});

test('T4: the pull hook drops sessions of unlinked agents and converts time only through sessionClock', () => {
  const p = 'src/app/pages/admin/teramind/useTeramindPull.ts';
  if (!existsSync(join(root, p))) return; // lands with prompt 04
  const src = read(p);
  assert.match(src, /normalizeSession\([^)]*sessionClock\)/, 'sessions must be normalised with sessionClock');
  assert.match(src, /employee_id/, 'the linked-agent filter is missing');
  assert.doesNotMatch(src, /toISOString|Intl\.DateTimeFormat|getTimezoneOffset/, 'time conversion outside teramindTime.ts');
});

test('T5: timezone conversion exists in teramindTime.ts and nowhere else in the Teramind code', () => {
  const files = [...LIBS.filter(l => l !== 'teramindTime').map(l => `src/app/lib/${l}.ts`)];
  if (existsSync(join(root, 'src/app/pages/admin/teramind'))) files.push(...walk('src/app/pages/admin/teramind'));
  for (const f of files) {
    assert.doesNotMatch(read(f), /America\/New_York|Intl\.DateTimeFormat|toISOString/, `${f} converts time itself`);
  }
  assert.match(read('src/app/lib/teramindTime.ts'), /America\/New_York/);
});

test('T6: Teramind libs are pure (import type only) and every new file stays under 15 KB', () => {
  const files = LIBS.map(l => `src/app/lib/${l}.ts`);
  for (const f of files) {
    for (const line of read(f).split('\n').filter(l => /^\s*import\b/.test(l))) {
      assert.match(line, /^\s*import type\b/, `${f} has a runtime import: ${line.trim()}`);
    }
  }
  if (existsSync(join(root, 'src/app/pages/admin/teramind'))) files.push(...walk('src/app/pages/admin/teramind'));
  for (const a of readdirSync(join(root, 'src/actions')).filter(f => /teramind/i.test(f) && f !== 'loadTeramindSessions.ts')) files.push(`src/actions/${a}`);
  for (const f of files) assert.ok(statSync(join(root, f)).size < 15 * 1024, `${f} is over 15 KB`);
});

test('T7: no Teramind host name is hardcoded', () => {
  const files = [...walk('src/app'), ...walk('src/actions')];
  for (const f of files) assert.doesNotMatch(read(f), /teramind\.co\b/, `${f} hardcodes the Teramind host`);
});

test('T8: the saved-sessions upsert keeps its natural key and never deletes', () => {
  const src = read('src/actions/upsertTeramindSessions.ts');
  assert.match(src, /ON CONFLICT \(agent_id, started_raw, computer\)/);
  for (const a of readdirSync(join(root, 'src/actions')).filter(f => /teramind/i.test(f))) {
    assert.doesNotMatch(read(`src/actions/${a}`), /\bDELETE\s+FROM\b/i, `${a} deletes rows`);
  }
});
