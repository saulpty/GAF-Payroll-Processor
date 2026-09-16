// Access roles (roadmap G) — planAccessSync in src/app/lib/accessSeed.ts.
// Since 2026-09-16 Monday is the source of truth and the app syncs itself: a group is one
// ORDERED manager list from the Panama Employee Directory (Manager = rank 1, Manager 2,
// Manager 3, Manager 4). Emails are the identity; names are labels. The plan is a diff,
// so running it again when nothing changed on Monday must produce zero changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planAccessSync, managerChain, chainKey, changeCount } from '../src/app/lib/accessSeed.ts';
import type { DirectoryPerson, SyncCurrent } from '../src/app/lib/accessSeed.ts';

const person = (name: string, ...mgrs: [string, string][]): DirectoryPerson =>
  ({ name, email: '', managers: mgrs.map(([n, e]) => ({ name: n, email: e })) });
const empty: SyncCurrent = { users: [], groups: [] };
const ids: Record<string, string> = { Ana: '1', Ben: '2', Cora: '3', Dan: '4', Eve: '5' };
const resolve = (p: DirectoryPerson) => ids[p.name] ?? null;

const ARELIS: [string, string] = ['Arelis Acosta', 'arelis.a@vitasyahc.com'];
const LILY: [string, string] = ['Lily Beasly', 'lily.b@passiontocarehc.com'];
const CHAYA: [string, string] = ['Chaya Lichy', 'chaya.l@passiontocarehc.com'];
const SHAQ: [string, string] = ['Shaquille Withers', 'shaq.w@passiontocarehc.com'];
const BLANK: [string, string] = ['', ''];
const K_AL = chainKey(['arelis.a@vitasyahc.com', 'lily.b@passiontocarehc.com']);
const user = (id: string, email: string, display_name: string, role = 'manager') => ({ id, email, display_name, role });

test('AS1: same ordered manager list -> one group, managers ranked 1..n in Monday order', () => {
  const plan = planAccessSync([person('Ana', ARELIS, LILY, CHAYA), person('Ben', ARELIS, LILY, CHAYA)], resolve, empty);
  assert.equal(plan.groupsToCreate.length, 1);
  assert.equal(plan.groupsToCreate[0].name, 'Arelis Acosta · Lily Beasly · Chaya Lichy');
  assert.deepEqual(plan.groupsToCreate[0].managers.map(m => m.rank), [1, 2, 3]);
  assert.equal(plan.usersToAdd.length, 3);
  assert.equal(plan.membersToAdd.length, 2);
  assert.equal(plan.placed, 2);
});

test('AS2: a different list is a different group, even with the same direct manager; order matters', () => {
  const plan = planAccessSync([
    person('Ana', ARELIS, LILY, CHAYA), person('Ben', ARELIS, LILY, SHAQ), person('Cora', ARELIS), person('Dan', LILY, ARELIS),
  ], resolve, empty);
  assert.equal(plan.groupsToCreate.length, 4);
  assert.equal(plan.usersToAdd.length, 4, 'each manager email is added once');
});

test('AS3: email casing and blank middle slots do not split a group', () => {
  const plan = planAccessSync([
    person('Ana', ['Arelis Acosta', 'Arelis.A@vitasyahc.com'], BLANK, BLANK, LILY),
    person('Ben', ['Arelis Acosta', ' arelis.a@vitasyahc.com '], ['Lily Beasly', 'Lily.B@passiontocarehc.com']),
  ], resolve, empty);
  assert.equal(plan.groupsToCreate.length, 1);
  assert.equal(plan.groupsToCreate[0].key, K_AL);
});

test('AS4: nothing changed on Monday -> zero changes (safe to run automatically)', () => {
  const current: SyncCurrent = {
    users: [user('1', 'arelis.a@vitasyahc.com', 'Arelis Acosta'), user('2', 'lily.b@passiontocarehc.com', 'Lily Beasly')],
    groups: [{ id: '10', name: 'Any name', managerEmails: ['arelis.a@vitasyahc.com', 'lily.b@passiontocarehc.com'], memberIds: ['1', '2'] }],
  };
  const plan = planAccessSync([person('Ana', ARELIS, LILY), person('Ben', ARELIS, LILY)], resolve, current);
  assert.equal(changeCount(plan), 0);
});

