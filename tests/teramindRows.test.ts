import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  unwrapRows,
  agentIdOf,
  normalizeAgent,
  linkAgents,
  normalizeSession,
} from '../src/app/lib/teramindRows.ts';

const SRC_PATH = fileURLToPath(new URL('../src/app/lib/teramindRows.ts', import.meta.url));

test('source has no toISOString and only import-type imports', () => {
  const src = readFileSync(SRC_PATH, 'utf8');
  assert.equal(/toISOString/.test(src), false);
  const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
  assert.ok(importLines.length > 0);
  for (const line of importLines) assert.match(line, /^\s*import type\b/);
});

test('unwrapRows accepts a bare array and drops non-object elements', () => {
  assert.deepEqual(unwrapRows([{ a: 1 }, 'x', 2, null, { b: 2 }]), [{ a: 1 }, { b: 2 }]);
});

test('unwrapRows accepts {data:[...]}', () => {
  assert.deepEqual(unwrapRows({ data: [{ a: 1 }] }), [{ a: 1 }]);
});

test('unwrapRows accepts {rows:[...]}', () => {
  assert.deepEqual(unwrapRows({ rows: [{ a: 1 }] }), [{ a: 1 }]);
});

test('unwrapRows accepts {result:[...]}', () => {
  assert.deepEqual(unwrapRows({ result: [{ a: 1 }] }), [{ a: 1 }]);
});

test('unwrapRows accepts {data:{rows:[...]}}', () => {
  assert.deepEqual(unwrapRows({ data: { rows: [{ a: 1 }] } }), [{ a: 1 }]);
});

test('unwrapRows returns [] for anything else', () => {
  assert.deepEqual(unwrapRows({ foo: 'bar' }), []);
  assert.deepEqual(unwrapRows(null), []);
  assert.deepEqual(unwrapRows('nope'), []);
  assert.deepEqual(unwrapRows(42), []);
  assert.deepEqual(unwrapRows(undefined), []);
});

test('agentIdOf handles all documented shapes', () => {
  assert.equal(agentIdOf(42), 42);
  assert.equal(agentIdOf('42'), 42);
  assert.equal(agentIdOf([42]), 42);
  assert.equal(agentIdOf(['42']), 42);
  assert.equal(agentIdOf([{ id: 42 }]), 42);
  assert.equal(agentIdOf({ id: 42 }), 42);
  assert.equal(agentIdOf({ agent_id: 42 }), 42);
});

test('agentIdOf rejects non-numeric, NaN, zero, and negative values', () => {
  assert.equal(agentIdOf('abc'), null);
  assert.equal(agentIdOf(Number.NaN), null);
  assert.equal(agentIdOf(0), null);
  assert.equal(agentIdOf(-5), null);
  assert.equal(agentIdOf(undefined), null);
  assert.equal(agentIdOf([]), null);
  assert.equal(agentIdOf({}), null);
});

test('normalizeAgent builds id/email/name/deleted from a full row', () => {
  const a = normalizeAgent({ agent_id: 7, email: '  Foo@Bar.com ', name: ' Foo Bar ', deleted: '1' });
  assert.deepEqual(a, { agent_id: 7, email: 'foo@bar.com', name: 'Foo Bar', deleted: true });
});

test('normalizeAgent falls back through email fields and first/last name', () => {
  const a = normalizeAgent({ id: 3, login: 'x@y.com', first_name: 'A', last_name: 'B', deleted: 0 });
  assert.deepEqual(a, { agent_id: 3, email: 'x@y.com', name: 'A B', deleted: false });
});

test('normalizeAgent uses empty email when no candidate contains @', () => {
  const a = normalizeAgent({ id: 3, username: 'noatsign' });
  assert.equal(a?.email, '');
});

test('normalizeAgent recognizes deleted truthy/falsy forms', () => {
  for (const v of [true, 1, '1', 'true']) {
    assert.equal(normalizeAgent({ id: 1, deleted: v })?.deleted, true);
  }
  for (const v of [false, 0, '0', 'false', undefined]) {
    assert.equal(normalizeAgent({ id: 1, deleted: v })?.deleted, false);
  }
});

test('normalizeAgent returns null with no usable id', () => {
  assert.equal(normalizeAgent({ email: 'x@y.com' }), null);
});

test('linkAgents matches exact emails, many agents to one employee', () => {
  const agents = [
    { agent_id: 1, email: 'a@x.com', name: '', deleted: false },
    { agent_id: 2, email: 'A@X.com', name: '', deleted: true },
  ];
  const employees = [{ id: 10, teramind_email: 'a@x.com' }];
  const { links, unlinkedEmployees, multiAgentEmployees } = linkAgents(agents, employees);
  assert.deepEqual(
    links.slice().sort((x, y) => x.agent_id - y.agent_id),
    [{ agent_id: 1, employee_id: 10 }, { agent_id: 2, employee_id: 10 }],
  );
  assert.deepEqual(unlinkedEmployees, []);
  assert.deepEqual(multiAgentEmployees, [10]);
});

