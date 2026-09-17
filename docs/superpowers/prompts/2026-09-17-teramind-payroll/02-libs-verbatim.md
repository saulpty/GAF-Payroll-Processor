# Teramind libs — five new pure files, pasted verbatim

Create the five files below **with exactly this content, character for character**. Do not
reformat, rename, reorder, "improve", add imports, or change comments. **No other file may be
created, modified or deleted**, and nothing should import these files yet. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything under `src/components/ui/`.

## Why verbatim

These files were developed test-first outside the app (72 tests). After this change the repo copy is
diffed against this prompt; any difference is treated as a defect and reverted. `teramindTime.ts` is
the only place in the whole app where a timezone conversion happens — a wrong hour changes what
people are paid.

They have zero runtime imports (`import type` only) by design.

### `src/app/lib/teramindTypes.ts`

```ts
// Types shared by the Teramind libs, actions and pages. Types only — no runtime code.
// A "session" is one Teramind login session: a start instant and a length in seconds.
// All *_et fields are US-Eastern wall-clock text `YYYY-MM-DD HH:MM:SS` with no timezone,
// because the payroll code refuses any timestamp that carries one.

/** One agent from Teramind's roster, normalised. */
export type TeramindAgent = { agent_id: number; email: string; name: string; deleted: boolean };

/** One login session exactly as it is saved in `teramind_sessions`. */
export type TeramindSessionSave = {
  agent_id: number;
  employee_id: number | null;
  work_date: string;      // Eastern date of the session START (cross-midnight sessions stay on this date)
  started_et: string;     // 'YYYY-MM-DD HH:MM:SS'
  finished_et: string;    // 'YYYY-MM-DD HH:MM:SS' — may fall on the next calendar day
  started_raw: string;    // the timestamp exactly as Teramind returned it (part of the unique key)
  duration_s: number;
  computer: string;
};

/** A saved session as loaded back for payroll/attendance: the row plus the employee's email. */
export type TeramindSessionRow = TeramindSessionSave & { teramind_email: string };

/** What the payroll file parser hands to processTeramindData — we must produce exactly this. */
export type TeramindRawRow = { email: string; timeStarted: string; timeFinished: string };

/** One chunk of a pull: inclusive date range, `YYYY-MM-DD`. */
export type PullChunk = { from: string; to: string };
```

### `src/app/lib/teramindTime.ts`

```ts
// The only place in this app where a timezone conversion happens. Teramind's API
// returns login-session start timestamps in a format we have not confirmed yet, so
// this lib parses every plausible shape (ISO with Z/offset, epoch seconds/ms, or a
// naive "already Eastern" clock string) and turns it into US-Eastern wall-clock text
// `YYYY-MM-DD HH:MM:SS`. A wrong hour changes what people are paid, so correctness
// around DST matters more than anything else here.

const EPOCH_S_RE = /^\d{10}$/;
const EPOCH_MS_RE = /^\d{13}$/;
const INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/i;
const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?$/;

export function parseInstant(raw: string | number): number | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) return null;
    const digits = Math.abs(raw).toString();
    if (EPOCH_S_RE.test(digits)) return raw * 1000;
    if (EPOCH_MS_RE.test(digits)) return raw;
    return null;
  }
  if (typeof raw !== 'string') return null;
  if (EPOCH_S_RE.test(raw)) return Number(raw) * 1000;
  if (EPOCH_MS_RE.test(raw)) return Number(raw);
  const m = INSTANT_RE.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, frac, offsetRaw] = m;
  const ms = frac ? Number((frac + '000').slice(0, 3)) : 0;
  let offsetMinutes = 0;
  if (offsetRaw.toUpperCase() !== 'Z') {
    const sign = offsetRaw[0] === '-' ? -1 : 1;
    const digitsOnly = offsetRaw.slice(1).replace(':', '');
    const oh = Number(digitsOnly.slice(0, 2));
    const om = Number(digitsOnly.slice(2, 4));
    offsetMinutes = sign * (oh * 60 + om);
  }
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), s ? Number(s) : 0, ms);
  return base - offsetMinutes * 60000;
}

export function isNaiveClock(raw: string): boolean {
  return typeof raw === 'string' && NAIVE_RE.test(raw);
}

function normalizeNaiveClock(raw: string): string {
  const m = NAIVE_RE.exec(raw) as RegExpExecArray;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d} ${h}:${mi}:${s ?? '00'}`;
}

