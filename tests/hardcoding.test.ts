import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runClassificationEngine,
  normalizeName,
  type EmployeeRecord,
  type EngineInput,
} from '../src/app/lib/classificationEngine.ts';

const DAY = '2026-06-15'; // Monday, DST in effect
const DST = [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];

// A normal Eastern-synced employee, schedule stored in US Eastern: constant 9-5.
function emp(over: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: 1,
    display_name: 'Standard Employee',
    teramind_email: 'emp@gaf.com',
    is_grace_list: false,
    is_macbook_swap: false,
    schedule_name: 'Standard',
    dst_start: '9:00 AM',
    dst_end: '5:00 PM',
    standard_start: '9:00 AM',
    standard_end: '5:00 PM',
    grace_minutes: 10,
    ...over,
  };
}

function baseInput(over: Partial<EngineInput>): EngineInput {
  return {
    periodName: 'TEST',
    startDate: DAY,
    endDate: DAY,
    employees: [emp()],
    dstWindows: DST,
    holidays: [],
    teramindData: new Map(),
    mondayAttendance: [],
    mondayAdjustments: [],
    mondayPermissions: [],
    outageDates: [],
    midDayPull: false,
    excludedEmployeeIds: [],
    nameMap: new Map(),
    ...over,
  };
}

// H2: a mid-day pull should backfill the missing exit with the employee's
// SCHEDULED end, not a hardcoded 4:00 PM. Favian works 9–5, so an early
// Teramind exit (1:00 PM) must become 5:00 PM with zero early-leave.
test('H2: mid-day pull backfills exit to the scheduled end (9-5 employee)', () => {
  const tm = new Map([['emp@gaf.com', new Map([[DAY, {
    entry: new Date(2026, 5, 15, 9, 0),
    exit: new Date(2026, 5, 15, 13, 0), // 1:00 PM — pulled mid-day
  }]])]]);

  const result = runClassificationEngine(
    baseInput({ midDayPull: true, midDayPullDate: DAY, teramindData: tm }),
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].exit_time, '5:00 PM');
  assert.equal(result[0].early_leave_minutes, 0);
});

// H2b: the mid-day backfill must NOT touch prior days. Before UIB added the
// date gate, a genuine early departure on an earlier day of the period was
// silently rewritten to the scheduled end, under-docking real early leaves.
test('H2b: mid-day pull leaves a genuine early exit on a prior day alone', () => {
  const PRIOR = '2026-06-12';
  const tm = new Map([['emp@gaf.com', new Map([[PRIOR, {
    entry: new Date(2026, 5, 12, 9, 0),
    exit: new Date(2026, 5, 12, 13, 0), // 1:00 PM — a real early departure
  }]])]]);

  const result = runClassificationEngine(baseInput({
    midDayPull: true,
    midDayPullDate: DAY,   // pulling a DIFFERENT day
    teramindData: tm,
    startDate: PRIOR,
    endDate: PRIOR,
  }));

  assert.equal(result.length, 1);
  assert.equal(result[0].exit_time, '1:00 PM', 'a prior day must keep its real exit');
  assert.ok(result[0].early_leave_minutes > 0, 'the early departure must still be counted');
});

// H3: the full-day no-data absence discount defaults to 420 but is configurable.
test('H3: no-data absence defaults to 420-minute discount', () => {
  const result = runClassificationEngine(baseInput({}));
  assert.equal(result.length, 1);
  assert.equal(result[0].event_type_1, 'Ausencia Injustificada');
  assert.equal(result[0].discount_total_minutes, 420);
});

test('H3: full-day absence discount honors config override', () => {
  const result = runClassificationEngine(
    baseInput({ config: { full_day_absence_discount_minutes: 360 } as any }),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].discount_total_minutes, 360);
});

// ── H4 / H5: Monday IDs must live in classification_config, not in code ───────
// Added 2026-08-18 with the Employees hub. The manager-column incident happened
// because a valid-but-wrong column id sat in code where nobody could see it.
// These fail the suite if that ever comes back.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function walkTs(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTs(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// The five board ids this app has ever used.
const BOARD_ID = /\b(?:8592460836|8661565945|9542698245|18394647909|18394590373)\b/;
// Monday column ids: a type prefix plus a short random suffix.
const COLUMN_ID =
  /\b(?:text|color|date|date_range|single_select|email|lookup|numbers|short_text|long_text|boolean|formula|status|people|phone|location|dropdown|signature|file|link|subtasks|board_relation|connect_boards|direct_doc)_?[a-z0-9]{6,14}\b/;

test('H4: no Monday board or column id is hardcoded in the mirror or PTO code', () => {
  const files = [
    ...walkTs('src/app/pages/admin/employees'),
    ...walkTs('src/app/pages/pto'),
    'src/app/pages/admin/AdminEmployeesHub.tsx',
    'src/app/pages/PtoTracker.tsx',
    ...walkTs('src/actions').filter(f =>
      /Monday|Pto|FloatingHoliday|Reconciliation|Unmatched/i.test(f)
    ),
  ].filter(existsSync);

  assert.ok(files.length > 0, 'expected the mirror/PTO files to exist');

  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!BOARD_ID.test(src), `${f} contains a literal Monday board id`);
    assert.ok(!COLUMN_ID.test(src), `${f} contains a literal Monday column id`);
  }
});

test('H5: the legacy admin pages, hardcoded-id actions and the old PTO tabs are gone', () => {
  for (const f of [
    'src/app/pages/admin/AdminEmployees.tsx',
    'src/app/pages/admin/AdminEmployeeSync.tsx',
    'src/app/pages/admin/AdminAliases.tsx',
    'src/actions/loadEmployeeDirectory.ts',
    'src/actions/fetchMondayStartDates.ts',
    // PTO Tracker v2 (2026-08-19): one table replaced the three tabs.
    'src/app/pages/pto/BalancesTab.tsx',
    'src/app/pages/pto/BalancesRow.tsx',
    'src/app/pages/pto/ApprovalsTab.tsx',
    'src/app/pages/pto/ApprovalRow.tsx',
    'src/app/pages/pto/FloatingHolidaysTab.tsx',
    'src/actions/loadPtoApprovals.ts',
    'src/actions/loadFloatingHolidays.ts',
  ]) {
    assert.ok(!existsSync(f), `${f} should have been deleted`);
  }
});
