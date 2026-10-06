// PTO tracker columns + Coming Up strip (2026-10-06, Saul + a manager meeting).
// Prompts: docs/superpowers/prompts/2026-10-06-pto-columns/01..03.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dayBefore, fmtLeaveDates } from '../src/app/lib/fmtDay.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PC1: dayBefore crosses month, year and leap-day boundaries without Date', () => {
  assert.equal(dayBefore('2026-08-24'), '2026-08-23');
  assert.equal(dayBefore('2026-03-01'), '2026-02-28');
  assert.equal(dayBefore('2028-03-01'), '2028-02-29');
  assert.equal(dayBefore('2027-01-01'), '2026-12-31');
  assert.equal(dayBefore('2026-10-06 00:00:00+00'), '2026-10-05');
  assert.equal(dayBefore(''), '');
  assert.doesNotMatch(read('src/app/lib/fmtDay.ts'), /new Date\(/);
});

test('PC2: Dates Requested runs from the first day off to the day before return', () => {
  assert.equal(fmtLeaveDates('2026-08-17', '2026-08-24', '2026'), 'Mon Aug 17 → Sun Aug 23');
  assert.equal(fmtLeaveDates('2026-08-17', '2026-08-18', '2026'), 'Mon Aug 17');
  assert.equal(fmtLeaveDates('2026-08-17', '', '2026'), 'Mon Aug 17');
  assert.equal(fmtLeaveDates('2026-08-17', '2026-08-10', '2026'), 'Mon Aug 17');
  assert.equal(fmtLeaveDates('2026-12-28', '2027-01-04', '2026'), 'Mon Dec 28 → Sun Jan 3, 2027');
});

test('PC3: breakdown splits Requested; payroll columns are superuser-only', () => {
  const b = read('src/app/pages/pto/PtoBreakdown.tsx');
  for (const h of ['Dates Requested', 'Total Days Off', 'Returning On', 'What Payroll Says', 'Evidence', 'Status']) {
    assert.ok(b.includes(`'${h}'`), `breakdown is missing header ${h}`);
  }
  assert.doesNotMatch(b, /'Requested'/);
  assert.match(b, /isSuper \? SUPER_COLS : BASIC_COLS/);
  const basic = b.slice(b.indexOf('BASIC_COLS'), b.indexOf('];', b.indexOf('BASIC_COLS')));
  assert.doesNotMatch(basic, /What Payroll Says|Evidence/);

  const s = read('src/app/pages/pto/PtoSubRow.tsx');
  assert.match(s, /fmtLeaveDates\(item\.leave_on, item\.return_on, thisYear\)/);
  assert.match(s, /isSuper && \([\s\S]{0,400}<PtoVerdictCell/);
  assert.match(s, /isSuper && \([\s\S]{0,900}<PtoPayrollCell/);
});

test('PC4: main table — Start Date; Review column, checkbox, count and export column superuser-only', () => {
  const t = read('src/app/pages/pto/PtoTable.tsx');
  assert.match(t, /label: 'Start Date'/);
  assert.match(t, /isSuper \? COLUMNS : COLUMNS\.filter\(c => c\.key !== 'review'\)/);
  // PTO-W1 (2026-10-06) replaced the Only With Review checkbox with superuser-only chips.
  assert.match(t, /\{isSuper && \(\s*<>[\s\S]{0,400}To Review[\s\S]{0,600}Not Yet/);
  assert.doesNotMatch(t, /type="checkbox"/);
  assert.match(t, /if \(isSuper && chip === 'review'\)/);
  assert.match(t, /colSpan=\{columns\.length\}/);
  assert.match(t, /showReview=\{isSuper\}/);

  const r = read('src/app/pages/pto/PtoRow.tsx');
  assert.match(r, /\{showReview && \(/);
  assert.match(r, /colSpan=\{showReview \? 11 : 10\}/);

  const p = read('src/app/pages/PtoTracker.tsx');
  assert.match(p, /'Start Date'/);
  assert.match(p, /isSuper \? \['Review'\] : \[\]/);
  assert.doesNotMatch(p, /to review/, 'the review count lives in the superuser chips now, not the header');
});

test('PC5: Coming Up — scoped loader, pending + recorded, flat params, mounted on the page', () => {
  const a = read('src/actions/loadPtoUpcoming.ts');
  assert.match(a, /a\.status = 'recorded'/);
  assert.match(a, /r\.deleted_on_monday = false AND a\.id IS NULL/);
  assert.equal((a.match(/e\.active = true/g) ?? []).length, 2, 'both halves filter to active employees');
  assert.equal((a.match(/access_viewer\(/g) ?? []).length, 2, 'both halves are scoped to the viewer');
  assert.doesNotMatch(a, /'\{\{params\./, '{{params.x}} must never sit inside a quoted string');

  const c = read('src/app/pages/pto/PtoComingUp.tsx');
  assert.match(c, /useLoadAction\(\s*loadPtoUpcomingAction,\s*\[\] as UpcomingRow\[\],\s*\{ today, until, manager: manager \|\| null, viewAs \}/);
  assert.doesNotMatch(c, /params:\s*\{/);
  assert.match(c, /fmtLeaveDates\(/);
  assert.ok(Buffer.byteLength(c) < 15000, 'PtoComingUp.tsx must stay under 15 KB');

  assert.match(read('src/app/pages/PtoTracker.tsx'), /<PtoComingUp today=\{today\} refreshKey=\{refreshKey\} \/>/);
});
