import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// L6 — the documentation string the engine writes must be one the view counts.
//
// v_attendance_daily derives filed_gaf by comparing payroll_entries.documentation
// against a literal list. classificationEngine.ts picks that string. The two live
// in different languages, in different files, with nothing connecting them — so on
// 2026-08-27 the engine was changed from 'Form Submitted' to 'Attendance Form' and
// the view was not. Nothing failed. The bug simply waited for the next payroll run,
// when every filed form would have started reading as "Late - Unreported".
//
// This test is the connection. If someone renames the string again, this fails
// immediately instead of a KPI going quietly wrong weeks later.

const ROOT = path.resolve(import.meta.dirname, '..');

/** The newest migration that redefines v_attendance_daily. Timestamps sort. */
function currentViewSql(): { file: string; sql: string } {
  const dir = path.join(ROOT, 'src', 'migrations');
  const file = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql') && /v_attendance_daily/i.test(f))
    .sort()
    .pop();
  assert.ok(file, 'no migration defining v_attendance_daily was found');
  return { file, sql: fs.readFileSync(path.join(dir, file), 'utf8') };
}

/** Every string the engine assigns to `doc` on a late-day-with-a-form branch. */
function engineFiledStrings(): string[] {
  const src = fs.readFileSync(
    path.join(ROOT, 'src', 'app', 'lib', 'classificationEngine.ts'), 'utf8');
  const found = new Set<string>();
  for (const m of src.matchAll(/hasTardForm\s*\)?\s*doc\s*=\s*'([^']+)'/g)) found.add(m[1]);
  return [...found];
}

test('L6: the engine writes a documentation string the view counts as filed', () => {
  const strings = engineFiledStrings();
  assert.ok(
    strings.length > 0,
    'could not find the hasTardForm branch in classificationEngine.ts — if that ' +
    'branch was renamed or restructured, update this guard rather than deleting it',
  );

  const { file, sql } = currentViewSql();
  const filedLine = sql.split('\n').find(l => /AS\s+gaf_filed/i.test(l));
  assert.ok(filedLine, `no gaf_filed expression found in ${file}`);

  for (const s of strings) {
    assert.ok(
      filedLine.includes(`'${s}'`),
      `classificationEngine.ts writes documentation '${s}' when a late day has a ` +
      `form, but ${file} does not count it as filed_gaf. The Attendance dashboard ` +
      `would show those days as "Late - Unreported" with no error. Add '${s}' to ` +
      `the gaf_filed list in a new migration.`,
    );
  }
});

test('L6b: the historical string stays recognised', () => {
  // 1,152 rows still carry 'Form Submitted'. Dropping it would rewrite history.
  const { file, sql } = currentViewSql();
  const filedLine = sql.split('\n').find(l => /AS\s+gaf_filed/i.test(l));
  assert.ok(
    filedLine?.includes(`'Form Submitted'`),
    `${file} must keep counting 'Form Submitted' — every period processed before ` +
    `2026-08-27 uses it, and 1,152 rows carry it today`,
  );
});
