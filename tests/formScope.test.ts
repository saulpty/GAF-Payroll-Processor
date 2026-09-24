// Disciplinary Actions Form (the second UIB app, mirrored in form-app/): who files,
// and for whom (2026-09-24, prompts F1-F5 in
// docs/superpowers/prompts/2026-09-24-disciplinary-access/).
//
// The filer is the logged-in user, never a typed name or email. A manager may file
// only for the people who report to them on the Monday directory (any of the four
// manager slots); Tim and Saul (disciplinary_admins) may file for anyone.
//
// ASSUMPTION about filerScope.ts, written before it exists:
//   employeesForFiler({ email, isAdmin, adminName, managers, allEmployees })
//     -> { employees: string[], filerName: string, matched: boolean }
// where `managers` holds ManagerInfo values from useMondayAutofill
// ({ name, email, reports, position }). The test passes a plain array, which also
// satisfies code written against a Map's values (for..of, .values(), .forEach).
// If the landed signature differs, fix this file to match it, not the other way round.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

// Imported per test, so a missing file fails the scope tests without hiding the source checks.
const scope = () => import('../form-app/src/app/utils/filerScope.ts');

const MANAGERS = [
  { name: 'Leah Kessler', email: 'leah.k@vitasyahc.com', reports: ['Zoe Pinto', 'Ana Ruiz'], position: '' },
  { name: 'Mario Diaz', email: 'mario.d@vitasyahc.com', reports: ['Carla Soto', 'Ana Ruiz'], position: '' },
  // The same person under a second spelling (another manager slot): same email, more reports.
  { name: 'Leah K.', email: 'leah.k@vitasyahc.com', reports: ['Beto Lima', 'Zoe Pinto'], position: '' },
];
const ALL = ['Zoe Pinto', 'Carla Soto', 'Ana Ruiz', 'Beto Lima', 'Dora Vega'];
const base = { isAdmin: false, adminName: null as string | null, managers: MANAGERS, allEmployees: ALL };

test('FS1: a manager sees only their own reports', async () => {
  const { employeesForFiler } = await scope();
  const r = employeesForFiler({ ...base, email: 'mario.d@vitasyahc.com' });
  assert.deepEqual(r.employees, ['Ana Ruiz', 'Carla Soto']);
  assert.equal(r.matched, true);
  assert.equal(r.filerName, 'Mario Diaz');
});

test('FS2: the email match ignores letter case and surrounding spaces', async () => {
  const { employeesForFiler } = await scope();
  const r = employeesForFiler({ ...base, email: '  Mario.D@VitasyaHC.com ' });
  assert.deepEqual(r.employees, ['Ana Ruiz', 'Carla Soto']);
  assert.equal(r.matched, true);
});

test('FS3: a manager listed twice (two slots, two spellings) gets the union, deduped and sorted', async () => {
  const { employeesForFiler } = await scope();
  const r = employeesForFiler({ ...base, email: 'leah.k@vitasyahc.com' });
  assert.deepEqual(r.employees, ['Ana Ruiz', 'Beto Lima', 'Zoe Pinto']);
  assert.equal(r.matched, true);
});

test('FS4: an admin sees every current employee, sorted', async () => {
  const { employeesForFiler } = await scope();
  const r = employeesForFiler({ ...base, email: 'tim.m@vitasyahc.com', isAdmin: true, adminName: 'Timothy Moore' });
  assert.deepEqual(r.employees, [...ALL].sort());
});

test('FS5: an unknown email sees nobody, and is named by its email', async () => {
  const { employeesForFiler } = await scope();
  const r = employeesForFiler({ ...base, email: 'stranger@vitasyahc.com' });
  assert.deepEqual(r.employees, []);
  assert.equal(r.matched, false);
  assert.equal(r.filerName, 'stranger@vitasyahc.com');
});

test('FS6: an admin who is not a Monday manager is named by the admin table', async () => {
  const { employeesForFiler } = await scope();
  const r = employeesForFiler({ ...base, email: 'saul.f@vitasyahc.com', isAdmin: true, adminName: 'Saul Fallembaum' });
  assert.equal(r.filerName, 'Saul Fallembaum');
  assert.deepEqual(r.employees, [...ALL].sort());
});

// ── Source checks ─────────────────────────────────────────────────────────────

test('FS7: saveSubmission takes manager_email from the login, not from the browser', () => {
  const src = read('form-app/src/actions/saveSubmission.ts');
  assert.match(src, /\{\{\s*user\.email\s*\}\}/, 'manager_email must come from {{ user.email }}');
  assert.doesNotMatch(src, /\{\{params\.manager_email\}\}/, 'the browser can still choose manager_email');
});

test('FS8: loadCurrentFiler exists and reads disciplinary_admins', () => {
  const src = read('form-app/src/actions/loadCurrentFiler.ts');
  assert.match(src, /disciplinary_admins/);
  assert.match(src, /\{\{\s*user\.email\s*\}\}/);
});

test('FS9: Step 1 has no manager name or email inputs', () => {
  const src = read('form-app/src/app/pages/wizard/Step1EmployeeWarning.tsx');
  assert.doesNotMatch(src, /Type manager name/, 'the manager name box is still there');
  assert.doesNotMatch(src, /id="managerEmail"/, 'the manager email box is still there');
  assert.doesNotMatch(src, /placeholder="manager@/, 'the manager email box is still there');
});

test('FS10: the hardcoded fallback employee list is gone', () => {
  const src = read('form-app/src/app/utils/disciplinaryFormData.ts');
  assert.doesNotMatch(src, /export const EMPLOYEES\b/,
    'a hardcoded EMPLOYEES list lets a manager pick anyone when Monday fails');
});

test('FS11: a migration creates disciplinary_admins with Saul and Tim', () => {
  const dir = join(root, 'form-app/src/migrations');
  const hit = readdirSync(dir).filter(f => f.endsWith('.sql'))
    .map(f => readFileSync(join(dir, f), 'utf8'))
    .find(s => /CREATE TABLE\s+(IF NOT EXISTS\s+)?(public\.)?disciplinary_admins\b/i.test(s));
  assert.ok(hit, 'no migration creates disciplinary_admins');
  assert.match(hit!, /saul\.f@vitasyahc\.com/);
  assert.match(hit!, /tim\.m@vitasyahc\.com/);
});

// generatePdf.ts was already 19.9 KB before this work and no prompt touches it;
// it is exempt until it is split on purpose.
const FS12_EXEMPT = new Set(['form-app/src/app/utils/generatePdf.ts']);

test('FS12: every form-app/src/app file (assets aside) stays under 15 KB', () => {
  const walk = (rel: string): string[] => readdirSync(join(root, rel), { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? (d.name === 'assets' ? [] : walk(`${rel}/${d.name}`)) : [`${rel}/${d.name}`]);
  const big = walk('form-app/src/app')
    .map(f => ({ f, size: statSync(join(root, f)).size }))
    .filter(x => x.size >= 15 * 1024 && !FS12_EXEMPT.has(x.f));
  assert.deepEqual(big, [], `over 15 KB: ${big.map(x => `${x.f} (${x.size})`).join(', ')}`);
});