test('AS5: an employee whose managers changed moves; empty old groups are deleted', () => {
  const current: SyncCurrent = {
    users: [user('1', 'arelis.a@vitasyahc.com', 'Arelis Acosta'), user('2', 'lily.b@passiontocarehc.com', 'Lily Beasly')],
    groups: [
      { id: '10', name: 'Arelis Acosta · Lily Beasly', managerEmails: ['arelis.a@vitasyahc.com', 'lily.b@passiontocarehc.com'], memberIds: ['1', '2'] },
      { id: '11', name: 'Old hand-made', managerEmails: ['lily.b@passiontocarehc.com'], memberIds: ['3'] },
    ],
  };
  const plan = planAccessSync([person('Ana', ARELIS, LILY), person('Ben', ARELIS), person('Cora', ARELIS)], resolve, current);
  assert.deepEqual(plan.membersToRemove, [{ groupId: '10', employeeId: '2' }]);
  assert.deepEqual(plan.groupsToDelete, [{ id: '11', name: 'Old hand-made' }]);
  assert.deepEqual(plan.groupsToCreate.map(g => g.name), ['Arelis Acosta']);
  assert.deepEqual(plan.membersToAdd.map(m => m.employeeId).sort(), ['2', '3']);
});

test('AS6: a Monday data problem is reported and that employee keeps their current group', () => {
  const current: SyncCurrent = {
    users: [],
    groups: [{ id: '11', name: 'Marcela Gordon', managerEmails: ['marcela.g@vitasyahc.com'], memberIds: ['1', '2'] }],
  };
  const plan = planAccessSync([
    person('Ana', ['Marcela Gordon', '']), person('Ben', ARELIS, ['Lily Beasly', '']), person('Cora'), person('Zed', ARELIS), person('Dan', ARELIS),
  ], resolve, current);
  assert.deepEqual(plan.skipped.map(s => s.reason).sort(), [
    'Manager "Marcela Gordon" has no email on Monday',
    'Manager 2 "Lily Beasly" has no email on Monday',
    'no manager on Monday',
    'not on the app roster',
  ]);
  assert.deepEqual(plan.groupsToDelete, [], 'the group still holds Ana and Ben, so it stays');
  assert.deepEqual(plan.membersToRemove, []);
});

test('AS7: empty or failed Monday pull -> no deletions at all', () => {
  const current: SyncCurrent = {
    users: [], groups: [{ id: '10', name: 'x', managerEmails: ['arelis.a@vitasyahc.com'], memberIds: ['1'] }],
  };
  assert.equal(changeCount(planAccessSync([], resolve, current)), 0);
  assert.equal(changeCount(planAccessSync([person('Zed', ARELIS)], resolve, current)), 0);
});

test('AS8: managers take their Monday name; super users are never renamed or re-added', () => {
  const current: SyncCurrent = {
    users: [user('5', 'lily.b@passiontocarehc.com', 'Shaquille Withers'), user('6', 'tim.m@vitasyahc.com', 'Timothy Moore', 'super_user')],
    groups: [],
  };
  const plan = planAccessSync([person('Ana', ['Tim Moore', 'Tim.M@vitasyahc.com'], LILY)], resolve, current);
  assert.deepEqual(plan.usersToRename, [{ id: '5', display_name: 'Lily Beasly' }]);
  assert.deepEqual(plan.usersToAdd, []);
});

test('AS9: a deleted group frees its name; duplicate Monday row placed once; repeated manager ranked once', () => {
  const current: SyncCurrent = {
    users: [], groups: [{ id: '3', name: 'Arelis Acosta · Lily Beasly', managerEmails: ['x@x.com'], memberIds: ['9'] }],
  };
  const numResolve = (p: DirectoryPerson) => (p.name === 'Ana' ? (1 as unknown as string) : null);
  const plan = planAccessSync([person('Ana', ARELIS, ARELIS, LILY), person('Ana', ARELIS, LILY)], numResolve, current);
  assert.equal(plan.groupsToCreate[0].name, 'Arelis Acosta · Lily Beasly', 'the clashing old group is being deleted');
  assert.equal(plan.groupsToCreate[0].managers.length, 2);
  assert.deepEqual(plan.membersToAdd, [{ key: K_AL, groupId: '', employeeId: '1' }]);
  assert.deepEqual(managerChain([{ name: '', email: '' }]), { reason: 'no manager on Monday' });
  assert.equal(chainKey([' A@x.com ', '', 'b@x.com']), 'a@x.com > b@x.com');
});
