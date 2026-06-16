import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimeToMinutes } from '../src/app/lib/classificationEngine.ts';

test('toolchain smoke: parseTimeToMinutes parses 12-hour times', () => {
  assert.equal(parseTimeToMinutes('8:00 AM'), 480);
  assert.equal(parseTimeToMinutes('12:00 PM'), 720);
});
