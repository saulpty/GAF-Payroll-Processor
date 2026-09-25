import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// AF10-1/2 (2026-09-25, Tim + Saul after 8.15.0): "Needs an Event" should clear
// itself once every row in it is handled; the page was heavy on Tim's laptop
// (the Committed list drew all 1,300+ rows).
const page = readFileSync('src/app/pages/ActionRequired.tsx', 'utf8');
const done = readFileSync('src/app/pages/action-required/ArCommitted.tsx', 'utf8');

test('AF10-1: a filter clears itself only after its rows are all handled', () => {
  assert.match(page, /eventFilter === was\.filter && was\.count > 0 && filtered\.length === 0 && !loading/);
  assert.match(page, /setEventFilter\(''\);\s*toast\.show\(\{ message: 'All done in that filter\. Showing every row\.' \}\);/);
});

test('AF10-2: the Committed list draws the latest 100 rows, Show All on request', () => {
  assert.match(done, /const shown = showAll \? committed : committed\.slice\(0, 100\);/);
  assert.match(done, /\{shown\.map\(r => \{/);
  assert.doesNotMatch(done, /\{committed\.map\(/);
});
