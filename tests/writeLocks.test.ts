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
    const locks = src.split(LOCK).length - 1;
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
    assert.doesNotMatch(src, /assert_super\([^)]*viewAs/i, f);
    assert.doesNotMatch(src, /'\{\{\s*user\.email/, f);
  }
});

test('WL6: the two unused lookup actions that could not carry the lock are gone', () => {
  for (const f of ['deleteLookup.ts', 'upsertLookup.ts']) assert.equal(existsSync(new URL(f, dir)), false, f);
});
