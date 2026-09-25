import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fmtMinutes, discountLabel } from '../src/app/pages/action-required/arLogic.ts';

// AL1-AL3 (2026-09-25, AR-4): Saul's notes — dates like "Wed 7 Sep", shift with
// work days ("Mon–Fri · 9AM–5PM"), a column showing what will or won't be
// discounted, better dropdowns, Title Case, sort by event.

test('AL1: minutes read like people talk', () => {
  assert.equal(fmtMinutes(0), '');
  assert.equal(fmtMinutes(-5), '');
  assert.equal(fmtMinutes(45), '45 min');
  assert.equal(fmtMinutes(60), '1h');
  assert.equal(fmtMinutes(75), '1h 15m');
  assert.equal(fmtMinutes(251), '4h 11m');
  assert.equal(fmtMinutes(null), '');
});

test('AL2: the Discount column says what a commit would deduct', () => {
  assert.deepEqual(discountLabel(14, true), { text: '14 min', tone: 'deduct' });
  assert.deepEqual(discountLabel(480, true), { text: '8h', tone: 'deduct' });
  assert.deepEqual(discountLabel(0, true), { text: 'Paid', tone: 'paid' });
  assert.deepEqual(discountLabel(0, false), { text: '', tone: 'none' });
});

test('AL3: the row uses the shared parts and the same discount math as the save', () => {
  const row = readFileSync('src/app/pages/action-required/ArRow.tsx', 'utf8');
  const head = readFileSync('src/app/pages/action-required/ArHead.tsx', 'utf8');
  const loader = readFileSync('src/actions/loadActionRequired.ts', 'utf8');
  assert.match(row, /from '@\/app\/components\/ds\/Combobox'/);
  assert.match(row, /computeDiscount\(\{/);
  assert.match(row, /fmtDay\(row\.work_date\.slice\(0, 10\), THIS_YEAR\)/);
  assert.match(row, /fmtShift\(row\.work_days, row\.scheduled_start, row\.scheduled_end\)/);
  assert.doesNotMatch(row + head, /className=[^>]*uppercase/, 'Title Case, never an uppercase class');
  assert.match(head, /col="event_type_1" label="Event 1"/);
  assert.match(loader, /LEFT JOIN schedules s ON s\.id = e\.schedule_id/);
});

// AL4 (code review #1, #2, #5): the Discount column must match what a commit writes,
// and the Committed list's Updated time is Panama wall-clock.
test('AL4: minutes always recomputed like the save; Paid only once impacts are chosen', () => {
  const row = readFileSync('src/app/pages/action-required/ArRow.tsx', 'utf8');
  const committed = readFileSync('src/actions/loadCommittedEntries.ts', 'utf8');
  assert.match(row, /const live = computePunchMinutes\(\{/);
  assert.doesNotMatch(row, /const live = dirty \?/);
  assert.ok(row.includes('(!edit.event_type_1 || !!edit.pay_impact_1) && (!edit.event_type_2 || !!edit.pay_impact_2)'));
  assert.ok(committed.includes("(pe.updated_at AT TIME ZONE 'America/Panama')::text AS updated_at"));
});
