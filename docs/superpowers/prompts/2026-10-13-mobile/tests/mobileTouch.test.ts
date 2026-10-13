// 2026-10-13 — phone view, touch floor 1 (prompt 2026-10-13-mobile/05-touch-floor.md).
// Source guards plus unit tests for clampPopup. Lives in tests/ once the prompt is sent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const CSS = 'src/index.css';
const PANEL = 'src/app/pages/attendance/AttendancePanel.tsx';
const TOAST = 'src/app/components/ds/Toast.tsx';
const BULK = 'src/app/components/ds/BulkBar.tsx';
const COMBO = 'src/app/components/ds/Combobox.tsx';
const FILTER = 'src/app/components/ds/comboboxFilter.ts';

// index.css as it stood on 2026-10-13 (main at 204c348), line endings normalised to LF.
const CSS_BASE_CHARS = 4690;
const CSS_BASE_SHA256 = 'ca812530ebe9faa27afd6f036ee9c515a2bc8eed7d780fdd00a2fba99cdbe3cc';

const STATUS_LINES = [
  '  --status-green-fill:  #C6EFCE;',
  '  --status-green-ink:   #006100;',
  '  --status-green-tint:  #EDF7EE;',
  '  --status-yellow-fill: #FFEB9C;',
  '  --status-yellow-ink:  #9C6500;',
  '  --status-yellow-tint: #FFFBEB;',
  '  --status-red-fill:    #FFC7CE;',
  '  --status-red-ink:     #9C0006;',
  '  --status-red-tint:    #FFF0F0;',
];

