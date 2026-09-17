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

/**
 * One row of Teramind's Time Records grid (the screen payroll's export file comes from):
 * `{ agent:{agent_id}, period:[startEpochSec, endEpochSec], is_manual, meta:{computer_id} }`.
 * The instants are exact, so the clock text comes from `toClock` and never from the display strings.
 */
export function normalizeTimeRecord(
  row: Record<string, unknown>,
  toClock: (raw: string | number, durationS: number) =>
    { work_date: string; started_et: string; finished_et: string; started_raw: string } | null,
): TeramindSessionSave | null {
  const agentId = agentIdOf(row.agent ?? row.agent_id);
  if (agentId === null) return null;
  const period = Array.isArray(row.period) ? row.period : [];
  const start = Number(period[0]);
  const end = Number(period[1]);
  if (!Number.isFinite(start) || start <= 0) return null;
  let duration = Number.isFinite(end) && end >= start ? end - start : Number(row.duration);
  if (!Number.isFinite(duration) || duration < 0) duration = 0;
  const clock = toClock(Math.trunc(start), Math.trunc(duration));
  if (clock === null) return null;
  const meta = isPlainObject(row.meta) ? row.meta : {};
  const computerId = meta.computer_id;
  return {
    agent_id: agentId,
    employee_id: null,
    work_date: clock.work_date,
    started_et: clock.started_et,
    finished_et: clock.finished_et,
    started_raw: String(Math.trunc(start)),
    duration_s: Math.trunc(duration),
    computer: computerId === null || computerId === undefined ? '' : String(computerId),
    source: 'time_record',
    is_manual: row.is_manual === true || row.is_manual === 1,
  };
}
