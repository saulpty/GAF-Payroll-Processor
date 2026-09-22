// Access roles (roadmap G) — pure helpers in src/app/lib/access.ts.
// The nav, the route guard and the tech-team list all lean on these, so a wrong
// answer here either hides a page from a super user or shows Payroll to a manager.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail, isSuperOnlyPath, canSeePath, canSeeSection, homeFor,
  viewerStatus, roleLabel, techTeamList,
} from '../src/app/lib/access.ts';

test('AX1: normalizeEmail trims and lower-cases (SSO hands back Saul.F@…)', () => {
  assert.equal(normalizeEmail('  Saul.F@VitasyaHC.com '), 'saul.f@vitasyahc.com');
  assert.equal(normalizeEmail(null), '');
  assert.equal(normalizeEmail(undefined), '');
});

test('AX2: every Payroll and Admin path is super-only; manager pages are not', () => {
  for (const p of ['/process', '/action-required', '/payroll-master', '/hrk-summary',
    '/period-log', '/admin', '/admin/employees', '/admin/access']) {
    assert.equal(isSuperOnlyPath(p), true, p);
    assert.equal(canSeePath(false, p), false, p);
    assert.equal(canSeePath(true, p), true, p);
  }
  for (const p of ['/attendance', '/attendance/reports', '/pto', '/contracts', '/disciplinary']) {
    assert.equal(canSeePath(false, p), true, p);
  }
  // A prefix match must be a path segment, not a substring.
  assert.equal(isSuperOnlyPath('/administrator'), false);
  assert.equal(isSuperOnlyPath('/processing'), false);
});

test('AX3: sections — managers lose exactly payroll and admin', () => {
  const all = ['payroll', 'attendance', 'disciplinary', 'contracts', 'pto', 'admin'];
  assert.deepEqual(all.filter(s => canSeeSection(false, s)), ['attendance', 'disciplinary', 'contracts', 'pto']);
  assert.deepEqual(all.filter(s => canSeeSection(true, s)), all);
});

test('AX4: home page by role', () => {
  assert.equal(homeFor(true), '/payroll-master');
  assert.equal(homeFor(false), '/attendance/today');
});

test('AX5: viewerStatus is ready only for a known, active user', () => {
  const base = { real_email: 'a@x.com', email: 'a@x.com', display_name: 'A', role: 'manager', all_employees: false };
  assert.equal(viewerStatus({ ...base, id: 3, active: true }), 'ready');
  assert.equal(viewerStatus({ ...base, id: '3', active: true }), 'ready', 'BIGINT may arrive as a string');
  assert.equal(viewerStatus({ ...base, id: null, active: null }), 'blocked', 'not on the list');
  assert.equal(viewerStatus({ ...base, id: 3, active: false }), 'blocked', 'inactive');
  assert.equal(viewerStatus(null), 'blocked');
  assert.equal(viewerStatus(undefined), 'blocked');
});

test('AX6: roleLabel and the tech-team list (active only, lower-cased, tab-separated)', () => {
  assert.equal(roleLabel({ role: 'super_user', all_employees: false }), 'Super user');
  assert.equal(roleLabel({ role: 'manager', all_employees: true }), 'Manager (all employees)');
  assert.equal(roleLabel({ role: 'manager', all_employees: false }), 'Manager');
  const out = techTeamList([
    { email: 'Saul.F@vitasyahc.com', display_name: 'Saul', role: 'super_user', all_employees: false, active: true },
    { email: 'gone@vitasyahc.com', display_name: 'Gone', role: 'manager', all_employees: false, active: false },
    { email: 'm@vitasyahc.com', display_name: 'Mia', role: 'manager', all_employees: true, active: true },
  ]);
  assert.equal(out, [
    'Email\tName\tRole',
    'saul.f@vitasyahc.com\tSaul\tSuper user',
    'm@vitasyahc.com\tMia\tManager (all employees)',
  ].join('\n'));
});
