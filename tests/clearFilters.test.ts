// "Clear Filters" appeared with no filter set (Saul, 2026-10-06). It must show only when a filter
// the current page displays holds a value the user chose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getConfig, hasVisibleFilter, type FilterState } from '../src/app/lib/filterRoutes.ts';

const none: FilterState = {
  period: '', employee: '', role: '', manager: '', isSuper: true,
  attendanceMode: 'periods', attendancePeriods: [], defaultPeriod: 'Q1-Oct-2026',
};

test('CF1: nothing chosen → no button', () => {
  for (const path of ['/pto', '/contracts', '/attendance/today', '/attendance/list', '/action-required', '/process']) {
    assert.equal(hasVisibleFilter(getConfig(path), none), false, path);
  }
});

test('CF2: the period Attendance picks by itself is not a filter', () => {
  const auto = { ...none, attendancePeriods: ['Q1-Oct-2026'] };
  assert.equal(hasVisibleFilter(getConfig('/attendance/list'), auto), false);
  assert.equal(hasVisibleFilter(getConfig('/attendance/reports'), auto), false);
  // …but choosing a different or an extra period is.
  assert.equal(hasVisibleFilter(getConfig('/attendance/list'), { ...none, attendancePeriods: ['Q2-Sep-2026'] }), true);
  assert.equal(hasVisibleFilter(getConfig('/attendance/list'), { ...none, attendancePeriods: ['Q1-Oct-2026', 'Q2-Sep-2026'] }), true);
  // In Dates mode the period picker is hidden, so periods never count.
  assert.equal(hasVisibleFilter(getConfig('/attendance/activity'), { ...none, attendanceMode: 'dates', attendancePeriods: ['Q2-Sep-2026'] }), false);
});

test('CF3: a value remembered from another page does not count where it is not shown', () => {
  const periodFromAR = { ...none, period: 'Q1-Oct-2026' };
  assert.equal(hasVisibleFilter(getConfig('/pto'), periodFromAR), false, 'PTO has no Period filter');
  assert.equal(hasVisibleFilter(getConfig('/attendance/today'), periodFromAR), false);
  assert.equal(hasVisibleFilter(getConfig('/action-required'), periodFromAR), true, 'shown on Action Required');
  const roleFromPto = { ...none, role: 'EVV Specialist' };
  assert.equal(hasVisibleFilter(getConfig('/action-required'), roleFromPto), false, 'AR has no Title filter');
  assert.equal(hasVisibleFilter(getConfig('/contracts'), roleFromPto), true);
});

test('CF4: the Manager filter only counts for superusers (it is hidden from everyone else)', () => {
  assert.equal(hasVisibleFilter(getConfig('/pto'), { ...none, manager: 'Arelis Acosta' }), true);
  assert.equal(hasVisibleFilter(getConfig('/pto'), { ...none, manager: 'Arelis Acosta', isSuper: false }), false);
});

test('CF5: FilterBar uses the rule, not the global "anything set anywhere" flag', () => {
  const fb = readFileSync(new URL('../src/app/FilterBar.tsx', import.meta.url), 'utf8');
  assert.match(fb, /\{hasVisibleFilter\(cfg, \{/);
  assert.doesNotMatch(fb, /\{hasAny && \(/);
  assert.ok(Buffer.byteLength(fb) < 15000);
});
