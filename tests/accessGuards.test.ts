// Access roles (roadmap G) — structural guards.
// A missing guard here does not throw: a manager simply sees Payroll, or another
// team's employees. So the shape itself is asserted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

test('G1: every Payroll and Admin route in app.tsx is wrapped in RequireSuper', () => {
  const app = read('src/app/app.tsx');
  for (const path of ['/process', '/action-required', '/payroll-master', '/period-log', '/hrk-summary', '/admin']) {
    const line = app.split('\n').find(l => l.includes(`path="${path}"`));
    assert.ok(line, `route ${path} not found`);
    assert.match(line!, /<RequireSuper>/, `route ${path} is reachable by a manager`);
  }
  assert.match(app, /path="\/"\s+element=\{<HomeRedirect \/>\}/, '/ must redirect by role');
});

// RATCHET: every action a manager-visible page loads employee data through.
// Add a file here in the same commit that scopes it.
const SCOPED_ACTIONS = [
  'loadAttendanceEmployees', 'loadAttendanceDaily', 'loadAttendanceReportDays',
  'loadMondayRequestsRange', 'loadMondayAttendanceFormsRange',
  'loadPtoBalancesInputs', 'loadPtoEmployeeDetail', 'loadPtoReviewCount', 'loadPendingPtoRequests',
  'loadContractMilestones', 'loadContractsExpiringCount',
];

test('G2: every scoped action filters through v_employee_access with the signed-in email', () => {
  for (const name of SCOPED_ACTIONS) {
    const src = read(`src/actions/${name}.ts`);
    assert.match(src, /v_employee_access/, `${name} is not scoped`);
    assert.match(src, /access_viewer\(\{\{\s*user\.email\s*\}\}(::text)?,\s*\{\{params\.viewAs\}\}::text\)/,
      `${name} must take the viewer from {{ user.email }}, never from a browser param alone`);
  }
});

test('G3: access files and TopNav stay under 15 KB', () => {
  const files = ['src/app/TopNav.tsx', 'src/app/pages/admin/AdminAccessHub.tsx',
    'src/app/context/ViewerContext.tsx', 'src/app/components/AccessGate.tsx', 'src/app/lib/access.ts'];
  const dir = join(root, 'src/app/pages/admin/access');
  for (const f of readdirSync(dir)) files.push(`src/app/pages/admin/access/${f}`);
  for (const f of files) {
    const size = statSync(join(root, f)).size;
    assert.ok(size < 15 * 1024, `${f} is ${size} bytes`);
  }
});