test('linkAgents matches by unique local-part when no exact email match exists', () => {
  const agents = [{ agent_id: 5, email: 'eddy.c@eddysmacbookpro', name: '', deleted: false }];
  const employees = [{ id: 20, teramind_email: 'eddy.c@company.com' }];
  const { links } = linkAgents(agents, employees);
  assert.deepEqual(links, [{ agent_id: 5, employee_id: 20 }]);
});

test('linkAgents refuses a local-part match when more than one employee shares it', () => {
  const agents = [{ agent_id: 5, email: 'eddy.c@eddysmacbookpro', name: '', deleted: false }];
  const employees = [
    { id: 20, teramind_email: 'eddy.c@company.com' },
    { id: 21, teramind_email: 'eddy.c@othercompany.com' },
  ];
  const { links, unlinkedEmployees } = linkAgents(agents, employees);
  assert.deepEqual(links, []);
  assert.deepEqual(unlinkedEmployees.slice().sort(), [20, 21]);
});

test('linkAgents lists employees with no matching agent as unlinked', () => {
  const employees = [{ id: 30, teramind_email: 'nobody@x.com' }];
  const { links, unlinkedEmployees } = linkAgents([], employees);
  assert.deepEqual(links, []);
  assert.deepEqual(unlinkedEmployees, [30]);
});

test('linkAgents still links deleted agents', () => {
  const agents = [{ agent_id: 9, email: 'gone@x.com', name: '', deleted: true }];
  const employees = [{ id: 40, teramind_email: 'gone@x.com' }];
  const { links } = linkAgents(agents, employees);
  assert.deepEqual(links, [{ agent_id: 9, employee_id: 40 }]);
});

test('normalizeSession reads agent, clock (via injected toClock), duration, and computer', () => {
  const clock = {
    work_date: '2026-01-01',
    started_et: '2026-01-01 08:00:00',
    finished_et: '2026-01-01 12:00:00',
    started_raw: 'RAW',
  };
  const toClock = (raw: string | number, dur: number) => {
    assert.equal(raw, 'RAW');
    assert.equal(dur, 120);
    return clock;
  };
  const row = { agent: [{ id: 9 }], timestamp: 'RAW', time_s: 120, computer: [{ name: 'PC1' }] };
  const session = normalizeSession(row, toClock);
  assert.deepEqual(session, {
    agent_id: 9,
    employee_id: null,
    work_date: '2026-01-01',
    started_et: '2026-01-01 08:00:00',
    finished_et: '2026-01-01 12:00:00',
    started_raw: 'RAW',
    duration_s: 120,
    computer: 'PC1',
  });
});

test('normalizeSession returns null when agent is missing', () => {
  const session = normalizeSession(
    { timestamp: 'x', time_s: 1 },
    () => ({ work_date: 'd', started_et: 's', finished_et: 'f', started_raw: 'r' }),
  );
  assert.equal(session, null);
});

test('normalizeSession returns null when toClock returns null', () => {
  const session = normalizeSession({ agent_id: 1, timestamp: 'x' }, () => null);
  assert.equal(session, null);
});

test('normalizeSession falls back on start/duration/computer fields and defaults bad duration to 0', () => {
  const clock = { work_date: 'd', started_et: 's', finished_et: 'f', started_raw: 'r' };
  const session = normalizeSession(
    { agent_id: 2, start: 'x', duration: 'not-a-number', computer: { name: 'PC2' } },
    () => clock,
  );
  assert.equal(session?.duration_s, 0);
  assert.equal(session?.computer, 'PC2');
});

test('real shapes from the 2026-09-17 probe: agent [id,name,email], computer [id,name]', () => {
  const row = { agent: [374, 'Some Person', 'Some.P@example.com'], computer: [12, 'somep-laptop'],
    date: '2026-08-12', time_s: 17867, timestamp: '2026-08-12T08:54:45-04:00' };
  assert.equal(agentIdOf(row.agent), 374);
  const s = normalizeSession(row, (raw, d) => ({ work_date: '2026-08-12', started_et: '2026-08-12 08:54:45',
    finished_et: '2026-08-12 13:52:32', started_raw: String(raw) }));
  assert.equal(s!.agent_id, 374);
  assert.equal(s!.computer, 'somep-laptop');
  assert.equal(s!.duration_s, 17867);
  const a = normalizeAgent({ agent_id: 374, name: 'Some Person', email_address: 'Some.P@example.com', deleted: 0, online: false });
  assert.deepEqual(a, { agent_id: 374, email: 'some.p@example.com', name: 'Some Person', deleted: false });
});
