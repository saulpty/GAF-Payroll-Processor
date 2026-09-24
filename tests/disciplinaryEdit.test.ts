// Disciplinary edit, PDF download and the admin gate (2026-09-24).
// Plan: Tim and Saul (the rows in disciplinary_admins, on the SAUL Disciplinary
// Action Forms DB) may edit, delete and restore a warning. The database enforces
// it: every change-data action carries an EXISTS check against that table with the
// signed-in email, so a super user who is not an admin changes 0 rows.
// Structural guards in the lessonGuards style: they read the source, not the database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const DS = /datasourceName:\s*'SAUL Disciplinary Action Forms DB'/;
const USER = String.raw`\{\{\s*user\.email\s*\}\}(?:::text)?`;
const ADMIN_EXISTS = new RegExp(
  String.raw`EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+(?:public\.)?disciplinary_admins[\s\S]*?lower\(\s*btrim\(\s*${USER}\s*\)\s*\)`, 'i');
const PARAM_IN_QUOTES = /'[^'\n]*\{\{[^}]+\}\}[^'\n]*'/;

test('DE1: updateDisciplinaryAction is admin-only in SQL, keeps the original PDF, and records who edited', () => {
  const src = read('src/actions/updateDisciplinaryAction.ts');
  assert.match(src, DS, 'must run on the disciplinary database');
  assert.match(src, ADMIN_EXISTS, 'no EXISTS (SELECT 1 FROM disciplinary_admins ... lower(btrim({{ user.email }}))) check');
  assert.match(src, /pdf_en_original_base64\s*=\s*COALESCE\(\s*pdf_en_original_base64\s*,\s*pdf_en_base64\s*\)/,
    'the first edit must copy the original PDF aside, and later edits must never overwrite it');
  assert.match(src, new RegExp(String.raw`edited_by\s*=\s*lower\(\s*btrim\(\s*${USER}\s*\)\s*\)`),
    'edited_by must come from the login, not a browser param');
  assert.match(src, /edited_at\s*=\s*NOW\(\)/i);
  assert.match(src, /deleted_at IS NULL/, 'a deleted warning must not be editable');
});

test('DE2: updateDisciplinaryAction never changes who the warning is about, who filed it, or its ref', () => {
  const src = read('src/actions/updateDisciplinaryAction.ts');
  const m = src.match(/\bSET\b([\s\S]*?)\bWHERE\b/i);
  assert.ok(m, 'no SET ... WHERE in the update');
  assert.doesNotMatch(m![1], /\b(employee_name|manager_name|manager_email|ref)\s*=/,
    'employee, manager and ref are not editable: delete and re-file instead');
});

test('DE3: the update takes evidence through jsonb and never puts a {{ }} inside quotes', () => {
  const src = read('src/actions/updateDisciplinaryAction.ts');
  assert.match(src, /jsonb_array_elements_text\(\s*\{\{params\.\w+\}\}::jsonb\s*\)/,
    'evidence_types must be expanded with jsonb_array_elements_text({{params.x}}::jsonb)');
  assert.doesNotMatch(src, PARAM_IN_QUOTES, 'a {{ }} sits inside a quoted string');
});

test('DE4: delete and restore are admin-only in SQL, and delete records the login as deleted_by', () => {
  for (const f of ['updateDisciplinaryActionDeleted', 'updateDisciplinaryActionRestored']) {
    const src = read(`src/actions/${f}.ts`);
    assert.match(src, ADMIN_EXISTS, `${f} has no disciplinary_admins EXISTS check`);
    assert.doesNotMatch(src, PARAM_IN_QUOTES, `${f}: a {{ }} sits inside a quoted string`);
  }
  assert.match(read('src/actions/updateDisciplinaryActionDeleted.ts'),
    new RegExp(String.raw`deleted_by\s*=[^,\n]*${USER}`), 'deleted_by must come from {{ user.email }}');
});

test('DE5: loadDisciplinaryAdmin asks the database, with the login email', () => {
  const src = read('src/actions/loadDisciplinaryAdmin.ts');
  assert.match(src, DS);
  assert.match(src, /disciplinary_admins/);
  assert.match(src, new RegExp(String.raw`lower\(\s*btrim\(\s*${USER}\s*\)\s*\)`));
});

test('DE6: PDFs come from loadDisciplinaryPdf, one row at a time; the list loader never ships PDF bytes', () => {
  const pdf = read('src/actions/loadDisciplinaryPdf.ts');
  assert.match(pdf, DS);
  assert.match(pdf, /pdf_en_base64/);
  assert.match(pdf, /pdf_en_original_base64/);
  assert.match(pdf, /deleted_at IS NULL/);
  assert.doesNotMatch(pdf, PARAM_IN_QUOTES);
  // Booleans such as `pdf_en_base64 IS NOT NULL AS has_pdf` are fine; the column itself is not.
  const list = read('src/actions/loadDisciplinaryActions.ts')
    .replace(/\bpdf_\w+\s+IS\s+(NOT\s+)?NULL\b/gi, '');
  assert.doesNotMatch(list, /\bpdf_(en|es)(_original)?_base64\b/,
    'loadDisciplinaryActions selects a PDF column: every manager would download every PDF');
});

test('DE7: the UPDATED email goes out through Email Passiontocare', () => {
  const src = read('src/actions/sendDisciplinaryUpdatedEmail.ts');
  assert.match(src, /'Email Passiontocare'/);
  assert.match(src, /UPDATED/);
});

// ── UI gate ───────────────────────────────────────────────────────────────────

/** Names bound from useDisciplinaryAdmin() in a file, plus consts derived from them. */
function adminNames(src: string, file: string): string[] {
  assert.match(src, /useDisciplinaryAdmin\(/, `${file} does not call useDisciplinaryAdmin()`);
  const names: string[] = [];
  const destr = src.match(/const\s*\{([^}]*)\}\s*=\s*useDisciplinaryAdmin\(/);
  if (destr) for (const part of destr[1].split(',')) {
    const n = part.split(':').pop()!.split('=')[0].trim();
    if (n) names.push(n);
  }
  const plain = src.match(/const\s+(\w+)\s*=\s*useDisciplinaryAdmin\(/);
  if (plain) names.push(plain[1]);
  // One level of derivation, e.g. `const canEdit = isAdmin && !viewAs;`
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*([^;\n]+)/g)) {
    if (names.some(n => new RegExp(`\\b${n}\\b`).test(m[2])) && !names.includes(m[1])) names.push(m[1]);
  }
  assert.ok(names.length, `${file}: could not see what useDisciplinaryAdmin() is bound to`);
  return names;
}

/** For every occurrence of `anchor`, the condition of the nearest `{COND && (` (or `{COND ? (`) before it. */
function gatesBefore(src: string, anchor: RegExp): string[] {
  const hits = [...src.matchAll(new RegExp(anchor.source, 'g'))];
  assert.ok(hits.length, `anchor ${anchor} not found`);
  return hits.map(h => {
    const gates = [...src.slice(0, h.index).matchAll(/\{\s*([^{}]+?)\s*(?:&&|\?)\s*\(/g)];
    assert.ok(gates.length, `nothing gates ${anchor}`);
    return gates[gates.length - 1][1];
  });
}

test('DE8: useDisciplinaryAdmin asks loadDisciplinaryAdmin', () => {
  const src = read('src/app/pages/disciplinary/useDisciplinaryAdmin.ts');
  assert.match(src, /loadDisciplinaryAdmin/);
});

test('DE9: ActionDetail gates Edit, Delete and Restore on the admin hook, not isSuper', () => {
  const file = 'src/app/pages/disciplinary/ActionDetail.tsx';
  const src = read(file);
  const names = adminNames(src, file);
  const hook = read('src/app/pages/disciplinary/useDisciplinaryAdmin.ts');
  assert.ok(/viewAs/.test(src) || /viewAs/.test(hook), 'admin powers must switch off while viewing as someone else');
  for (const anchor of [/setDeleteOpen\(true\)/, /onClick=\{handleRestore\}/, /set\w*Edit\w*\(true\)/]) {
    for (const cond of gatesBefore(src, anchor)) {
      assert.ok(names.some(n => new RegExp(`\\b${n}\\b`).test(cond)),
        `${anchor} is gated on "${cond}", not on the admin hook (${names.join(', ')})`);
    }
  }
});

test('DE10: the Deleted filter is offered only to admins', () => {
  const file = 'src/app/pages/Disciplinary.tsx';
  const src = read(file);
  assert.doesNotMatch(src, /isSuper \? \[\{ value: 'deleted'/, 'the Deleted filter is still gated on isSuper');
  const names = adminNames(src, file);
  const m = src.match(/(\w+)\s*\?\s*\[\{\s*value:\s*'deleted'/);
  assert.ok(m, 'Deleted filter not found');
  assert.ok(names.includes(m![1]), `the Deleted filter is gated on ${m![1]}, not on the admin hook`);
});

// ── Housekeeping ──────────────────────────────────────────────────────────────

test('DE11: every disciplinary page, PDF and options file stays under 15 KB', () => {
  const files: string[] = ['src/app/pages/Disciplinary.tsx', 'src/app/lib/disciplinaryOptions.ts'];
  for (const dir of ['src/app/pages/disciplinary', 'src/app/lib/disciplinaryPdf']) {
    for (const f of readdirSync(join(root, dir))) files.push(`${dir}/${f}`);
  }
  for (const a of ['updateDisciplinaryAction', 'loadDisciplinaryAdmin', 'loadDisciplinaryPdf', 'sendDisciplinaryUpdatedEmail']) {
    files.push(`src/actions/${a}.ts`);
  }
  for (const f of files) {
    assert.ok(existsSync(join(root, f)), `${f} is missing`);
    const size = statSync(join(root, f)).size;
    assert.ok(size < 15 * 1024, `${f} is ${size} bytes`);
  }
});

test('DE12: no useLoadAction(..., { params: {...} }) wrapper anywhere in the disciplinary pages', () => {
  const files = ['src/app/pages/Disciplinary.tsx'];
  for (const f of readdirSync(join(root, 'src/app/pages/disciplinary'))) files.push(`src/app/pages/disciplinary/${f}`);
  for (const f of files) {
    assert.doesNotMatch(read(f), /useLoadAction\(\s*\w+\s*,[^;]*?\bparams:\s*\{/,
      `${f}: params must go flat, never inside a params: {} wrapper`);
  }
});

// Review fix (prompt 12): the list reloads only on "Done". If the row was closed
// before Done, a later edit started from the stale values and put them back.
test('DE13: a saved edit reloads the list on Done and when the action row closes', () => {
  const form = read('src/app/pages/disciplinary/EditActionForm.tsx');
  assert.match(form, /onSaved\?:\s*\(\)\s*=>\s*void/, 'EditActionForm takes an onSaved callback');
  assert.match(form, /if\s*\(\s*result\s*\)\s*onSaved\?\.\(\)/, 'onSaved fires once the update succeeded');
  const detail = read('src/app/pages/disciplinary/ActionDetail.tsx');
  assert.match(detail, /onSaved=\{\(\)\s*=>\s*\{\s*savedUnreloaded\.current\s*=\s*true/, 'ActionDetail remembers a save');
  assert.match(detail, /useEffect\(\(\)\s*=>\s*\(\)\s*=>\s*\{\s*if\s*\(\s*savedUnreloaded\.current\s*\)\s*onChangedRef\.current\(\)/,
    'closing the row after a save still reloads the list');
});

test('DE14: "Edited on" is the Panama date, not the UTC date', () => {
  assert.match(read('src/actions/loadDisciplinaryActions.ts'),
    /\(edited_at AT TIME ZONE 'America\/Panama'\)::text AS edited_at/);
});
