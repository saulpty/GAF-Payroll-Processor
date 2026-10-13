// 2026-10-13 — phone view M11: one disciplinary action on a phone
// (prompt 2026-10-13-mobile-rows/13-disciplinary-action.md). Source guards.
// Lives in tests/ once the prompt is sent.
//
// The prompt may only ADD `phone:` classes to class strings that already exist. MDA1 proves that:
// take the `phone:` classes back out and each file must be, byte for byte, what it was before.
// So no logic, no condition, no import and no computer class can have changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const withoutPhone = (src: string) => src.replace(/ phone:[^\s"'`]+/g, '');

const DISC = 'src/app/pages/disciplinary/';
const DETAIL = DISC + 'ActionDetail.tsx';
const PDF_BAR = DISC + 'ActionPdfBar.tsx';
const FORM = DISC + 'EditActionForm.tsx';
const RESULT = DISC + 'EditResultPanel.tsx';
const CLOSE = DISC + 'CloseCaseDialog.tsx';
const DELETE = DISC + 'DeleteActionDialog.tsx';

// sha256 of each file as it was on 2026-10-13, before this prompt (line endings as LF).
const BEFORE: Record<string, string> = {
  [DETAIL]: '771d2055f270d8ff5c7d27d4726aeba89265f5cf5958c6bf68cd2639a59e157e',
  [PDF_BAR]: '3bb42e036ca307ee25e610c78220886bb5dff9e92ad70da17c14485995dee0fb',
  [FORM]: 'e84960f17345ded05145a55811dc3cfb39720200dea614943c64e41861e24c7e',
  [RESULT]: 'f3d0af35a403f9017571ccfb93833da117a2d634a54b9ea32410e549328c852f',
};
const UNTOUCHED: Record<string, string> = {
  [CLOSE]: '89220fde1b6f8d6cd118df1f4dae5b2aacadfa70ac7f4c8cc355ed192c00011f',
  [DELETE]: 'd0ea87ace8025cafcf03d83a98df630da716137d2a5f05a21702f33327b50a4f',
};

