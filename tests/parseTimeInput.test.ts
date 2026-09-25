import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimeInput, isValidTimeInput } from '../src/app/lib/parseTimeInput.ts';

// TI1 (2026-09-11): "12:35am" — no space, lower case — used to throw inside the
// blur handler, so the raw text was saved as typed. Luis Abad 2026-06-01 held
// exactly that string. The parser must normalise every "H:MM am" spelling.
test('TI1: "H:MMam" spellings normalise instead of throwing', () => {
  const cases: [string, string][] = [
    ['12:35am', '12:35 AM'], ['12:35AM', '12:35 AM'], ['12:35 am', '12:35 AM'],
    ['4:00pm', '4:00 PM'], ['04:05 Pm', '4:05 PM'], ['9:00 AM', '9:00 AM'],
  ];
  for (const [input, want] of cases) assert.equal(parseTimeInput(input), want, input);
});

test('TI2: loose typing still formats as before', () => {
  const cases: [string, string][] = [
    ['9', '9:00 AM'], ['9a', '9:00 AM'], ['9p', '9:00 PM'], ['930', '9:30 AM'],
    ['930p', '9:30 PM'], ['9:30', '9:30 AM'], ['14', '2:00 PM'], ['14:30', '2:30 PM'],
    // '1230a' was '0:30 AM' until 2026-09-25 (TI4); same minutes to the engine.
    ['12', '12:00 PM'], ['0', '12:00 AM'], ['1230a', '12:30 AM'],
  ];
  for (const [input, want] of cases) assert.equal(parseTimeInput(input), want, input);
});

test('TI3: blank and unrecognisable text pass through unchanged', () => {
  assert.equal(parseTimeInput(''), '');
  assert.equal(parseTimeInput('   '), '');
  assert.equal(parseTimeInput('Form Submitted'), 'Form Submitted');
  assert.equal(parseTimeInput('9:75'), '9:75');
});

// TI4 (2026-09-25): "55:00 PM" was accepted and saved (Action Required note).
// With am/pm the hour must be 1–12; without, 0–23. Impossible text stays as
// typed and isValidTimeInput reports it so the box can turn red.
test('TI4: impossible times are refused and flagged', () => {
  for (const s of ['55:00 PM', '13:00 PM', '0:30 AM', '9:75', '25', '2500', '13p', '0a']) {
    assert.equal(parseTimeInput(s), s, s);
    assert.equal(isValidTimeInput(s), false, s);
  }
  for (const s of ['', '9', '930p', '12:35am', '14:30', '1230a', '0']) {
    assert.equal(isValidTimeInput(s), true, s);
  }
});
