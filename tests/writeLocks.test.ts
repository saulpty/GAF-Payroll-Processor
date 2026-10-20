// 2026-09-23 — every change-data action on the main database checks, inside the
// database, that the real signed-in person is an active super user. The browser
// cannot choose that person: UI Bakery sends {{ user.email }} as a sealed
// placeholder and fills it in on the server (verified by replaying a request with
// a fake email — the server ignored it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const dir = new URL('../src/actions/', import.meta.url);
const LOCK = 'public.assert_super({{ user.email }}::text)';
// 2026-10-20: the 11 data-copy actions use the narrower lock that also admits users flagged
// can_refresh_sync (prompt 2026-10-20-manager-refresh 01/02). Nothing else may.
const SYNC_LOCK = 'public.assert_sync_writer({{ user.email }}::text)';
const SYNC_WRITERS = [
  'claimSyncRun.ts', 'upsertSyncLog.ts', 'upsertMondaySyncLog.ts',
  'upsertMondayRequests.ts', 'upsertMondayAttendanceForms.ts', 'upsertMondayContracts.ts',
  'updateMondayRequestsDeleted.ts', 'updateMondayAttendanceFormsDeleted.ts', 'updateMondayContractsDeleted.ts',
  'upsertTeramindSessions.ts', 'upsertTeramindPullLog.ts',
];
const WRITE = /\bINSERT\s+INTO\b|\bUPDATE\s+[\w.]+\s+(?:\w+\s+)?SET\b|\bDELETE\s+FROM\b/gi;

const actions = readdirSync(dir).filter(f => f.endsWith('.ts')).map(f => ({ f, src: readFileSync(new URL(f, dir), 'utf8') }));
const mainDbWrites = actions.filter(a => /datasourceName:\s*'GAF Planilla DB'/.test(a.src) && a.src.match(WRITE));

test('WL1: the lock function exists as a migration, raises loudly, and is STABLE', () => {
  const mig = readdirSync(new URL('../src/migrations/', import.meta.url)).find(f => /assert_super/.test(f));
  assert.ok(mig, 'a migration named *assert_super*.sql');
  const sql = readFileSync(new URL(`../src/migrations/${mig}`, import.meta.url), 'utf8');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.assert_super\(caller_email text\)/);
  assert.match(sql, /\bSTABLE\b/);
  assert.match(sql, /RAISE EXCEPTION/);
  assert.match(sql, /role = 'super_user'/);
  assert.match(sql, /\bactive\b/);
});

test('WL2: there are main-database write actions to check (sanity)', () => {
  assert.ok(mainDbWrites.length >= 55, `found ${mainDbWrites.length}`);
});

test('WL3: every main-database write action carries the lock at least once per write statement', () => {
  const missing: string[] = [];
  for (const { f, src } of mainDbWrites) {
    const writes = (src.match(WRITE) || []).length;
    const locks = src.split(LOCK).length - 1 + (SYNC_WRITERS.includes(f) ? src.split(SYNC_LOCK).length - 1 : 0);
    if (locks < writes) missing.push(`${f} (${writes} writes, ${locks} locks)`);
  }
  assert.deepEqual(missing, []);
});

test('WL4: no main-database write uses INSERT … VALUES (it cannot carry the lock)', () => {
  const bad = mainDbWrites.filter(a => /\bVALUES\s*\(/i.test(a.src)).map(a => a.f);
  assert.deepEqual(bad, []);
});

test('WL5: the lock always uses the real signed-in email, never the view-as one, and never in quotes', () => {
  for (const { f, src } of mainDbWrites) {
    assert.doesNotMatch(src, /assert_(super|sync_writer)\([^)]*viewAs/i, f);
    assert.doesNotMatch(src, /'\{\{\s*user\.email/, f);
  }
});

test('WL6: the two unused lookup actions that could not carry the lock are gone', () => {
  for (const f of ['deleteLookup.ts', 'upsertLookup.ts']) assert.equal(existsSync(new URL(f, dir)), false, f);
});

test('WL7: only the 11 data-copy actions use the narrower sync lock, and each uses it', () => {
  const users = actions.filter(a => a.src.includes('assert_sync_writer')).map(a => a.f).sort();
  assert.deepEqual(users, [...SYNC_WRITERS].sort());
  for (const f of SYNC_WRITERS) {
    const src = actions.find(a => a.f === f)!.src;
    assert.ok(src.includes(SYNC_LOCK), f);
    assert.doesNotMatch(src, /assert_super/, `${f}: one lock, not two`);
  }
});

test('WL8: the sync lock admits super users and flagged users only, and raises loudly', () => {
  const mig = readdirSync(new URL('../src/migrations/', import.meta.url)).find(f => f.endsWith('_refresh_sync_users.sql'));
  assert.ok(mig, 'migration <n>_refresh_sync_users.sql is missing');
  const sql = readFileSync(new URL(`../src/migrations/${mig}`, import.meta.url), 'utf8');
  assert.ok(sql.includes("CREATE OR REPLACE FUNCTION public.assert_sync_writer(caller_email text)"), "CREATE OR REPLACE FUNCTION public.assert_sync_writer(caller_email text)");
  assert.match(sql, /\bSTABLE\b/);
  assert.match(sql, /RAISE EXCEPTION/);
  assert.ok(sql.includes("AND u.active"), "AND u.active");
  assert.ok(sql.includes("u.role = 'super_user' OR u.can_refresh_sync"), "u.role = 'super_user' OR u.can_refresh_sync");
  assert.ok(sql.includes("can_refresh_sync BOOLEAN NOT NULL DEFAULT false"), "can_refresh_sync BOOLEAN NOT NULL DEFAULT false");
});
