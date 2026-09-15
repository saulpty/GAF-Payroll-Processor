// Access roles (roadmap G) — planAccessSeed in src/app/lib/accessSeed.ts.
// "Build from Monday" and the directory sync both use it. It must only ever ADD:
// a plan that re-creates, renames or moves something would undo Saul's hand edits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planAccessSeed } from '../src/app/lib/accessSeed.ts';
import type { DirectoryPerson, SeedExisting } from '../src/app/lib/accessSeed.ts';

const person = (name: string, manager: string, managerEmail: string, email = ''): DirectoryPerson =>
  ({ name, email, manager, managerEmail });
const empty: SeedExisting = { users: [], groups: [], groupedEmployeeIds: [] };
const ids: Record<string, string> = { Ana: '1', Ben: '2', Cora: '3', Dan: '4', Eve: '5' };
const resolve = (p: DirectoryPerson) => ids[p.name] ?? null;

test('AS1: one user and one group per distinct manager email; everyone placed', () => {
  const plan = planAccessSeed([
    person('Ana', 'Marcela Gordon', 'marcela.g@vitasyahc.com'),
    person('Ben', 'Marcela Gordon', 'marcela.g@vitasyahc.com'),
    person('Cora', 'Leah Kessler', 'leah.k@vitasyahc.com'),
  ], resolve, empty, 'seed');
  assert.deepEqual(plan.users.map(u => u.email).sort(), ['leah.k@vitasyahc.com', 'marcela.g@vitasyahc.com']);
  assert.deepEqual(plan.groups.map(g => g.name).sort(), ['Leah Kessler', 'Marcela Gordon']);
  assert.equal(plan.members.length, 3);
  assert.ok(plan.members.every(m => m.groupId === ''), 'new groups are looked up by manager email later');
});

test('AS2: manager email casing collapses to one group (Monday has Arelis.A@ and arelis.a@)', () => {
  const plan = planAccessSeed([
    person('Ana', 'Arelis Acosta', 'Arelis.A@vitasyahc.com'),
    person('Ben', 'Arelis Acosta', ' arelis.a@vitasyahc.com '),
  ], resolve, empty, 'seed');
  assert.equal(plan.groups.length, 1);
  assert.equal(plan.users.length, 1);
  assert.equal(plan.users[0].email, 'arelis.a@vitasyahc.com');
  assert.deepEqual(plan.members.map(m => m.managerEmail), ['arelis.a@vitasyahc.com', 'arelis.a@vitasyahc.com']);
});

test('AS3: missing manager email or unknown employee is skipped with a reason, never guessed', () => {
  const plan = planAccessSeed([
    person('Ana', 'Marcela Gordon', ''),
    person('Ben', '', ''),
    person('Zed', 'Leah Kessler', 'leah.k@vitasyahc.com'),
  ], resolve, empty, 'seed');
  assert.equal(plan.members.length, 0);
  assert.equal(plan.groups.length, 0, 'Zed is not on the roster, so no group is created for his manager');
  assert.deepEqual(plan.skipped.map(s => s.reason).sort(), [
    'manager "Marcela Gordon" has no email on Monday',
    'no manager on Monday',
    'not on the app roster',
  ]);
});

test('AS4: nothing that exists is re-emitted — existing user, existing group, already-grouped employee', () => {
  const existing: SeedExisting = {
    users: [{ email: 'marcela.g@vitasyahc.com' }],
    groups: [{ id: '10', name: 'Customer Care', primaryEmail: 'Marcela.G@vitasyahc.com' }],
    groupedEmployeeIds: ['2'],
  };
  const plan = planAccessSeed([
    person('Ana', 'Marcela Gordon', 'marcela.g@vitasyahc.com'),
    person('Ben', 'Marcela Gordon', 'marcela.g@vitasyahc.com'),
  ], resolve, existing, 'seed');
  assert.deepEqual(plan.users, []);
  assert.deepEqual(plan.groups, [], 'the renamed group is found by its primary manager, not its name');
  assert.deepEqual(plan.members, [{ employeeId: '1', managerEmail: 'marcela.g@vitasyahc.com', groupId: '10' }]);
  assert.equal(plan.alreadyGrouped, 1, 'Ben stays wherever Saul put him');
});

test('AS5: a manager who already exists as a user (e.g. a super user) gets a group but no new user', () => {
  const plan = planAccessSeed([person('Ana', 'Saul Fallembaum', 'Saul.F@vitasyahc.com')], resolve,
    { users: [{ email: 'saul.f@vitasyahc.com' }], groups: [], groupedEmployeeIds: [] }, 'seed');
  assert.equal(plan.users.length, 0);
  assert.equal(plan.groups.length, 1);
});

test('AS6: newOnly never creates users or groups; it only places people into existing groups', () => {
  const existing: SeedExisting = {
    users: [], groups: [{ id: '7', name: 'Leah Kessler', primaryEmail: 'leah.k@vitasyahc.com' }],
    groupedEmployeeIds: [],
  };
  const plan = planAccessSeed([
    person('Ana', 'Leah Kessler', 'leah.k@vitasyahc.com'),
    person('Ben', 'New Manager', 'new.m@vitasyahc.com'),
  ], resolve, existing, 'newOnly');
  assert.deepEqual(plan.users, []);
  assert.deepEqual(plan.groups, []);
  assert.deepEqual(plan.members, [{ employeeId: '1', managerEmail: 'leah.k@vitasyahc.com', groupId: '7' }]);
  assert.equal(plan.skipped[0].reason, 'no group whose primary manager is new.m@vitasyahc.com');
});

test('AS7: a group name clash with a different manager gets the email appended', () => {
  const existing: SeedExisting = {
    users: [], groups: [{ id: '3', name: 'Leah Kessler', primaryEmail: 'someone.else@vitasyahc.com' }],
    groupedEmployeeIds: [],
  };
  const plan = planAccessSeed([person('Ana', 'Leah Kessler', 'leah.k@vitasyahc.com')], resolve, existing, 'seed');
  assert.deepEqual(plan.groups, [{ name: 'Leah Kessler (leah.k@vitasyahc.com)', managerEmail: 'leah.k@vitasyahc.com' }]);
});

test('AS8: a duplicate Monday row for the same employee is placed once; BIGINT ids compare as strings', () => {
  const numResolve = (p: DirectoryPerson) => (p.name === 'Ana' ? (1 as unknown as string) : null);
  const plan = planAccessSeed([
    person('Ana', 'Leah Kessler', 'leah.k@vitasyahc.com'),
    person('Ana', 'Leah Kessler', 'leah.k@vitasyahc.com'),
  ], numResolve, { users: [], groups: [], groupedEmployeeIds: [] }, 'seed');
  assert.equal(plan.members.length, 1);
  assert.equal(plan.members[0].employeeId, '1');
  assert.equal(plan.alreadyGrouped, 1);
});