const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** Body of the first `@media (pointer: coarse) { … }` block in `s`, and `s` with that block removed. */
function coarseBlock(s: string): { body: string; rest: string } | null {
  const m = /@media\s*\(pointer:\s*coarse\)\s*\{/.exec(s);
  if (!m) return null;
  let depth = 1;
  let i = m.index + m[0].length;
  for (; i < s.length && depth > 0; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
  }
  if (depth !== 0) return null;
  return { body: s.slice(m.index + m[0].length, i - 1), rest: s.slice(0, m.index) + s.slice(i) };
}

/** [selector list, declarations] for each plain rule in a block body. */
function rules(body: string): Array<[string[], string]> {
  return [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => [
    m[1].split(',').map(x => x.trim()).filter(Boolean),
    m[2],
  ]);
}

/** What was added to index.css after the 2026-10-13 text, comments stripped. */
function cssTail(): string {
  return noComments(read(CSS).slice(CSS_BASE_CHARS));
}

/** `original` is still there, token for token and in order; anything added carries `phone:`. */
function desktopClassesKept(src: string, original: string, where: string) {
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const extra = '(?: phone:[^\\s"`]+)*';
  const re = new RegExp(original.split(' ').map(esc).join(extra + ' ') + extra + '(?=["` ])');
  const m = re.exec(src);
  assert.ok(m, `${where}: the computer's classes must stay, with only phone: classes added`);
  return m[0];
}

test('MT1: everything index.css held before is still there, byte for byte, and the Excel colours with it', () => {
  const css = read(CSS);
  assert.ok(css.length > CSS_BASE_CHARS, 'the touch rules are appended after the existing text');
  const prefix = css.slice(0, CSS_BASE_CHARS);
  assert.equal(
    createHash('sha256').update(prefix).digest('hex'),
    CSS_BASE_SHA256,
    'the existing part of index.css changed: the edit may only append',
  );
  for (const line of STATUS_LINES) {
    assert.equal(css.split('\n').filter(l => l === line).length, 1, `status colour line changed or duplicated: ${line.trim()}`);
  }
  assert.doesNotMatch(css.slice(CSS_BASE_CHARS), /--status-/, 'no status colour may be redefined in the added part');
});

test('MT2: the added CSS reaches touch screens only', () => {
  const block = coarseBlock(cssTail());
  assert.ok(block, 'an @media (pointer: coarse) block is added');
  assert.equal(block.rest.trim(), '', 'nothing may be added outside @media (pointer: coarse): a mouse must see no change');
});

test('MT3: text boxes are 16px on touch, never inside .desktop-canvas, and the rule out-ranks a Tailwind class', () => {
  const block = coarseBlock(cssTail());
  assert.ok(block);
  const sized = rules(block.body).filter(([, decl]) => /font-size\s*:/.test(decl));
  assert.equal(sized.length, 1, 'exactly one rule sets a font size');
  const [selectors, decl] = sized[0];
  assert.match(decl, /font-size:\s*16px\s*;/);
  for (const el of ['input', 'select', 'textarea']) {
    const own = selectors.filter(s => s.startsWith(el));
    assert.equal(own.length, 1, `${el} is covered once`);
    assert.ok(own[0].includes(':not(.desktop-canvas *)'), `${el}: Payroll and Admin (inside .desktop-canvas) keep their sizing`);
  }
  assert.equal(selectors.length, 3, 'only input, select and textarea are resized');
  // A bare `input {}` (0,0,1) loses to `.text-sm` (0,1,0). Each selector needs at least one
  // class-level part (:not(...) counts as its argument) on top of the element name.
  for (const s of selectors) {
    assert.ok((s.match(/:not\(/g) ?? []).length >= 1, `${s}: must be more specific than one utility class`);
  }
  const input = selectors.find(s => s.startsWith('input'))!;
  for (const type of ['checkbox', 'radio']) {
    assert.ok(input.includes(`:not([type="${type}"])`), `${type} boxes are left alone`);
  }
});

test('MT4: a 44px tap helper, and the page, pop-ups and lists do not drag what is behind them', () => {
  const block = coarseBlock(cssTail());
  assert.ok(block);
  const all = rules(block.body);
  const tap = all.find(([sel]) => sel.includes('.tap'));
  assert.ok(tap, '.tap helper');
  assert.match(tap[1], /min-width:\s*44px/);
  assert.match(tap[1], /min-height:\s*44px/);
  const over = all.find(([, decl]) => /overscroll-behavior:\s*contain/.test(decl));
  assert.ok(over, 'overscroll-behavior: contain');
  for (const sel of ['main', '[role="dialog"]']) assert.ok(over[0].includes(sel), `${sel} is contained`);
});

test('MT5: the employee panel is not forced to 520px on a phone', () => {
  const src = read(PANEL);
  const lines = src.split('\n').filter(l => l.includes('clamp(520px'));
  assert.equal(lines.length, 1, 'the computer width is still there, once');
  assert.match(lines[0], /width: isPhone \? '100%' : 'clamp\(520px, 55vw, 900px\)',/, 'full width on a phone, the old width otherwise');
  const hook = src.indexOf('const isPhone = useIsPhone();');
  const early = src.indexOf('if (!stats && resolvedId === null) return null;');
  assert.ok(hook > 0 && early > hook, 'useIsPhone() must be called before the early return');
  assert.match(src, /import \{ useIsPhone \} from '@\/app\/lib\/useIsPhone';/);
});

test('MT6: on a computer the panel, the toast and the bulk bar keep every class they had', () => {
  const panel = read(PANEL);
  desktopClassesKept(panel, 'fixed top-0 right-0 bottom-0 bg-white z-50 overflow-y-auto shadow-2xl flex flex-col', 'panel');
  desktopClassesKept(panel, 'sticky top-0 bg-white border-b border-border px-7 py-5 flex items-start justify-between z-10', 'panel header');
  desktopClassesKept(panel, 'w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-border transition-colors shrink-0 ml-4', 'panel close');
  desktopClassesKept(panel, 'p-7 flex flex-col gap-6', 'panel body');

  const toast = desktopClassesKept(read(TOAST), 'pointer-events-none fixed bottom-4 left-4 z-50 flex w-80 flex-col gap-2', 'toast');
  const bar = desktopClassesKept(read(BULK), 'fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-[12px] text-white shadow-xl', 'bulk bar');

  // The section bar at the bottom of a phone is 56px tall: anything floating must clear it by 16.
  const lift = (cls: string, what: string) => {
    const m = /phone:bottom-\[(\d+)px\]/.exec(cls);
    assert.ok(m, `${what}: needs a phone bottom offset in px`);
    return Number(m[1]);
  };
  const barLift = lift(bar, 'bulk bar');
  const toastLift = lift(toast, 'toast');
  assert.ok(barLift >= 72, `bulk bar sits ${barLift}px up; the section bar needs 72`);
  assert.ok(toastLift >= 72, `toast sits ${toastLift}px up; the section bar needs 72`);
  assert.ok(toastLift >= barLift + 60, 'a toast must not cover the bulk bar (about 60px tall on a phone)');
  // left: 50% leaves a fixed box only half the screen to shrink into; on a phone it is pinned to both edges instead.
  for (const cls of ['phone:left-3', 'phone:right-3', 'phone:translate-x-0']) {
    assert.ok(bar.split(' ').includes(cls), `bulk bar: ${cls}`);
  }
});

test('MT7: clampPopup keeps a list inside the left and right edges', async () => {
  const { clampPopup } = await import('../src/app/components/ds/comboboxFilter.ts');
  // Already fits: returned unchanged (this is every case on a wide screen).
  assert.deepEqual(clampPopup(100, 180, 375), { left: 100, width: 180 });
  assert.deepEqual(clampPopup(8, 359, 375), { left: 8, width: 359 });
  // Would pass the right edge: pulled back to leave the margin.
  assert.deepEqual(clampPopup(300, 180, 375), { left: 187, width: 180 });
  // Field slid off the left edge of the screen.
  assert.deepEqual(clampPopup(-40, 180, 375), { left: 8, width: 180 });
  // Wider than the screen: narrowed, then placed at the margin.
  assert.deepEqual(clampPopup(20, 600, 375), { left: 8, width: 359 });
  // Custom margin, and a degenerate screen never yields a negative width.
  assert.deepEqual(clampPopup(300, 180, 375, 12), { left: 183, width: 180 });
  assert.deepEqual(clampPopup(0, 180, 10), { left: 8, width: 0 });
  // Whatever goes in, the right edge stays inside.
  for (const left of [-500, 0, 150, 374, 2000]) {
    for (const width of [60, 180, 340, 900]) {
      const r = clampPopup(left, width, 375);
      assert.ok(r.left >= 8 && r.left + r.width <= 375 - 8, `left ${left}, width ${width} → ${JSON.stringify(r)}`);
    }
  }
});

test('MT8: the dropdown is clamped and keyboard-proof on a phone only', () => {
  const src = read(COMBO);
  assert.match(src, /const box = isPhone \? clampPopup\(want\.left, want\.width, window\.innerWidth\) : want;/);
  assert.match(src, /const want = \{ left: r\.left, width: Math\.max\(r\.width, 180\) \};/, 'the computer position is the old one');
  // The keyboard changes the height only; a computer still closes on any resize.
  assert.doesNotMatch(src, /const onResize = \(\) => setOpen\(false\);/);
  assert.match(src, /if \(!isPhone \|\| window\.innerWidth !== openWidth\) setOpen\(false\);/);
  // The keyboard pans the document; a computer still closes on any outside scroll.
  assert.match(src, /if \(!inside\(e\.target\) && !\(isPhone && pagePan\(e\.target\)\)\) setOpen\(false\);/);
  assert.match(src, /window\.addEventListener\('scroll', onScroll, true\)/);
  assert.equal((src.match(/\}, \[open, isPhone\]\);/g) ?? []).length, 2, 'both effects re-run when the screen switches');
});

test('MT9: comboboxFilter stays a pure module, and every edited file stays under 15 KB', () => {
  assert.doesNotMatch(read(FILTER), /^import /m, 'comboboxFilter.ts is imported by plain node tests: no imports');
  for (const f of [CSS, PANEL, TOAST, BULK, COMBO, FILTER]) {
    const size = Buffer.byteLength(read(f), 'utf8');
    assert.ok(size < 15 * 1024, `${f} is ${size} bytes`);
  }
});
