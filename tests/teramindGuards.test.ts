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

const HTTP_ACTIONS = ['loadTeramindAgentDirectory', 'loadTeramindLoginSessions', 'loadTeramindTimeRecords']
  .filter(n => existsSync(join(root, `src/actions/${n}.ts`)));
// Files allowed to import the HTTP actions. Add a file here in the same commit that needs one,
// and only if it runs for super users.
const HTTP_CALLERS = ['src/app/pages/admin/teramind/useTeramindPull.ts'];
const LIBS = ['teramindTypes', 'teramindTime', 'teramindRows', 'teramindPunches', 'teramindPull', 'teramindCompare'];

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
  assert.match(src, /normalize(Session|TimeRecord)\([^)]*sessionClock\)/, 'rows must be normalised with sessionClock');
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
  // Teramind can return one session twice in a response; without this the whole batch fails with
  // Postgres 21000 "cannot affect row a second time" (seen on /dev 2026-09-17, Q1-Aug backfill).
  assert.match(src, /SELECT DISTINCT ON \(\(r->>'agent_id'\)::bigint, r->>'started_raw'/, 'batch is not de-duplicated');
  for (const a of readdirSync(join(root, 'src/actions')).filter(f => /teramind/i.test(f))) {
    assert.doesNotMatch(read(`src/actions/${a}`), /\bDELETE\s+FROM\b/i, `${a} deletes rows`);
  }
});

// ── Process Payroll capture path (prompt 09b) ────────────────────────────────────────────────
// Found by the pre-flight review on 2026-09-17: while the warnings / name-mapping screen is open
// the page is not "running", so step 2 stays clickable. Clearing the capture there and pressing
// Proceed Anyway would run the engine on zero punches = a whole period of absences.
test('T9: Process Payroll can never run the engine on empty or stale Teramind punches', () => {
  const src = read('src/app/pages/ProcessPayroll.tsx');
  if (!/TeramindSourceCard/.test(src)) return; // lands with prompt 09b
  const guard = /if \(teramindRows\.length === 0\) \{ setError\('The Teramind punches were cleared/g;
  assert.equal((src.match(guard) ?? []).length, 2, 'handleMappingSave and Proceed Anyway must both refuse empty punches');
  assert.match(src, /!hasPunches \|\| teramindRows\.length === 0/, 'handleRun must refuse empty punches');
  assert.match(src, /hasPunches && teramindRows\.length > 0 &&/, 'formReady must require actual rows');
  assert.match(src, /disabled=\{isRunning \|\| status === 'mapping' \|\| status === 'warnings' \|\| !!teramindFile\}/,
    'the capture card must be locked while the mapping / warnings screen is open');
  assert.match(src, /if \(file\) \{ setApiCapture\(null\); setTeramindRows\(\[\]\); \}/,
    'choosing a file must drop the captured rows immediately');
});

test('T10: payroll is always captured as the real signed-in super user, never through View As', () => {
  const p = 'src/app/pages/process/TeramindSourceCard.tsx';
  if (!existsSync(join(root, p))) return; // lands with prompt 09a
  const src = read(p);
  assert.match(src, /viewAs:\s*''/, 'the capture must pass an empty viewAs');
  assert.match(src, /isSuper/, 'the capture card must check isSuper');
  assert.doesNotMatch(src, /actions\/loadTeramind(TimeRecords|LoginSessions|AgentDirectory)['"]/, 'the card must go through useTeramindPull, not call Teramind itself');
  assert.doesNotMatch(src, /upsertPayrollEntries|updatePayrollEntry|updatePunchTimes/, 'the card never writes payroll');
});

test('T11: punches handed to payroll are cut to the whole minute, like the export file always was', () => {
  const src = read('src/app/lib/teramindPunches.ts');
  if (!/punchDaysToRawRows/.test(src)) return; // lands with prompt 09a
  assert.match(src, /:00`/, 'seconds must be fixed at :00');
  assert.doesNotMatch(src, /Math\.round/, 'never round a punch — cut it');
});

test('T12: the keep-fresh sync only ever runs for a super user, in a visible tab, one at a time', () => {
  const p = 'src/app/components/TeramindAutoSync.tsx';
  if (!existsSync(join(root, p))) return; // lands with prompt 11
  const src = read(p);
  assert.match(src, /if \(!isSuper\) return;/, 'managers must never trigger a Teramind pull');
  assert.match(src, /document\.hidden/, 'a background tab must not keep pulling');
  assert.match(src, /let inFlight = false;/, 'overlapping pulls must be impossible');
  assert.match(src, /pullRange\([^)]*'auto'\)/, 'automatic pulls must be labelled auto in the log');
  assert.doesNotMatch(src, /actions\/loadTeramind(TimeRecords|LoginSessions|AgentDirectory)['"]/, 'must go through useTeramindPull');
});
