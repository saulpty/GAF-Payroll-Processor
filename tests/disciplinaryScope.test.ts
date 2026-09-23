// Disciplinary cases are fetched only for the viewer's own people.
// Prompt: docs/superpowers/prompts/2026-09-23-review-fixes/09-disciplinary-only-your-people.md
//
// disciplinary_actions lives in a second database that cannot join
// v_employee_access, so the page sends the list of names the viewer may see and
// SQL filters on it. Before this, every manager's browser downloaded every case
// in the company (full narratives) and React hid the rest afterwards.
//
// The SQL filter must never drop a case the page's JS name-matching
// (buildResolver + normalizeName) would show, so DS5/DS6 check that the SQL
// normalisation agrees with normalizeName character by character.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeName } from '../src/app/lib/classificationEngine.ts';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const TABLE = 'src/app/pages/disciplinary/DisciplinaryTable.tsx';
const ACTION = 'src/actions/loadDisciplinaryActions.ts';

/** The full `useLoadAction(loadDisciplinaryActionsAction, ...)` call, up to its closing `);`. */
function disciplinaryCall(src: string): string {
  const start = src.indexOf('useLoadAction(\n    loadDisciplinaryActionsAction');
  const alt = start >= 0 ? start : src.search(/useLoadAction\(\s*loadDisciplinaryActionsAction/);
  assert.ok(alt >= 0, 'DisciplinaryTable no longer calls useLoadAction(loadDisciplinaryActionsAction, ...)');
  const end = src.indexOf(');', alt);
  return src.slice(alt, end + 2);
}

test('DS1: DisciplinaryTable no longer asks for every case with manager: null, employeeName: null and no names filter', () => {
  const call = disciplinaryCall(read(TABLE));
  assert.doesNotMatch(call, /\{\s*manager:\s*null,\s*employeeName:\s*null,\s*includeDeleted:\s*isSuper\s*\}/,
    'the unfiltered param object is still passed');
  assert.match(call, /\bnames:\s*\w+/, 'no names filter is passed to loadDisciplinaryActions');
  assert.match(call, /\ballNames:\s*allEmployees\b/,
    'allNames must follow allEmployees (supers and "all employees" managers), the same rule as the JS visibleIds filter');
  assert.doesNotMatch(call, /\bparams:\s*\{/, 'params must go flat, never inside a params: {} wrapper');
});

test('DS2: the disciplinary load waits until the names are known (enabled flag), so a manager never fires an unfiltered request', () => {
  const call = disciplinaryCall(read(TABLE));
  assert.match(call, /\{\s*enabled:\s*\w+\s*\}\s*,?\s*\);$/, 'loadDisciplinaryActions has no { enabled: ... } option');
});

test('DS3: the names list is built from display names AND aliases of visible employees, normalised with normalizeName', () => {
  const src = read(TABLE);
  assert.match(src, /normalizeName\(\s*\w+\.display_name\s*\)/, 'display names are not normalised into the names list');
  assert.match(src, /normalizeName\(\s*\w+\.alias_text\s*\)/, 'aliases are not in the names list: cases filed under an alias would vanish');
  assert.match(src, /JSON\.stringify\(/, 'the names list must be sent as a JSON string');
  assert.match(src, /visibleIds\.has\(String\(\w+\.employee_id\)\)/, 'aliases must be limited to visible employees');
});

test('DS4: the action filters on {{params.names}} through jsonb_array_elements_text, never inside quotes', () => {
  const src = read(ACTION);
  assert.match(src, /jsonb_array_elements_text\([^)]*\{\{params\.names\}\}::jsonb/,
    'SQL does not expand {{params.names}} with jsonb_array_elements_text');
  assert.match(src, /COALESCE\(\{\{params\.allNames\}\}::boolean,\s*false\)/, 'SQL has no allNames bypass for supers');
  assert.doesNotMatch(src, /'[^'\n]*\{\{params\.[^}]+\}\}[^'\n]*'/, 'a {{params.x}} sits inside a quoted string');
  assert.doesNotMatch(src, /pdf_(en|es)_base64/, 'never select the PDF columns');
});

// ── The SQL normalisation must match normalizeName ────────────────────────────

function translateArgs(src: string): { from: string; to: string } {
  const m = src.match(/translate\(\s*employee_name\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/);
  assert.ok(m, 'SQL does not strip accents with translate(employee_name, \'...\', \'...\')');
  return { from: m![1], to: m![2] };
}

/** What the SQL does to employee_name: translate -> lower -> collapse whitespace -> btrim. */
function sqlNormalize(s: string, from: string, to: string): string {
  const f = [...from];
  const t = [...to];
  const translated = [...s].map(ch => { const i = f.indexOf(ch); return i >= 0 ? t[i] : ch; }).join('');
  return translated.toLowerCase().replace(/[ \t\n\r\f\v]+/g, ' ').replace(/^ +| +$/g, '');
}

test('DS5: translate() maps every accented letter to what normalizeName makes of it, and covers Spanish', () => {
  const src = read(ACTION);
  const { from, to } = translateArgs(src);
  assert.equal([...from].length, [...to].length, 'translate() from/to strings differ in length');
  [...from].forEach((ch, i) => {
    assert.equal(normalizeName([...to][i]), normalizeName(ch), `translate maps ${ch} -> ${[...to][i]}, normalizeName gives ${normalizeName(ch)}`);
  });
  for (const ch of 'áéíóúüñÁÉÍÓÚÜÑ') assert.ok(from.includes(ch), `translate() does not cover ${ch}`);
  assert.match(src, /lower\(\s*translate\(/, 'lower() must wrap translate(): lower() of an accented capital depends on the DB locale');
  assert.match(src, /regexp_replace\([\s\S]*'\[\[:space:\]\]\+'\s*,\s*' '\s*,\s*'g'\)/,
    "whitespace must collapse with regexp_replace(..., '[[:space:]]+', ' ', 'g')");
  assert.match(src, /btrim\(\s*regexp_replace\(/, 'the collapsed name must be trimmed with btrim()');
  // In a JS template literal "\s" silently becomes "s" — the regex would then match the letter s.
  assert.doesNotMatch(src, /(^|[^\\])\\s/, 'a single-backslash \\s in the action becomes the letter "s" at runtime');
});

test('DS6: for real-looking names the SQL normalisation equals normalizeName (no case is dropped by the SQL filter)', () => {
  const { from, to } = translateArgs(read(ACTION));
  for (const name of [
    'Juan Molina', '  Juan   Molina ', 'JUAN MOLINA', 'José Núñez', 'JOSÉ NÚÑEZ', 'María  Fernanda Pérez',
    'Güido Ibáñez', 'Ángel Muñoz', 'Aleka Papatsoris', 'Navvad Owusu', 'Arelis\tAcosta',
  ]) {
    assert.equal(sqlNormalize(name, from, to), normalizeName(name), `SQL and normalizeName disagree on "${name}"`);
  }
});

test('DS7: both files stay under 15 KB', () => {
  for (const f of [TABLE, ACTION]) {
    const size = statSync(join(root, f)).size;
    assert.ok(size < 15 * 1024, `${f} is ${size} bytes`);
  }
});
