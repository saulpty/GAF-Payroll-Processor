// The global Manager filter (Attendance, PTO, Contracts) follows the access groups, not the
// old employees.manager text. Picking a manager shows everyone that manager covers at any rank.
import test from 'node:test';
import assert from 'node:assert/strict';
import { managerNamesOf, managerOptions, matchesManager } from '../src/app/lib/managerFilter.ts';

const navvad = { manager: 'Arelis Acosta', managers: 'Arelis Acosta|Lily Beasly|Chaya Lichy|Shari Jurado' };
const arelis = { manager: 'Tim Moore', managers: 'Tim Moore|Lily Beasly' };
const loose  = { manager: 'Old Name', managers: '' };

test('MF1: every manager of the employee, any rank; direct manager as fallback', () => {
  assert.deepEqual(managerNamesOf(navvad), ['Arelis Acosta', 'Lily Beasly', 'Chaya Lichy', 'Shari Jurado']);
  assert.deepEqual(managerNamesOf(loose), ['Old Name']);
  assert.deepEqual(managerNamesOf({ manager: null, managers: null }), []);
});

test('MF2: options are the unique, sorted union across visible employees', () => {
  assert.deepEqual(managerOptions([navvad, arelis]), ['Arelis Acosta', 'Chaya Lichy', 'Lily Beasly', 'Shari Jurado', 'Tim Moore']);
});

test('MF3: a secondary manager matches; no selection matches everyone', () => {
  assert.equal(matchesManager(navvad, 'Lily Beasly'), true);
  assert.equal(matchesManager(arelis, 'Lily Beasly'), true);
  assert.equal(matchesManager(arelis, 'Chaya Lichy'), false);
  assert.equal(matchesManager(loose, ''), true);
  assert.equal(matchesManager(loose, null), true);
});