// Every `{COND && (` / `{COND ? (` in ActionDetail on 2026-10-13, in order. The third, fifth,
// sixth and seventh are the admin gates: Restore, Delete (closed case), Delete (open case), Edit.
const GATES = [
  'action.deleted_at',
  'action.deletion_note',
  'isDisciplinaryAdmin',
  'action.closure_note',
  'isDisciplinaryAdmin',
  'isDisciplinaryAdmin',
  'isDisciplinaryAdmin && !action.deleted_at && !editing',
  'editing',
  'metaParts.length > 0',
];
const gates = (src: string, upTo = src.length) =>
  [...src.slice(0, upTo).matchAll(/\{\s*([^{}]+?)\s*(?:&&|\?)\s*\(/g)].map(m => m[1]);

/** Class lists of every className="…" whose opening tag (the text from `<` to the string) matches `tag`. */
function classesWhere(src: string, tag: RegExp): string[][] {
  const out: string[][] = [];
  for (const m of src.matchAll(/className="([^"]*)"/g)) {
    const open = src.lastIndexOf('<', m.index!);
    if (tag.test(src.slice(open, m.index!))) out.push(m[1].split(/\s+/));
  }
  return out;
}
const isColour = (c: string) => /^phone:(?:hover:)?(?:bg|border|text)-(?!\[\d)/.test(c);
const RED = /red|rose|pink|destructive|#BE123C|#9F1239|#E11D48/i;

test('MDA1: class strings only — without the phone: classes every file is exactly what it was', () => {
  for (const [path, before] of Object.entries(BEFORE)) {
    const now = read(path);
    assert.match(now, /className="[^"]*\bphone:/, `${path}: no phone: class has been added yet`);
    assert.equal(sha(withoutPhone(now)), before, `${path}: something other than added phone: classes changed`);
  }
});

test('MDA2: who may Restore, Delete and Edit is decided by the same conditions as before', () => {
  const src = read(DETAIL);
  assert.deepEqual(gates(src), GATES, 'a condition in ActionDetail was added, removed, reordered or reworded');
  assert.match(src, /const \{ isDisciplinaryAdmin \} = useDisciplinaryAdmin\(\);/);
  const nearest = (anchor: string) => {
    const hits = [...src.matchAll(new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
    assert.ok(hits.length, `${anchor} not found`);
    return hits.map(h => gates(src, h.index!).pop());
  };
  assert.deepEqual(nearest('onClick={handleRestore}'), ['isDisciplinaryAdmin']);
  assert.deepEqual(nearest('setDeleteOpen(true)'), ['isDisciplinaryAdmin', 'isDisciplinaryAdmin']);
  assert.deepEqual(nearest('setEditing(true)'), ['isDisciplinaryAdmin && !action.deleted_at && !editing']);
  // Close Case and Reopen were never admin-only, and still are not: neither sits inside an admin condition.
  assert.deepEqual(nearest('onClick={handleReopen}'), ['action.closure_note']);
  const openBar = src.slice(src.indexOf('This Case Is Open'));
  assert.ok(openBar.indexOf('setDialogOpen(true)') < openBar.indexOf('{isDisciplinaryAdmin && ('), 'Close Case moved behind the admin condition');
});

test('MDA3: on a phone Close Case and Save are not red; Delete is the only red button', () => {
  const detail = read(DETAIL);
  const form = read(FORM);
  const closeCase = classesWhere(detail, /setDialogOpen\(true\)/);
  const save = classesWhere(form, /save\(v\)/);
  assert.equal(closeCase.length, 1); assert.equal(save.length, 1);
  for (const [name, cls] of [['Close Case', closeCase[0]], ['Save and email', save[0]]] as const) {
    assert.ok(cls.includes('bg-[#BE123C]') && cls.includes('hover:bg-[#9F1239]'), `${name}: the computer keeps its colour`);
    const fill = cls.filter(c => /^phone:bg-/.test(c));
    const pressed = cls.filter(c => /^phone:hover:bg-/.test(c));
    assert.equal(fill.length, 1, `${name}: one phone fill colour`);
    // Without its own hover colour the rose hover (more specific than a plain class) comes back
    // after a tap on a touch screen.
    assert.equal(pressed.length, 1, `${name}: one phone hover colour`);
    for (const c of [...fill, ...pressed]) assert.doesNotMatch(c, RED, `${name} is still red on a phone (${c})`);
  }
  const del = classesWhere(detail, /setDeleteOpen\(true\)/);
  assert.equal(del.length, 2, 'two Delete buttons (closed case, open case)');
  for (const cls of del) {
    for (const c of ['text-red-700', 'border-red-200', 'hover:bg-red-50']) assert.ok(cls.includes(c), `Delete lost ${c}`);
    assert.deepEqual(cls.filter(isColour), [], 'Delete is recoloured on a phone');
  }
});

test('MDA4: Reopen is drawn as a real button on a phone, and is still the same button', () => {
  const src = read(DETAIL);
  const m = /<button\s+type="button"\s+onClick=\{handleReopen\}\s+disabled=\{reopening\}\s+className="([^"]*)"/.exec(src);
  assert.ok(m, 'Reopen is no longer <button type="button" onClick={handleReopen} disabled={reopening} …>');
  const cls = m[1].split(/\s+/);
  assert.ok(cls.includes('underline'), 'the computer keeps the underlined word');
  assert.ok(cls.includes('phone:no-underline'), 'still an underlined word on a phone');
  assert.ok(cls.includes('phone:border'), 'no outline on a phone');
  assert.ok(cls.includes('phone:h-11') || cls.includes('phone:min-h-11'), 'not 44 px tall on a phone');
  assert.deepEqual(cls.filter(c => isColour(c) && RED.test(c)), [], 'Reopen must not be red');
});

test('MDA5: every button in an action is 44 px tall on a phone', () => {
  // Buttons that carry their own height.
  for (const path of [DETAIL, PDF_BAR]) {
    const src = read(path);
    const sized = [...src.matchAll(/className="([^"]*)"/g)].map(m => m[1].split(/\s+/)).filter(c => c.includes('h-8') || c.includes('h-9'));
    assert.ok(sized.length >= 2, `${path}: expected buttons with a computer height`);
    for (const cls of sized) assert.ok(cls.includes('phone:h-11'), `${path}: "${cls.slice(0, 4).join(' ')} …" stays ${cls.includes('h-8') ? 32 : 36} px on a phone`);
  }
  // Buttons that get it from the line they sit in (their own tag has no class to add to).
  const footer = classesWhere(read(FORM), /^<div $/).filter(c => c.includes('justify-end'));
  assert.equal(footer.length, 1, 'the edit form has one button line');
  assert.ok(footer[0].includes('phone:[&>button]:h-11'), 'Cancel and Save are not 44 px on a phone');
  const done = classesWhere(read(RESULT), /^<div $/).filter(c => c.includes('mt-3'));
  assert.equal(done.length, 1);
  assert.ok(done[0].includes('phone:[&>button]:h-11'), 'Download updated PDF / Retry email / Done are not 44 px on a phone');
});

test('MDA6: the edit form is one column on a phone, four on a wide computer as before', () => {
  const grids = classesWhere(read(FORM), /^<div $/).filter(c => c.includes('grid'));
  assert.equal(grids.length, 1, 'one grid in the edit form');
  for (const c of ['grid-cols-2', 'lg:grid-cols-4', 'phone:grid-cols-1']) assert.ok(grids[0].includes(c), `the grid lost or lacks ${c}`);
  assert.equal(grids[0].filter(c => /^phone:grid-cols-/.test(c)).length, 1);
  // Each evidence tick box has a 44 px line to tap.
  const labels = classesWhere(read(FORM), /^<label key=\{opt\} $/);
  assert.equal(labels.length, 1);
  assert.ok(labels[0].includes('phone:min-h-11'), 'evidence tick boxes need a 44 px line to tap');
});

test('MDA7: on a phone nothing in an action is smaller than 12 px', () => {
  for (const path of [DETAIL, PDF_BAR]) {
    for (const m of read(path).matchAll(/className="([^"]*)"/g)) {
      const cls = m[1].split(/\s+/);
      if (!cls.some(c => c === 'text-[10px]' || c === 'text-[11px]')) continue;
      const phone = cls.map(c => /^phone:text-\[(\d+)px\]$/.exec(c)).filter(Boolean).map(x => Number(x![1]));
      assert.ok(phone.length === 1 && phone[0] >= 12, `${path}: "${m[1].slice(0, 60)}…" is under 12 px on a phone`);
    }
  }
});

test('MDA8: the pop-ups are untouched, files stay under 15,000 bytes, no width breakpoints', () => {
  for (const [path, before] of Object.entries(UNTOUCHED)) assert.equal(sha(read(path)), before, `${path} changed`);
  for (const path of Object.keys(BEFORE)) {
    const size = Buffer.byteLength(readFileSync(new URL(`../${path}`, import.meta.url)));
    assert.ok(size < 15000, `${path} is ${size} bytes`);
    assert.doesNotMatch(read(path), /(?<![\w-])(?:sm|md|max-(?:sm|md|lg|xl|2xl|\[[^\]]+\])|min-\[[^\]]+\]):/, `${path}: use phone:, not a width breakpoint`);
  }
});
