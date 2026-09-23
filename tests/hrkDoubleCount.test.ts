// Structural guards for prompt 2026-09-23-review-fixes/08: the HRK Summary must take
// doctor-note (Constancia Medica) and sick-day (Incapacidad) hours off ONCE.
//
// total_worked_hours = base - discount - incapacidad - constancia. Discount minutes on a
// Constancia row are the UNPAID part of the day (computeDiscount never discounts a
// 'Constancia Medica' slot), so they must not also become constancia hours. And an
// Incapacidad row is already a flat 8h, so its discount minutes must not be counted again.
// Real rows: Rodgers 2026-04-08 (420 + Constancia -> 14h off today, 7h after),
// Rodgers 2026-05-06 and Puyol 2026-05-11 (420 + Incapacidad -> 15h off today, 8h after).
//
// SQL cannot run here, so these read the action's source text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILE = 'src/actions/loadHrkSummary.ts';
const src = () => readFileSync(FILE, 'utf8');
const NOTE_RANGE = "'[0-9]{1,2}(:[0-9]{2})? *[ap]m *[-a] *[0-9]{1,2}(:[0-9]{2})? *[ap]m'";

function between(s: string, from: string, to: string): string {
  const a = s.indexOf(from);
  assert.ok(a >= 0, `${FILE} must contain ${from}`);
  const b = s.indexOf(to, a + from.length);
  assert.ok(b > a, `${FILE} must contain ${to} after ${from}`);
  return s.slice(a, b);
}

/** The CASE that computes constancia_hours_entry, without its SQL comments. */
function constanciaCase(): string {
  const block = between(src(), 'entries_with_constancia AS (', 'AS constancia_hours_entry');
  return block.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
}

test('HDC1: constancia hours are never taken from discount_total_minutes', () => {
  const c = constanciaCase();
  assert.ok(!/THEN\s+ef\.discount_total_minutes/.test(c),
    'no branch may return discount_total_minutes as constancia hours (it is the unpaid part, already in discount)');
  assert.ok(!c.includes('discount_total_minutes'),
    'the constancia_hours_entry CASE must not read discount_total_minutes at all');
});

test('HDC2: the note-parsing branch applies whether or not the row has discount minutes', () => {
  const c = constanciaCase();
  assert.ok(c.includes(`ef.notes ~ ${NOTE_RANGE}`), 'the note time-range branch must stay, regex unchanged');
  assert.ok(!/discount_total_minutes\s*=\s*0/.test(c),
    'the note branch must not require discount_total_minutes = 0 (Torrano 2026-03-20: 240 discount, note 8am - 11am = 3h)');
});

test('HDC3: a Constancia row with unpaid minutes and no readable note time range raises the review flag', () => {
  const flag = between(src(), 'AS constancia_hours_entry', 'AS needs_constancia_review');
  assert.ok(flag.includes("WHEN ef.notes ILIKE '%constancia%'"), 'the existing "mentioned but not tagged" branch must stay');
  const re = new RegExp(
    "Constancia Medica'\\)?\\s*AND ef\\.discount_total_minutes > 0\\s*AND NOT COALESCE\\(ef\\.notes ~ "
      + NOTE_RANGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ',\\s*FALSE\\)',
  );
  assert.ok(re.test(flag),
    'needs_constancia_review must be TRUE for a Constancia Medica row with discount > 0 whose note has no readable time range');
});

test('HDC4: discount minutes on an Incapacidad row are not counted again (the day is already a flat 8h)', () => {
  const agg = between(src(), 'discount_agg AS (', 'incapacidad_agg AS (');
  assert.ok(!/SUM\(\s*discount_total_minutes\s*\)/.test(agg),
    'discount_agg must not sum discount_total_minutes over every row');
  assert.ok(/WHEN pay_impact_1 = 'Incapacidad' OR pay_impact_2 = 'Incapacidad' THEN 0/.test(agg),
    'discount_agg must count 0 discount minutes for an Incapacidad row');
  assert.ok(/ELSE discount_total_minutes/.test(agg), 'every other row keeps its discount minutes');
});

// ── Guards on what prompt 08 must NOT change (these pass today and must keep passing) ──

test('HDC5: worked hours still subtract discount, incapacidad and constancia, floored at 0', () => {
  const s = src().replace(/\s+/g, ' ');
  assert.ok(s.includes(
    'GREATEST( ROUND(( eb.base_hours - COALESCE(da.total_discount_hours, 0) - COALESCE(ia.incapacidad_hours, 0) - COALESCE(ca.constancia_hours_total, 0) )::numeric, 2), 0 )',
  ), 'total_worked_hours formula must be unchanged');
});

test('HDC6: base hours keep the Mon-Sat paid-rest-day rule (owner ruling 2026-08-25)', () => {
  assert.ok(src().includes('WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 6'));
});

test('HDC7: {{params.periodName}} is never inside a quoted string, and the file stays under 15 KB', () => {
  const s = src();
  assert.ok(!/'[^'\n]*\{\{params\.[^}]*\}\}[^'\n]*'/.test(s), '{{params.x}} must never sit inside quotes');
  assert.equal((s.match(/\{\{params\.periodName\}\}/g) ?? []).length, 4, 'periodName is used in exactly four places');
  assert.ok(Buffer.byteLength(s, 'utf8') < 15 * 1024, `${FILE} must stay under 15 KB`);
});