let cachedFormatter: Intl.DateTimeFormat | null = null;
function getFormatter(): Intl.DateTimeFormat {
  if (!cachedFormatter) {
    cachedFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return cachedFormatter;
}

export function easternClock(ms: number): string {
  const parts = getFormatter().formatToParts(new Date(ms));
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const hour = map.hour === '24' ? '00' : map.hour; // guard the hourCycle 'h23' midnight quirk
  return `${map.year}-${map.month}-${map.day} ${hour}:${map.minute}:${map.second}`;
}

export function easternDate(ms: number): string {
  return easternClock(ms).slice(0, 10);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function addSecondsToClock(clock: string, seconds: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(clock) as RegExpExecArray;
  const [, y, mo, d, h, mi, s] = m;
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const next = new Date(base + seconds * 1000);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())} ${pad2(next.getUTCHours())}:${pad2(next.getUTCMinutes())}:${pad2(next.getUTCSeconds())}`;
}

export function addDays(ymd: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd) as RegExpExecArray;
  const [, y, mo, d] = m;
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  const next = new Date(base + n * 86400000);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

export function hasTimezone(s: string): boolean {
  return /Z$/i.test(s) || /[T ]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2})/.test(s);
}

export function sessionClock(
  raw: string | number,
  durationS: number,
): { work_date: string; started_et: string; finished_et: string; started_raw: string } | null {
  const dur = Number.isFinite(durationS) && durationS > 0 ? Math.trunc(durationS) : 0;
  const ms = parseInstant(raw);
  if (ms !== null) {
    const started_et = easternClock(ms);
    const finished_et = easternClock(ms + dur * 1000);
    return { work_date: started_et.slice(0, 10), started_et, finished_et, started_raw: String(raw) };
  }
  if (typeof raw === 'string' && isNaiveClock(raw)) {
    const started_et = normalizeNaiveClock(raw);
    const finished_et = addSecondsToClock(started_et, dur);
    return { work_date: started_et.slice(0, 10), started_et, finished_et, started_raw: String(raw) };
  }
  return null;
}
```

### `src/app/lib/teramindRows.ts`

```ts
// Tolerant readers for Teramind API responses. The exact response shapes Teramind will hand us
// are not confirmed yet, so these accept several plausible wrappers and field names rather than
// assuming one. Also links Teramind "agents" (login accounts) to our employees by email, and
// normalizes one raw login-session row into the shape we save to teramind_sessions. A time
// conversion is injected (normalizeSession's `toClock` param) rather than imported.

import type { TeramindAgent, TeramindSessionSave } from './teramindTypes.ts';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asRowArray(arr: unknown): Record<string, unknown>[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isPlainObject);
}

export function unwrapRows(resp: unknown): Record<string, unknown>[] {
  if (Array.isArray(resp)) return asRowArray(resp);
  if (isPlainObject(resp)) {
    if (Array.isArray(resp.data)) return asRowArray(resp.data);
    if (Array.isArray(resp.rows)) return asRowArray(resp.rows);
    if (Array.isArray(resp.result)) return asRowArray(resp.result);
    if (isPlainObject(resp.data) && Array.isArray(resp.data.rows)) return asRowArray(resp.data.rows);
  }
  return [];
}

function toPositiveInt(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === 'string') {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export function agentIdOf(v: unknown): number | null {
  if (Array.isArray(v)) return v.length === 0 ? null : agentIdOf(v[0]);
  if (isPlainObject(v)) {
    if ('id' in v) return toPositiveInt(v.id);
    if ('agent_id' in v) return toPositiveInt(v.agent_id);
    return null;
  }
  return toPositiveInt(v);
}

export function normalizeAgent(row: Record<string, unknown>): TeramindAgent | null {
  const id = toPositiveInt(row.agent_id) ?? toPositiveInt(row.id);
  if (id === null) return null;

  let email = '';
  for (const c of [row.email, row.email_address, row.login, row.username, row.user_email]) {
    if (typeof c === 'string' && c.trim() !== '' && c.includes('@')) {
      email = c.trim().toLowerCase();
      break;
    }
  }

  let name = '';
  if (typeof row.name === 'string' && row.name.trim() !== '') {
    name = row.name.trim();
  } else {
    const first = typeof row.first_name === 'string' ? row.first_name : '';
    const last = typeof row.last_name === 'string' ? row.last_name : '';
    name = `${first} ${last}`.trim();
  }

  const d = row.deleted;
  const deleted = d === true || d === 1 || d === '1' || d === 'true';

  return { agent_id: id, email, name, deleted };
}

export function linkAgents(
  agents: TeramindAgent[],
  employees: { id: number; teramind_email: string }[],
): { links: { agent_id: number; employee_id: number }[]; unlinkedEmployees: number[]; multiAgentEmployees: number[] } {
  const norm = (s: string) => s.trim().toLowerCase();

  const empByEmail = new Map<string, number>();
  const localPartMap = new Map<string, Set<number>>();
  for (const e of employees) {
    const email = norm(e.teramind_email);
    empByEmail.set(email, e.id);
    const local = email.split('@')[0];
    if (!local) continue;
    if (!localPartMap.has(local)) localPartMap.set(local, new Set());
    localPartMap.get(local)!.add(e.id);
  }

  const links: { agent_id: number; employee_id: number }[] = [];
  const linkedEmployeeIds = new Set<number>();
  const agentsPerEmployee = new Map<number, Set<number>>();

  for (const agent of agents) {
    const email = norm(agent.email);
    if (!email) continue;
    let employeeId = empByEmail.get(email) ?? null;
    if (employeeId === null) {
      const local = email.split('@')[0];
      const candidates = localPartMap.get(local);
      if (candidates && candidates.size === 1) employeeId = [...candidates][0];
    }
    if (employeeId === null) continue;
    links.push({ agent_id: agent.agent_id, employee_id: employeeId });
    linkedEmployeeIds.add(employeeId);
    if (!agentsPerEmployee.has(employeeId)) agentsPerEmployee.set(employeeId, new Set());
    agentsPerEmployee.get(employeeId)!.add(agent.agent_id);
  }

  const unlinkedEmployees = employees.map((e) => e.id).filter((id) => !linkedEmployeeIds.has(id));
  const multiAgentEmployees = [...agentsPerEmployee.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([empId]) => empId);

  return { links, unlinkedEmployees, multiAgentEmployees };
}

export function normalizeSession(
  row: Record<string, unknown>,
  toClock: (
    raw: string | number,
    durationS: number,
  ) => { work_date: string; started_et: string; finished_et: string; started_raw: string } | null,
): TeramindSessionSave | null {
  const agentId = agentIdOf(row.agent ?? row.agent_id);
  if (agentId === null) return null;

  const rawStart = row.timestamp ?? row.start ?? row.time_started;
  if (typeof rawStart !== 'string' && typeof rawStart !== 'number') return null;

  const rawDuration = row.time_s ?? row.duration;
  let durationS = 0;
  if (typeof rawDuration === 'number' && Number.isFinite(rawDuration)) {
    durationS = rawDuration;
  } else if (typeof rawDuration === 'string') {
    const n = Number(rawDuration);
    durationS = Number.isFinite(n) ? n : 0;
  }

  const clock = toClock(rawStart, durationS);
  if (clock === null) return null;

  let computer = '';
  const rawComputer = row.computer;
  if (typeof rawComputer === 'string') {
    computer = rawComputer;
  } else if (Array.isArray(rawComputer)) {
    // Teramind sends [id, name] (confirmed by the 2026-09-17 probe): take the first string.
    const first = rawComputer.find((x: unknown) => typeof x === 'string') ?? rawComputer[0];
    if (typeof first === 'string') computer = first;
    else if (isPlainObject(first) && typeof first.name === 'string') computer = first.name;
  } else if (isPlainObject(rawComputer) && typeof rawComputer.name === 'string') {
    computer = rawComputer.name;
  }

  return {
    agent_id: agentId,
    employee_id: null,
    work_date: clock.work_date,
    started_et: clock.started_et,
    finished_et: clock.finished_et,
    started_raw: clock.started_raw,
    duration_s: durationS,
    computer,
  };
}
```

### `src/app/lib/teramindPunches.ts`

```ts
// Turns saved Teramind sessions into the flat {email, timeStarted, timeFinished} rows the
// unchanged payroll file parser expects (sessionsToRawRows), skipping and counting anything
// with no email or a malformed clock string (sessionsToRawRowsReport). foldDays does the same
// entry/exit fold the payroll parser does, but on plain strings, for a comparison screen only
// — payroll itself never calls foldDays.

import type { TeramindSessionRow, TeramindRawRow } from './teramindTypes.ts';

const CLOCK_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function sessionsToRawRowsReport(
  rows: TeramindSessionRow[],
): { rows: TeramindRawRow[]; skippedNoEmail: number; skippedBadClock: number } {
  const out: TeramindRawRow[] = [];
  let skippedNoEmail = 0;
  let skippedBadClock = 0;

  for (const r of rows) {
    const email = (r.teramind_email ?? '').trim().toLowerCase();
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (!CLOCK_RE.test(r.started_et) || !CLOCK_RE.test(r.finished_et)) {
      skippedBadClock++;
      continue;
    }
    out.push({ email, timeStarted: r.started_et, timeFinished: r.finished_et });
  }

  return { rows: out, skippedNoEmail, skippedBadClock };
}

export function sessionsToRawRows(rows: TeramindSessionRow[]): TeramindRawRow[] {
  return sessionsToRawRowsReport(rows).rows;
}

export function foldDays(rows: TeramindRawRow[]): Map<string, Map<string, { entry: string; exit: string }>> {
  const result = new Map<string, Map<string, { entry: string; exit: string }>>();

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    const day = row.timeStarted.slice(0, 10);
    if (!result.has(email)) result.set(email, new Map());
    const byDay = result.get(email)!;
    const existing = byDay.get(day);
    if (!existing) {
      byDay.set(day, { entry: row.timeStarted, exit: row.timeFinished });
    } else {
      if (row.timeStarted < existing.entry) existing.entry = row.timeStarted;
      if (row.timeFinished > existing.exit) existing.exit = row.timeFinished;
    }
  }

  return result;
}
```

### `src/app/lib/teramindPull.ts`

```ts
// Splits a date range into inclusive chunks of at most `maxDays` for pulling Teramind sessions,
// extending one day past `to` to catch sessions that start after midnight Eastern (and sessions
// that cross midnight at the end of a pay period). Also: detecting a truncated API page,
// computing the rolling "keep fresh" range, and checking whether past pull-log rows already
// cover a date range. All date math is done in whole days via Date.UTC on parsed integers.

import type { PullChunk } from './teramindTypes.ts';

function parseYMD(s: string): [number, number, number] {
  const parts = s.split('-').map((p) => Number.parseInt(p, 10));
  return [parts[0], parts[1], parts[2]];
}

function toDayNumber(s: string): number {
  const [y, m, d] = parseYMD(s);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function fromDayNumber(day: number): string {
  const dt = new Date(day * 86400000);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const d = dt.getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function pullChunks(from: string, to: string, maxDays = 7): PullChunk[] {
  if (from > to) return [];

  const fromDay = toDayNumber(from);
  const toDay = toDayNumber(to) + 1; // catches cross-midnight sessions at the end of the range
  const chunks: PullChunk[] = [];

  let start = fromDay;
  while (start <= toDay) {
    const end = Math.min(start + maxDays - 1, toDay);
    chunks.push({ from: fromDayNumber(start), to: fromDayNumber(end) });
    start = end + 1;
  }

  return chunks;
}

export function isTruncated(rowCount: number, limit: number): boolean {
  return rowCount >= limit;
}

export function keepFreshRange(todayEastern: string): PullChunk {
  const today = toDayNumber(todayEastern);
  return { from: fromDayNumber(today - 1), to: todayEastern };
}

export function coversRange(
  log: { date_from: string; date_to: string; error: string | null; truncated: boolean }[],
  from: string,
  to: string,
): boolean {
  if (from > to) return true;

  const covered = new Set<number>();
  for (const entry of log) {
    if (entry.error || entry.truncated) continue;
    const start = toDayNumber(entry.date_from);
    const end = toDayNumber(entry.date_to);
    for (let d = start; d <= end; d++) covered.add(d);
  }

  const fromDay = toDayNumber(from);
  const toDay = toDayNumber(to);
  for (let d = fromDay; d <= toDay; d++) {
    if (!covered.has(d)) return false;
  }

  return true;
}
```

## Acceptance

1. Exactly these five files were created under `src/app/lib/`; nothing else changed.
2. Each file is byte-for-byte the content above.
3. The app still builds; no page imports these files yet.
