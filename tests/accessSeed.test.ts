// Access roles (roadmap G) — planAccessSeed in src/app/lib/accessSeed.ts.
// Since 2026-09-16 a group is one ORDERED manager list from the Panama Employee
// Directory: Manager (rank 1, direct), Manager 2, Manager 3, Manager 4. Everyone
// with the same list shares a group. Emails are the identity; names are labels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planAccessSeed, managerChain, chainKey } from '../src/app/lib/accessSeed.ts';
import type { DirectoryPerson, SeedExisting } from '../src/app/lib/accessSeed.ts';

const person = (name: string, ...mgrs: [string, string][]): DirectoryPerson =>
  ({ name, email: '', managers: mgrs.map(([n, e]) => ({ name: n, email: e })) });
const empty: SeedExisting = { users: [], groups: [], groupedEmployeeIds: [] };
const ids: Record<string, string> = { Ana: '1', Ben: '2', Cora: '3', Dan: '4', Eve: '5' };
const resolve = (p: DirectoryPerson) => ids[p.name] ?? null;

const ARELIS: [string, string] = ['Arelis Acosta', 'arelis.a@vitasyahc.com'];
const LILY: [string, string] = ['Lily Beasly', 'lily.b@passiontocarehc.com'];
const CHAYA: [string, string] = ['Chaya Lichy', 'chaya.l@passiontocarehc.com'];
const SHAQ: [string, string] = ['Shaquille Withers', 'shaq.w@passiontocarehc.com'];
const BLANK: [string, string] = ['', ''];

test('AS1: same ordered manager list -> one group, managers ranked 1..n in Monday order', () => {
  const plan = planAccessSeed([
    person('Ana', ARELIS, LILY, CHAYA),
    person('Ben', ARELIS, LILY, CHAYA),
  ], resolve, empty);
  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0].name, 'Arelis Acosta · Lily Beasly · Chaya Lichy');
  assert.deepEqual(plan.groups[0].managers, [
    { email: 'arelis.a@vitasyahc.com', rank: 1 },
    { email: 'lily.b@passiontocarehc.com', rank: 2 },
    { email: 'chaya.l@passiontocarehc.com', rank: 3 },
  ]);
  assert.equal(plan.users.length, 3);
  assert.equal(plan.members.length, 2);
  assert.ok(plan.members.every(m => m.groupId === '' && m.key === plan.groups[0].key));
});

test('AS2: a different list is a different group, even with the same direct manager', () => {
  const plan = planAccessSeed([
    person('Ana', ARELIS, LILY, CHAYA),
    person('Ben', ARELIS, LILY, SHAQ),
    person('Cora', ARELIS),
  ], resolve, empty);
  assert.equal(plan.groups.length, 3);
  assert.equal(plan.users.length, 4, 'Arelis and Lily are created once');
});

test('AS3: email casing and blank middle slots do not split a group (Manager 4 filled, 2-3 blank)', () => {
  const plan = planAccessSeed([
    person('Ana', ['Arelis Acosta', 'Arelis.A@vitasyahc.com'], BLANK, BLANK, LILY),
    person('Ben', ['Arelis Acosta', ' arelis.a@vitasyahc.com '], ['Lily Beasly', 'Lily.B@passiontocarehc.com']),
  ], resolve, empty);
  assert.equal(plan.groups.length, 1);
  assert.deepEqual(plan.groups[0].managers.map(m => m.rank), [1, 2]);
  assert.equal(plan.users[0].email, 'arelis.a@vitasyahc.com');
});

test('AS4: a manager with a name but no email, no manager at all, or not on the roster -> skipped with a reason', () => {
  const plan = planAccessSeed([
    person('Ana', ['Marcela Gordon', '']),
    person('Ben', ARELIS, ['Lily Beasly', '']),
    person('Cora'),
    person('Zed', ARELIS),
  ], resolve, empty);
  assert.equal(plan.members.length, 0);
  assert.equal(plan.groups.length, 0);
  assert.equal(plan.users.length, 0);
  assert.deepEqual(plan.skipped.map(s => s.reason).sort(), [
    'Manager "Marcela Gordon" has no email on Monday',
    'Manager 2 "Lily Beasly" has no email on Monday',
    'no manager on Monday',
    'not on the app roster',
  ]);
});

test('AS5: an existing group with the same ordered managers is reused, whatever its name', () => {
  const existing: SeedExisting = {
    users: [{ email: 'arelis.a@vitasyahc.com' }, { email: 'lily.b@passiontocarehc.com' }],
    groups: [{ id: '10', name: 'Billing team', managerEmails: ['Arelis.A@vitasyahc.com', 'lily.b@passiontocarehc.com'] }],
    groupedEmployeeIds: ['2'],
  };
  const plan = planAccessSeed([person('Ana', ARELIS, LILY), person('Ben', ARELIS, LILY)], resolve, existing);
  assert.deepEqual(plan.users, []);
  assert.deepEqual(plan.groups, []);
  assert.deepEqual(plan.members, [{ employeeId: '1', key: chainKey(['arelis.a@vitasyahc.com', 'lily.b@passiontocarehc.com']), groupId: '10' }]);
  assert.equal(plan.alreadyGrouped, 1, 'Ben is already in a group and is left alone');
});

test('AS6: order matters — Lily then Arelis is not Arelis then Lily', () => {
  const existing: SeedExisting = {
    users: [], groups: [{ id: '10', name: 'x', managerEmails: ['arelis.a@vitasyahc.com', 'lily.b@passiontocarehc.com'] }],
    groupedEmployeeIds: [],
  };
  const plan = planAccessSeed([person('Ana', LILY, ARELIS)], resolve, existing);
  assert.equal(plan.groups.length, 1);
  assert.equal(plan.members[0].groupId, '');
});

test('AS7: a name clash gets a number; a super user in the list gets no new user row', () => {
  const existing: SeedExisting = {
    users: [{ email: 'tim.m@vitasyahc.com' }],
    groups: [{ id: '3', name: 'Tim Moore · Lily Beasly', managerEmails: ['someone@x.com'] }],
    groupedEmployeeIds: [],
  };
  const plan = planAccessSeed([person('Ana', ['Tim Moore', 'Tim.M@vitasyahc.com'], LILY)], resolve, existing);
  assert.equal(plan.groups[0].name, 'Tim Moore · Lily Beasly (2)');
  assert.deepEqual(plan.users.map(u => u.email), ['lily.b@passiontocarehc.com']);
});

test('AS8: a duplicate Monday row is placed once; a repeated manager email is ranked once; ids compare as strings', () => {
  const numResolve = (p: DirectoryPerson) => (p.name === 'Ana' ? (1 as unknown as string) : null);
  const plan = planAccessSeed([
    person('Ana', ARELIS, ARELIS, LILY),
    person('Ana', ARELIS, LILY),
  ], numResolve, empty);
  assert.equal(plan.members.length, 1);
  assert.equal(plan.members[0].employeeId, '1');
  assert.equal(plan.alreadyGrouped, 1);
  assert.equal(plan.groups[0].managers.length, 2);
});

test('AS9: managerChain and chainKey', () => {
  assert.deepEqual(managerChain([{ name: '', email: '' }]), { reason: 'no manager on Monday' });
  assert.equal(chainKey([' A@x.com ', '', 'b@x.com']), 'a@x.com > b@x.com');
});
