// International Intake 1 agents (Marcela Gordon, Yankel Raskin; 2026-10-16).
// Prompts: docs/superpowers/prompts/2026-10-16-international-agents/01-05.
// Employees outside Panama come from a second Monday board (International Employee Directory)
// and only use Attendance. The one thing that must never break: they stay out of payroll.
// IA1 is the payroll guard. Everything else proves the sync can never touch a Panama employee.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const has = (p: string) => existsSync(join(root, p));

const PAYROLL_LINE =
  "AND COALESCE(e.country, 'Panama') = COALESCE(NULLIF((SELECT c.value FROM classification_config c WHERE c.key = 'payroll_country'), ''), 'Panama')";
const count = (s: string, sub: string) => s.split(sub).length - 1;

test('IA1: payroll, PTO and Contracts only load the payroll country', () => {
  assert.equal(count(read('src/actions/loadEmployees.ts'), PAYROLL_LINE), 1, 'loadEmployees (Process Payroll)');
  assert.equal(count(read('src/actions/loadPtoBalancesInputs.ts'), PAYROLL_LINE), 1, 'loadPtoBalancesInputs');
  assert.equal(count(read('src/actions/loadPtoUpcoming.ts'), PAYROLL_LINE), 2, 'loadPtoUpcoming, both halves');
  assert.equal(count(read('src/actions/loadContractMilestones.ts'), PAYROLL_LINE), 1, 'loadContractMilestones');
});

test('IA2: the country migration adds the column with a Panama default and the board settings', () => {
  const f = 'src/migrations/1782018000_employee_country.sql';
  assert.ok(has(f), f + ' missing');
  const sql = read(f);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Panama'/);
  for (const key of ['payroll_country', 'monday_board_directory_intl', 'monday_group_intl_current',
    'monday_col_intl_email', 'monday_col_intl_role', 'monday_col_intl_country', 'monday_col_intl_manager',
    'monday_col_intl_manager_email', 'monday_col_intl_manager2', 'monday_col_intl_manager2_email']) {
    assert.ok(sql.includes(`'${key}'`), key);
  }
  assert.match(sql, /ON CONFLICT \(key\) DO NOTHING/);
});

