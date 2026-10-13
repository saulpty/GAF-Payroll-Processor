// 2026-10-13 — phone view M5: pop-ups fit, no scroll box inside the page
// (prompt 2026-10-13-mobile/06-dialogs-fit.md). Source guards.
//
// The prompt may only ADD `phone:` classes to existing className strings. MD1 proves that:
// take the `phone:` classes back out and each file must be, byte for byte, what it was on
// 2026-10-13 (main at 204c348). A logic change, a moved line or a dropped class all fail it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// Removes every `phone:` class from every plain className="…" string and squeezes the spaces
// between the classes that are left. Applied to the 2026-10-13 files it changes nothing.
const withoutPhone = (src: string) =>
  src.replace(/className="([^"]*)"/g, (_m, classes: string) =>
    `className="${classes.split(/\s+/).filter(c => c && !c.startsWith('phone:')).join(' ')}"`);

const PTO = 'src/app/pages/pto/';
const DISC = 'src/app/pages/disciplinary/';
const RECORD = PTO + 'RecordApprovalDialog.tsx';
const PANEL = PTO + 'RecordDialogPayrollPanel.tsx';
const CLOSE = DISC + 'CloseCaseDialog.tsx';
const DELETE = DISC + 'DeleteActionDialog.tsx';
const THRESHOLDS = 'src/app/pages/attendance/activity/ActivityThresholds.tsx';
const PTO_TABLE = PTO + 'PtoTable.tsx';
const CONTRACTS_TABLE = 'src/app/pages/contracts/ContractsTable.tsx';
const DISC_TABLE = DISC + 'DisciplinaryTable.tsx';

// sha256 of each file as it was on 2026-10-13 (line endings as LF).
const BEFORE: Record<string, string> = {
  [RECORD]: '841c0d83419d1ec03cfbf003ab2e598aa7bc6ff5bb8ee0882ca8290dafff7730',
  [PANEL]: '74574c0041d7359231d24b9e9b51e90e6bfaed8e8a93b61fe6df9eafca784cfb',
  [CLOSE]: 'f0d36a8ee8f0db7c0962d94efcb20d5f9d92c5e0b83f389d4f6ce9a51d61092a',
  [DELETE]: '72b40d8a3444ebb9edd358a4abebcc64a425c19db53b34d6da36903f548f29fc',
  [THRESHOLDS]: '1d7bb75cc25b39326529101ceb53f5cdb307c44842f9910357ed64a71c489365',
  [PTO_TABLE]: 'b0f3bfd3634c4772e1b9499933a5158ce635e7d8f4b6146080ff9b56e88d938a',
  [CONTRACTS_TABLE]: '6022d7a895f9f50f6267facf190de9492f5d5652e180414240875da8194bae36',
  [DISC_TABLE]: '781e07c27a1be4501182554fe385b0983f6c83c16f248b08fe3ae22be67f56ed',
};
const DIALOG_UI = 'src/components/ui/dialog.tsx';
const DIALOG_UI_SHA = '666e59075459a426bbddf8d3dd4cf020932346281da586673bb9016fc52e7969';

// What a pop-up needs on a phone: 16px each side, never taller than the screen.
// The two height classes are a pair on purpose: the first is the fallback for a browser that
// does not know `dvh`; the second is written as an arbitrary property so tailwind-merge keeps both.
const FIT = 'phone:w-[calc(100%-2rem)] phone:max-h-[calc(100vh-2rem)] phone:[max-height:calc(100dvh_-_2rem)]';

/** The class list of the one <DialogContent> in a file. */
function dialogClasses(path: string): string[] {
  const found = [...read(path).matchAll(/<DialogContent className="([^"]*)">/g)];
  assert.equal(found.length, 1, `${path}: expected exactly one <DialogContent className="…">`);
  return found[0][1].split(/\s+/);
}

test('MD1: class strings only — without the phone: classes every file is exactly what it was', () => {
  for (const [path, before] of Object.entries(BEFORE)) {
    const now = read(path);
    assert.match(now, /className="[^"]*\bphone:/, `${path}: no phone: class has been added yet`);
    assert.equal(sha(withoutPhone(now)), before,
      `${path}: something other than added phone: classes changed`);
  }
});

