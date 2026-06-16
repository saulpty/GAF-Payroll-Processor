import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDiscount } from '../src/app/lib/classificationEngine.ts';

// C2: When an employee arrives on time but leaves early, the engine places
// "Salida Temprano" in event slot 1 (because slot 1 is free). computeDiscount
// must credit the early-leave minutes from slot 1 — mirroring how it already
// handles Salida Temprano in slot 2. Today it only looks at slot 2, so an
// early-leave-only day silently discounts 0 minutes.
test('C2: early-leave in slot 1 is discounted (engine output, blank impact)', () => {
  const d = computeDiscount({
    event_type_1: 'Salida Temprano',
    pay_impact_1: '', // engine leaves this blank by default; '' counts as unpaid (same as slot 2)
    late_minutes: 0,
    late_after_grace: 0,
    early_leave_minutes: 45,
  });
  assert.equal(d, 45);
});

test('C2: early-leave in slot 1 with an explicit unpaid impact is discounted', () => {
  const d = computeDiscount({
    event_type_1: 'Salida Temprano',
    pay_impact_1: 'Unpaid',
    late_minutes: 0,
    late_after_grace: 0,
    early_leave_minutes: 30,
  });
  assert.equal(d, 30);
});

// Regression guards: existing behavior must not change.
test('slot-2 early-leave still discounted (unchanged behavior)', () => {
  const d = computeDiscount({
    event_type_1: 'Tardanza',
    pay_impact_1: 'Unpaid (without Grace)',
    event_type_2: 'Salida Temprano',
    pay_impact_2: '',
    late_minutes: 12,
    late_after_grace: 12,
    early_leave_minutes: 20,
  });
  assert.equal(d, 32); // 12 late + 20 early-leave
});

test('tardiness-only in slot 1 discounts late minutes, not early-leave', () => {
  const d = computeDiscount({
    event_type_1: 'Tardanza',
    pay_impact_1: 'Unpaid (without Grace)',
    late_minutes: 18,
    late_after_grace: 18,
    early_leave_minutes: 0,
  });
  assert.equal(d, 18);
});

test('Paid (Grace) tardiness produces no discount', () => {
  const d = computeDiscount({
    event_type_1: 'Tardanza',
    pay_impact_1: 'Paid (Grace)',
    late_minutes: 8,
    late_after_grace: 0,
    early_leave_minutes: 0,
  });
  assert.equal(d, 0);
});
