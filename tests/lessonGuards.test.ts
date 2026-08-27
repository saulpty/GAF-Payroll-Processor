import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── L1-L4: the traps in docs/LESSONS.md, enforced ────────────────────────────
// Every defect below has already cost real time on this project, and each one
// is trivially greppable. Until 2026-08-26 all four were enforced by a human
// remembering to run a grep. The params-wrapper bit three times that way.
//
// L3 and L4 are RATCHETS, not clean assertions: they carry an allowlist of the
// sites that exist today. A new occurrence fails the suite, and so does an
// allowlist entry that no longer matches — so the list has to shrink as the
// fixes land, and cannot quietly go stale.

function walkTs(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTs(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function countMatches(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length;
}

// ── L1: action params go flat, never wrapped ─────────────────────────────────
// useLoadAction(action, default, { params: {...} }) makes every {{params.x}}
// undefined. There is no error — the query just returns nothing, or worse,
// returns partially-correct data. Three occurrences: the original, PtoTable.tsx,
// and FilterBar.tsx (found 2026-08-25, had silently hidden the Action Required
// tab counts for months). LESSONS.md prescribes exactly this grep.

test('L1: no useLoadAction call wraps its params in an extra object', () => {
  const files = walkTs('src/app');
  assert.ok(files.length > 0, 'expected files under src/app');

  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (/\{\s*params\s*:/.test(src)) offenders.push(f);
  }

  assert.deepEqual(
    offenders,
    [],
    `params must be passed flat: useLoadAction(action, default, { periodName }) ` +
      `not { params: { periodName } }. Offending files: ${offenders.join(', ')}`,
  );
});

// ── L2: {{params.x}} is substituted whole ────────────────────────────────────
// UI Bakery replaces the whole moustache, not a fragment inside a string. On
// 2026-08-11 a {{params.boardId}} placed inside a quoted GraphQL string reached
// Monday.com verbatim and returned PARSING_ERROR. The diff was clean and all
// tests passed; only loading the page found it. This test is the check that
// CHANGE-LOOP.md says no diff and no test could make — it is narrow (it only
// catches the quoted-string shape) but that shape is the one that bit.

test('L2: no {{params.x}} sits inside a quoted string in an action body', () => {
  const files = walkTs('src/actions');
  assert.ok(files.length > 0, 'expected files under src/actions');

  const offenders: string[] = [];
  for (const f of files) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      // A single- or double-quoted run that contains a {{params.…}} inside it.
      // The sanctioned concatenation form -- {{ '%' + params.x + '%' }} -- puts
      // the quotes INSIDE the moustache, so it does not match.
      if (/'[^'\n]*\{\{\s*params\.[^}]*\}\}[^'\n]*'/.test(line)) offenders.push(`${f}: ${line.trim()}`);
      else if (/"[^"\n]*\{\{\s*params\.[^}]*\}\}[^"\n]*"/.test(line)) offenders.push(`${f}: ${line.trim()}`);
    }
  }

  assert.deepEqual(offenders, [], `{{params.x}} must not be quoted:\n${offenders.join('\n')}`);
});

// ── L3: the timezone invariant, as a shrinking ratchet ───────────────────────
// Panama is UTC-5 all year, so toISOString().slice(0,10) returns TOMORROW from
// 19:00 local. AGENTS.md and CLAUDE.md both forbid it; "today" is toLocalYMD().
// Eight sites existed on 2026-08-26. Some are genuinely harmless (symmetric
// UTC-in/UTC-out) and some shift the Attendance date window by a day; the
// allowlist records the count per file so a NEW one cannot slip in unnoticed.
// As each is fixed, drop its count here.

// Tightened 2026-08-26: GlobalFilterContext.tsx (1) and Attendance.tsx (2) now
// use toLocalYMD and are gone from this list. Four remain, all deliberate:
const TO_ISO_ALLOWLIST: Record<string, number> = {
  // :155 and :202 coerce an already-anchored Date, not live "now". A third use
  // at :245 IS the forbidden "today" pattern and is kept on purpose - see the
  // NOTE above it. This module must stay import-free or `node --test` cannot
  // resolve it, which broke the suite when the import was tried.
  'src/app/lib/attendanceStats.ts': 3,
  'src/app/lib/ptoAccrual.ts': 1, // fromDayNumber - TZ-invariant by construction
  'src/app/pages/attendance/AttendancePanel.tsx': 1, // Date coercion - harmless
};