test('MD2: every edited file stays under 15 KB', () => {
  for (const path of Object.keys(BEFORE)) {
    const size = Buffer.byteLength(readFileSync(new URL(`../${path}`, import.meta.url)));
    assert.ok(size < 15000, `${path} is ${size} bytes`);
  }
});

test('MD3: the shared dialog component itself was not edited', () => {
  assert.equal(sha(read(DIALOG_UI)), DIALOG_UI_SHA, 'src/components/ui/dialog.tsx must never change');
});

test('MD4: each pop-up has a side margin, a height cap with a fallback, and scrolls inside', () => {
  for (const path of [RECORD, CLOSE, DELETE, THRESHOLDS]) {
    const classes = dialogClasses(path);
    for (const c of FIT.split(' ')) assert.ok(classes.includes(c), `${path}: DialogContent is missing ${c}`);
    assert.ok(classes.includes('phone:overflow-y-auto') || classes.includes('overflow-y-auto'),
      `${path}: DialogContent must scroll inside`);
    assert.ok(classes.indexOf('phone:max-h-[calc(100vh-2rem)]') < classes.indexOf('phone:[max-height:calc(100dvh_-_2rem)]'),
      `${path}: the vh fallback is written before the dvh class`);
    assert.equal(classes.filter(c => c.startsWith('phone:max-h-')).length, 1,
      `${path}: two phone:max-h-* classes — tailwind-merge would silently drop the first`);
  }
});

test('MD5: the desktop width and height of each pop-up are still there', () => {
  assert.ok(dialogClasses(RECORD).includes('max-w-lg'));
  assert.ok(dialogClasses(CLOSE).includes('max-w-md'));
  assert.ok(dialogClasses(DELETE).includes('max-w-md'));
  const thresholds = dialogClasses(THRESHOLDS);
  for (const c of ['max-w-md', 'max-h-[85vh]', 'overflow-y-auto']) assert.ok(thresholds.includes(c), `Thresholds lost ${c}`);
});

test('MD6: side-by-side boxes in Record PTO become one column on a phone', () => {
  assert.match(read(RECORD), /\{\/\* Dates \*\/\}\s*<div className="grid grid-cols-2 phone:grid-cols-1 gap-3">/);
  assert.match(read(PANEL), /<div className="grid grid-cols-2 phone:grid-cols-1 gap-3">\s*\{\/\* Left: requested \*\/\}/);
});

test('MD7: on a phone the three tables stop being a scroll box inside the page', () => {
  const boxes: [string, string][] = [
    [PTO_TABLE, 'max-h-[calc(100vh-260px)]'],
    [CONTRACTS_TABLE, 'max-h-[calc(100vh-300px)]'],
    [DISC_TABLE, 'max-h-[calc(100vh-240px)]'],
  ];
  for (const [path, desktopBox] of boxes) {
    const found = [...read(path).matchAll(/className="(mx-6 mb-6 [^"]*)"\s*>/g)].filter(m => m[1].includes('max-h-'));
    assert.equal(found.length, 1, `${path}: expected one DataTable className with a max-h box`);
    const classes = found[0][1].split(/\s+/);
    assert.ok(classes.includes(desktopBox), `${path}: the computer keeps ${desktopBox}`);
    assert.ok(classes.includes('phone:max-h-none'), `${path}: the box is not released on a phone`);
    // The table sits in a flex column of fixed height: without this it shrinks back into a scroll box.
    assert.ok(classes.includes('phone:shrink-0'), `${path}: phone:shrink-0 is what lets the page scroll as one`);
  }
});

test('MD8: nothing in these files uses md:/sm: for the phone switch', () => {
  for (const path of Object.keys(BEFORE)) {
    assert.doesNotMatch(read(path), /className="[^"]*\b(?:sm|md|max-md|max-sm):/, `${path}: use phone:, not a width breakpoint`);
  }
});