test('IA3: the seed adds the 16 as International on the Standard schedule, insert-only', () => {
  const f = 'src/migrations/1782019000_seed_international_agents.sql';
  assert.ok(has(f), f + ' missing');
  const sql = read(f);
  assert.equal((sql.match(/@(passiontocarehc|mombaoh|mombami)\.com'\)/g) ?? []).length, 16);
  assert.match(sql, /'Intake 1', 'Marcela Gordon', 'International'/);
  assert.match(sql, /schedule_name = 'Standard'/);
  assert.match(sql, /ON CONFLICT \(teramind_email\) DO NOTHING/);
  assert.doesNotMatch(sql, /'Panama'/);
});

test('IA4: the country is written by the role/manager action and the upsert, never blanked', () => {
  assert.match(read('src/actions/updateEmployeeRoleManager.ts'),
    /country = COALESCE\(NULLIF\(\{\{params\.country\}\}, ''\), country\)/);
  const up = read('src/actions/upsertEmployee.ts');
  assert.match(up, /COALESCE\(NULLIF\(\{\{params\.country\}\}, ''\), 'Panama'\)/);
  assert.match(up, /country = COALESCE\(NULLIF\(\{\{params\.country\}\}, ''\), employees\.country\)/);
  assert.match(read('src/actions/loadAllEmployees.ts'), /e\.country,/);
});

test('IA5: the plan file is pure and the Panama sync is untouched', () => {
  const plan = 'src/app/lib/intlDirectoryPlan.ts';
  assert.ok(has(plan), plan + ' missing');
  for (const line of read(plan).split('\n').filter(l => /^import /.test(l))) {
    assert.match(line, /^import type /, 'runtime import in the plan file: ' + line);
  }
  assert.doesNotMatch(read('src/app/pages/admin/employees/syncDirectory.ts'), /intl/i);
  assert.match(read('src/app/components/MondayAutoSync.tsx'), /syncIntlDirectory\(/);
});

test('IA6: access groups also come from the international board, both manager slots', () => {
  const src = read('src/app/pages/admin/access/syncAccessFromMonday.ts');
  for (const key of ['monday_board_directory_intl', 'monday_group_intl_current', 'monday_col_intl_email',
    'monday_col_intl_manager_email', 'monday_col_intl_manager2_email']) {
    assert.ok(src.includes(`'${key}'`), key);
  }
});

test('IA7: no new file in this work hardcodes the board id', () => {
  const files = ['src/app/lib/intlDirectoryPlan.ts', 'src/app/pages/admin/employees/syncIntlDirectory.ts',
    'src/app/pages/admin/access/syncAccessFromMonday.ts', 'src/app/components/MondayAutoSync.tsx'];
  for (const f of files.filter(has)) {
    const s = read(f);
    assert.doesNotMatch(s, /18435831051|group_mm86|_mm86/, f);
  }
});

// ── Behaviour of the pure plan ───────────────────────────────────────────────

type Item = { id: string; name: string; group?: { id: string; title: string };
  column_values: { id: string; text: string | null; value: string | null }[] };
const COLS = { email: 'em', currentGroup: 'cur', role: 'ro', country: 'co', manager: 'mg' };
const item = (name: string, email: string, group = 'cur', extra: Record<string, string> = {}): Item => ({
  id: name, name, group: { id: group, title: group },
  column_values: Object.entries({ em: email, ro: 'Intake 1', mg: 'Marcela Gordon', co: '', ...extra })
    .map(([id, text]) => ({ id, text, value: null })),
});
const emp = (id: number, email: string, country: string, over: Record<string, unknown> = {}) => ({
  id, teramind_email: email, active: true, is_grace_list: false, excluded_from_payroll: false,
  role: 'Intake 1', manager: 'Marcela Gordon', country, ...over,
});

async function loadPlan() {
  const p = 'src/app/lib/intlDirectoryPlan.ts';
  if (!has(p)) return null;
  return import('../src/app/lib/intlDirectoryPlan.ts');
}

test('IA8: nothing changes when the board matches the app', async () => {
  const m = await loadPlan(); assert.ok(m, 'intlDirectoryPlan.ts missing');
  const plan = m!.planIntlDirectory([item('Anna Lubemba', 'Anna.L@x.com')] as never, [emp(1, 'anna.l@x.com', 'International')], COLS, 'Panama');
  assert.deepEqual([plan.details.length, plan.flags.length, plan.toCreate.length, plan.held, plan.skipped], [0, 0, 0, 0, 0]);
});

test('IA9: an email that belongs to a Panama employee is never touched, and names never match', async () => {
  const m = await loadPlan(); assert.ok(m, 'intlDirectoryPlan.ts missing');
  const panama = emp(7, 'same@x.com', 'Panama', { role: 'EVV Specialist', manager: 'Arelis Acosta' });
  const twin = emp(8, 'luis.a@x.com', 'Panama');
  const plan = m!.planIntlDirectory([item('Someone', 'SAME@x.com', 'past'), item('Luis Abad', 'other@x.com')] as never,
    [panama, twin], COLS, 'Panama');
  assert.equal(plan.skipped, 1);
  assert.deepEqual(plan.details, []);
  assert.deepEqual(plan.flags, []);
  assert.deepEqual(plan.toCreate.map(c => c.email), ['other@x.com'], 'a same-name row is a new person, not Luis');
});

test('IA10: moving to Past deactivates; a blank Country means International; a Country is kept', async () => {
  const m = await loadPlan(); assert.ok(m, 'intlDirectoryPlan.ts missing');
  const plan = m!.planIntlDirectory(
    [item('A', 'a@x.com', 'past'), item('B', 'b@x.com', 'cur', { co: 'South Africa' })] as never,
    [emp(1, 'a@x.com', 'International'), emp(2, 'b@x.com', 'International')], COLS, 'Panama');
  assert.deepEqual(plan.flags, [{ id: 1, is_grace_list: false, excluded_from_payroll: false, active: false }]);
  assert.deepEqual(plan.details, [{ id: 2, role: 'Intake 1', manager: 'Marcela Gordon', country: 'South Africa' }]);
});

test('IA11: up to 3 new people are created; 4 or more are held for review', async () => {
  const m = await loadPlan(); assert.ok(m, 'intlDirectoryPlan.ts missing');
  const three = ['a', 'b', 'c'].map(n => item(n, n + '@x.com'));
  assert.equal(m!.planIntlDirectory(three as never, [], COLS, 'Panama').toCreate.length, 3);
  assert.equal(m!.planIntlDirectory(three as never, [], COLS, 'Panama').toCreate[0].country, 'International');
  const four = [...three, item('d', 'd@x.com')];
  const held = m!.planIntlDirectory(four as never, [], COLS, 'Panama');
  assert.deepEqual([held.toCreate.length, held.held], [0, 4]);
  const pastOnly = m!.planIntlDirectory([item('e', 'e@x.com', 'past')] as never, [], COLS, 'Panama');
  assert.equal(pastOnly.toCreate.length, 0, 'a former employee is never created');
});

test('IA12: no migration number collides with the two new ones', () => {
  const names = readdirSync(join(root, 'src/migrations')).filter(n => n.endsWith('.sql'));
  for (const n of ['1782018000', '1782019000']) {
    assert.ok(names.filter(x => x.startsWith(n)).length <= 1, n + ' used twice');
  }
});
