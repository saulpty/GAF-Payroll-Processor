// Two copies of the English disciplinary PDF exist: the form's generatePdf.ts (the
// PDF a manager files) and the Hub's lib/disciplinaryPdf (the PDF rebuilt after an
// admin edit, 2026-09-24). If one copy's wording changes and the other doesn't, an
// edited warning would come out looking different from the original. This pins the
// section labels so the two copies cannot drift silently.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const FORM = 'form-app/src/app/utils/generatePdf.ts';
const HUB = 'src/app/lib/disciplinaryPdf/strings.ts';

// Labels taken from the form's English PdfStrings block.
const LABELS = [
  'DISCIPLINARY ACTION FORM',
  'CONFIDENTIAL',
  'SUPERVISOR EMAIL',
  'RE-EVALUATION DATE',
  'DISCIPLINARY ACTION LEVEL',
  'Situation Type',
  'Incident Documentation',
  'Evidence Reviewed',
  'Evidence Description',
  'Prior Warnings or Discussions',
  'Corrective Action & Expectations',
  'What the employee must correct starting today',
  'Final Outcome',
  'Consequences of Non-compliance',
  'Signatures & Acknowledgment',
  'The employee was heard and had the opportunity to present comments.',
];

test('PP1: every section label in the form PDF is still there (guards the list itself)', () => {
  const form = read(FORM);
  for (const l of LABELS) assert.ok(form.includes(`'${l}'`), `the form's generatePdf.ts no longer has '${l}'`);
});

test('PP2: the Hub PDF strings use the same section labels as the form', () => {
  const hub = read(HUB);
  const missing = LABELS.filter(l => !hub.includes(`'${l}'`));
  assert.deepEqual(missing, [], `the Hub's strings.ts is missing: ${missing.join(' | ')}`);
});