test('L3: no new toISOString date-slicing appears, and the allowlist stays honest', () => {
  const re = /toISOString\(\)/g;
  const actual: Record<string, number> = {};

  for (const f of walkTs('src')) {
    const n = countMatches(readFileSync(f, 'utf8'), re);
    if (n > 0) actual[f.replace(/\\/g, '/')] = n;
  }

  for (const [file, count] of Object.entries(actual)) {
    const allowed = TO_ISO_ALLOWLIST[file];
    assert.ok(
      allowed !== undefined,
      `${file} uses toISOString(). Dates are YYYY-MM-DD strings; use toLocalYMD ` +
        `from classificationEngine. If this is genuinely safe, add it to TO_ISO_ALLOWLIST with a reason.`,
    );
    assert.equal(
      count,
      allowed,
      `${file} has ${count} toISOString() uses, allowlist says ${allowed}. ` +
        `If you fixed one, lower the number; if you added one, don't.`,
    );
  }

  for (const file of Object.keys(TO_ISO_ALLOWLIST)) {
    assert.ok(
      actual[file] !== undefined,
      `${file} is in TO_ISO_ALLOWLIST but no longer uses toISOString(). ` +
        `Remove the entry - the ratchet only tightens.`,
    );
  }
});

// ── L4: ProcessPayroll's Monday id fallbacks, ratcheted ──────────────────────
// H4 in hardcoding.test.ts checks the admin/PTO code, but its file list has
// never included ProcessPayroll.tsx -- which holds 14 board/column ids as silent
// cfgGet(key, '<literal>') fallbacks. CLAUDE.md:65 and BACKLOG.md both claim
// H4/H5 guard the whole codebase; for the file that actually drives payroll
// classification, they never did. A missing config row means a stale id is used
// with no error, which is the exact shape of the manager-column incident.
// ProcessPayroll.tsx is a protected file, so this is a ratchet rather than a
// ban until the fail-loud change lands.

const PROCESS_PAYROLL = 'src/app/pages/ProcessPayroll.tsx';
const CFG_FALLBACK_COUNT = 14;

test('L4: ProcessPayroll gains no new hardcoded Monday id fallback', () => {
  assert.ok(existsSync(PROCESS_PAYROLL), `${PROCESS_PAYROLL} should exist`);
  const src = readFileSync(PROCESS_PAYROLL, 'utf8');

  // cfgGet('some_key', '<literal fallback>')
  const n = countMatches(src, /cfgGet\(\s*'[a-z0-9_]+'\s*,\s*'[^']+'\s*\)/g);

  assert.ok(
    n <= CFG_FALLBACK_COUNT,
    `${PROCESS_PAYROLL} has ${n} cfgGet fallback literals, was ${CFG_FALLBACK_COUNT}. ` +
      `A missing config row would silently use a stale Monday id. Read the key and fail loudly instead.`,
  );
  assert.equal(
    n,
    CFG_FALLBACK_COUNT,
    `${PROCESS_PAYROLL} now has ${n} cfgGet fallback literals, down from ${CFG_FALLBACK_COUNT}. ` +
      `Good - lower CFG_FALLBACK_COUNT to ${n} so the ratchet holds.`,
  );
});

// ── L5: a day off with no punches must never produce a row ───────────────────
// The third weekend/off-day incident, 2026-08-27. The engine gated correctly on
// work_days but then asked the wrong question inside the gate: "is there a
// form?" instead of "are there punches?". permissionCoversDate is a plain
// inclusive string range, so a permission running Friday to Monday matched the
// Saturday and Sunday between it and manufactured a YELLOW row on each, with
// empty Entry and Exit. Ten such rows reached an operator's queue, eight of
// which he resolved before anyone noticed.
//
// weekendSchedule.test.ts W2/W3/W9 pin the BEHAVIOUR by running the engine.
// This is the structural companion: it fails if the punch guard is ever removed
// or if a results.push is added ahead of it, which is the specific edit that
// would silently reintroduce the bug.

const ENGINE = 'src/app/lib/classificationEngine.ts';

test('L5: the off-day branch bails on missing punches before it can push a row', () => {
  assert.ok(existsSync(ENGINE), `${ENGINE} should exist`);
  const src = readFileSync(ENGINE, 'utf8');

  const gate = src.indexOf('if (!isScheduledWorkDay(');
  assert.ok(gate >= 0, `${ENGINE} no longer gates on isScheduledWorkDay — the work-day check is gone.`);

  // The branch runs from the gate to the `continue` that closes it.
  const branch = src.slice(gate, src.indexOf('continue;', gate) + 'continue;'.length);

  const guard = branch.search(/if\s*\(\s*!\s*tmData\s*\)\s*continue\s*;/);
  assert.ok(
    guard >= 0,
    `The off-day branch must start with "if (!tmData) continue;". Without it a form ` +
      `whose date range merely spans a day off manufactures a row with no punches on it.`,
  );

  const push = branch.indexOf('results.push');
  assert.ok(
    push === -1 || push > guard,
    `A results.push appears in the off-day branch BEFORE the !tmData guard. ` +
      `No punches on a day off means no row, form or not.`,
  );
});
