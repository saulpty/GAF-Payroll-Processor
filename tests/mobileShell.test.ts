// 2026-10-13 — phone view, the frame: plan steps M0, M1a, M1b
// (prompts 2026-10-13-mobile/00-sections-reachable.md, 01-switch-and-counts.md, 02-phone-frame.md).
// Pure tests for the two rule files, and source guards for the rest.
//
// The three prompts are sent one at a time, so each test says which prompt it waits for
// (MS0x = prompt 00, MS1x = prompt 01, MS2x = prompt 02). SENT_THROUGH is the number of the last
// prompt that HAS BEEN SENT: its tests, and every earlier prompt's, must pass (they fail until
// that export lands, which is the habit here). Tests of prompts not sent yet are reported as
// "todo" and do not turn the suite red.
//
//   Move this file to tests/ when 00 is sent     → leave SENT_THROUGH = 0
//   When 01 is sent                              → SENT_THROUGH = 1
//   When 02 is sent                              → SENT_THROUGH = 2  (and it stays 2)
//
// With 01, ALSO change WN3 in tests/warmPto.test.ts: its /<TopNav \/>\s*<SectionBar \/>/ becomes
// /<TopNav badges=\{badges\} \/>\s*<SectionBar \/>/ (TopNav now takes the counts as a prop).
// MS13 below is that same check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SENT_THROUGH: 0 | 1 | 2 = 1;
const waitsFor = (prompt: 0 | 1 | 2) =>
  prompt > SENT_THROUGH ? { todo: `waits for prompt 0${prompt} (SENT_THROUGH is ${SENT_THROUGH})` } : {};

const url = (p: string) => new URL(`../${p}`, import.meta.url);
const read = (p: string) => readFileSync(url(p), 'utf8').replace(/\r\n/g, '\n');
const size = (p: string) => statSync(url(p)).size;
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;
const walk = (dir: string): string[] =>
  readdirSync(url(dir), { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]);

const TOPNAV = 'src/app/TopNav.tsx';
const REFRESH = 'src/app/components/RefreshButton.tsx';
const APP = 'src/app/app.tsx';
const TAILWIND = 'src/tailwind.config.js';
const IS_PHONE = 'src/app/lib/useIsPhone.ts';
const BADGES = 'src/app/lib/useNavBadges.ts';
const MOBILE_NAV = 'src/app/lib/mobileNav.ts';
const SHEET = 'src/app/components/mobile/MobileSheet.tsx';
const BOTTOM = 'src/app/components/mobile/BottomNav.tsx';
const UI_DIALOG = 'src/components/ui/dialog.tsx';

const QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)';
const under15 = (files: string[]) => {
  for (const f of files) assert.ok(size(f) < 15 * 1024, `${f} is ${size(f)} bytes; the limit is 15 KB`);
};

// ───────────────────────── Prompt 00: sections reachable (M0) ─────────────────────────

test('MS01: the Refresh word is its own element, so a phone can hide it; the icon and the label for screen readers stay', waitsFor(0), () => {
  const btn = read(REFRESH);
  assert.match(btn, /<span className="[^"]+">\{busy \? 'Refreshing…' : 'Refresh'\}<\/span>/,
    'the word must sit in a <span>, not loose in the button');
  assert.match(btn, /aria-label="Refresh data"/);
  assert.match(btn, /<RefreshCw className=\{cn\('[^']*', busy && 'animate-spin'\)\} \/>/, 'the icon is always rendered');
});

test('MS02: while viewing as someone, the person\'s name is outside the part a phone hides', waitsFor(0), () => {
  const nav = read(TOPNAV);
  // "Viewing As " is wrapped on its own; the name follows it, outside that wrapper.
  assert.match(nav, /<span><span className="[^"]+">Viewing As <\/span>\{name \|\| email\}<\/span>/);
  // The ordinary name pill: name and role are each their own element; the person icon is not inside either.
  assert.match(nav, /<UserCircle className="w-3\.5 h-3\.5" \/>\s*<span className="[^"]+">\{name \|\| email\}<\/span>\s*<span className="[^"]+">· \{isSuper \? 'Super User' : 'Manager'\}<\/span>/);
  assert.match(nav, /<RefreshButton \/>\s*\{isViewingAs \? \(/, 'RB1: the Refresh button stays directly before the name pill');
});

test('MS03: prompt 00 files stay under 15 KB', waitsFor(0), () => {
  under15([TOPNAV, REFRESH]);
});

// ───────────────────────── Prompt 01: the switch and the counts (M1a) ─────────────────────────

test('MS10: one phone query, written identically in the hook and in the Tailwind screen', waitsFor(1), () => {
  const inHook = read(IS_PHONE).match(/export const PHONE_QUERY = '([^']+)';/)?.[1];
  const inTailwind = read(TAILWIND).match(/phone: \{ raw: '([^']+)' \}/)?.[1];
  assert.equal(inHook, QUERY, 'PHONE_QUERY in useIsPhone.ts');
  assert.equal(inTailwind, QUERY, 'screens.phone.raw in tailwind.config.js');
  assert.equal(inHook, inTailwind);
  const tw = read(TAILWIND);
  const extend = tw.indexOf('    extend: {');
  assert.ok(extend > 0 && tw.indexOf('      screens: {\n        phone:') > extend,
    'the phone screen must sit inside theme.extend, or it deletes sm/md/lg/xl/2xl');
  assert.equal(count(tw, /\bscreens: \{/g), 2, 'only container.screens and extend.screens');
});

test('MS11: the hook is right on the first render and follows the screen afterwards', waitsFor(1), () => {
  const hook = read(IS_PHONE);
  assert.match(hook, /useState<boolean>\(matchesPhone\)/, 'first value comes from matchMedia inside the useState initialiser');
  assert.match(hook, /window\.matchMedia\(PHONE_QUERY\)\.matches/);
  assert.match(hook, /mq\.addEventListener\('change', onChange\);\s*return \(\) => mq\.removeEventListener\('change', onChange\);/);
  assert.equal(count(hook, /'\(max-width/g), 1, 'the query is written once in this file');
});

test('MS12: useNavBadges runs the same three counts with the same flat parameters TopNav used', waitsFor(1), () => {
  const src = read(BADGES);
  assert.match(src, /const \{ viewAs \} = useViewer\(\);/);
  assert.match(src, /const asOf\s+= toLocalYMD\(new Date\(\)\);/, '"today" is toLocalYMD(new Date()), never toISOString');
  assert.match(src, /useLoadAction\(loadContractsExpiringCountAction, \[\] as \{ count: number \}\[\], \{ viewAs \}\);/);
  assert.match(src, /useLoadAction\(loadDisciplinaryDueCountAction, \[\] as \{ count: number \}\[\], \{ asOf \}\);/);
  assert.match(src, /useLoadAction\(loadPtoReviewCountAction, \[\] as \{ count: number \}\[\], \{ today: asOf, manager: null, viewAs \}\);/);
  assert.equal(count(src, /useLoadAction\(/g), 3, 'three counts, no new loader');
  assert.doesNotMatch(src, /\{\s*params\s*:/, 'parameters go flat, never { params: { … } }');
  assert.match(src, /if \(ptoVersionRef\.current !== ptoVersion\) \{\s*ptoVersionRef\.current = ptoVersion;\s*reloadReview\(\);/,
    'a PTO write anywhere still reloads the PTO count');
  assert.match(src, /export type NavBadges = \{ contracts: number; disciplinary: number; pto: number \};/);
  assert.match(src, /return \{ contracts: expiringCount, disciplinary: dueCount, pto: reviewCount \};/);
});

test('MS13: the counts are loaded once, in Shell, and handed to the top bar as a prop', waitsFor(1), () => {
  const nav = read(TOPNAV);
  assert.doesNotMatch(nav, /@\/actions\//, 'TopNav imports no action any more');
  assert.doesNotMatch(nav, /useLoadAction|useGlobalFilters|toLocalYMD/);
  assert.match(nav, /export default function TopNav\(\{ badges \}: \{ badges: NavBadges \}\)/);

  const app = read(APP);
  assert.match(app, /function Shell\(\{ children \}: \{ children: ReactNode \}\) \{\s*const badges = useNavBadges\(\);/);
  assert.match(app, /<TopNav badges=\{badges\} \/>\s*<SectionBar \/>/, 'row 1 then row 2 (this replaces WN3\'s <TopNav />)');
  assert.match(app, /<RefreshBoundary>\s*<Shell>/, 'Shell sits inside the refresh boundary, so Refresh reloads the counts too');
  assert.match(app, /<div key=\{refreshVersion\}/);
  assert.match(app, /<MondayAutoSync \/>\s*<RefreshBoundary>/);

  const callers = walk('src/app').filter(f => /\.tsx?$/.test(f) && f !== BADGES && /useNavBadges\(\)/.test(read(f)));
  assert.deepEqual(callers, [APP], 'useNavBadges() is called in app.tsx only: a second caller doubles the count queries');
  assert.equal(count(app, /useNavBadges\(\)/g), 1);
});

test('MS14: no max-*: or min-*: Tailwind variant anywhere (the raw phone screen switches them off)', waitsFor(1), () => {
  const offenders = walk('src/app').concat(walk('src/components'))
    .filter(f => /\.tsx?$/.test(f))
    .filter(f => /(?:^|[\s"'`:])(?:max|min)-(?:sm|md|lg|xl|2xl|\[[^\]\s]+\]):/m.test(read(f)));
  assert.deepEqual(offenders, []);
});

test('MS15: after prompt 01 neither bar file uses md: as the phone switch', waitsFor(1), () => {
  for (const f of [TOPNAV, REFRESH]) {
    assert.doesNotMatch(read(f), /(?<![\w-])md:/, `${f}: the phone switch is phone:, never md:`);
  }
  assert.match(read(REFRESH), /aria-label="Refresh data"/);
});

test('MS16: prompt 01 files stay under 15 KB', waitsFor(1), () => {
  under15([TOPNAV, REFRESH, APP, TAILWIND, IS_PHONE, BADGES]);
});

// ───────────────────────── Prompt 02: the phone frame (M1b) ─────────────────────────

type Items = { bar: string[]; more: string[] };
type Badge = { count: number; label: string } | null;
type NavRules = {
  mobileNavItems: (isSuper: boolean) => Items;
  navBadge: (id: string, badges: { contracts: number; disciplinary: number; pto: number }, isSuper: boolean) => Badge;
};
// Imported inside each test: the file does not exist until prompt 02 lands.
const rules = async (): Promise<NavRules> => await import(url(MOBILE_NAV).href);

test('MS20: a manager gets four sections in the computer\'s order and no More', waitsFor(2), async () => {
  const { mobileNavItems } = await rules();
  assert.deepEqual(mobileNavItems(false), { bar: ['attendance', 'disciplinary', 'contracts', 'pto'], more: [] });
});

test('MS21: a super user gets the same four, plus Payroll and Admin under More', waitsFor(2), async () => {
  const { mobileNavItems } = await rules();
  assert.deepEqual(mobileNavItems(true), { bar: ['attendance', 'disciplinary', 'contracts', 'pto'], more: ['payroll', 'admin'] });
});

test('MS22: bar and More together are exactly the computer\'s sections, in the computer\'s order', waitsFor(2), async () => {
  const { mobileNavItems } = await rules();
  const nav = read(TOPNAV);
  const sections = nav.slice(nav.indexOf('export const SECTIONS = ['), nav.indexOf('] as const;'));
  const desktop = [...sections.matchAll(/^    id: '(\w+)',$/gm)].map(m => m[1]);
  assert.equal(desktop.length, 6);
  const { bar, more } = mobileNavItems(true);
  assert.deepEqual(desktop.filter(id => bar.includes(id)), bar, 'bar order');
  assert.deepEqual(desktop.filter(id => more.includes(id)), more, 'More order');
  assert.deepEqual([...bar, ...more].sort(), [...desktop].sort(), 'no section is unreachable on a phone');
  assert.doesNotMatch(read(MOBILE_NAV), /^\s*import\b/m, 'mobileNav.ts stays pure: no imports');
});

test('MS23: a manager never sees the Disciplinary count; a super user does', waitsFor(2), async () => {
  const { navBadge } = await rules();
  const badges = { contracts: 2, disciplinary: 5, pto: 1 };
  assert.equal(navBadge('disciplinary', badges, false), null);
  assert.deepEqual(navBadge('disciplinary', badges, true), { count: 5, label: '5 disciplinary re-evaluations due' });
  assert.deepEqual(navBadge('contracts', badges, false), { count: 2, label: '2 contracts ending within 30 days' });
  assert.deepEqual(navBadge('pto', badges, false), { count: 1, label: '1 PTO request ready to record' });
});

test('MS24: a zero count shows no badge, and sections without a count never get one', waitsFor(2), async () => {
  const { navBadge } = await rules();
  const none = { contracts: 0, disciplinary: 0, pto: 0 };
  for (const id of ['contracts', 'disciplinary', 'pto']) assert.equal(navBadge(id, none, true), null, id);
  const some = { contracts: 3, disciplinary: 3, pto: 3 };
  for (const id of ['attendance', 'payroll', 'admin', '']) assert.equal(navBadge(id, some, true), null, id);
  assert.deepEqual(navBadge('contracts', { ...none, contracts: 1 }, true), { count: 1, label: '1 contract ending within 30 days' });
});

test('MS25: both bars take the badge rule from mobileNav.ts and neither loads a count', waitsFor(2), () => {
  const nav = read(TOPNAV);
  const bottom = read(BOTTOM);
  assert.match(nav, /navBadge\(s\.id, badges, isSuper\)/);
  assert.match(bottom, /navBadge\(s\.id, badges, isSuper\)/);
  assert.doesNotMatch(nav, /function sectionBadge/, 'one rule, not two copies');
  assert.match(bottom, /export default function BottomNav\(\{ badges \}: \{ badges: NavBadges \}\)/);
  assert.match(bottom, /mobileNavItems\(isSuper\)/);
  assert.doesNotMatch(bottom, /useLoadAction|useNavBadges\(|@\/actions\//, 'BottomNav gets the counts as a prop');
  assert.match(bottom, /Best on a computer/);
});

test('MS26: the bottom bar is rendered by Shell, after the page, on a phone only', waitsFor(2), () => {
  const app = read(APP);
  assert.match(app, /const isPhone = useIsPhone\(\);/);
  assert.match(app, /<main className="flex-1 overflow-auto">\{children\}<\/main>\s*\{isPhone && <BottomNav badges=\{badges\} \/>\}/);
  assert.equal(count(app, /useNavBadges\(\)/g), 1, 'still one call');
  assert.match(app, /<TopNav badges=\{badges\} \/>\s*<SectionBar \/>/);
});

test('MS27: nothing in the frame is position: fixed, and nothing touches browser history', waitsFor(2), () => {
  for (const f of [TOPNAV, BOTTOM, APP]) {
    assert.doesNotMatch(read(f), /(?<![\w-])fixed(?![\w-])/, `${f}: the bars are rows of the page's column, never fixed`);
  }
  for (const f of [TOPNAV, BOTTOM, APP, SHEET, MOBILE_NAV]) {
    assert.doesNotMatch(read(f), /pushState|replaceState|location\.(reload|assign|href)/, f);
  }
});

test('MS28: on a phone the top bar names the section; viewing as someone always shows the name', waitsFor(2), () => {
  const nav = read(TOPNAV);
  assert.match(nav, /\{isPhone \? \(\s*<div[^>]*>\s*\{current && \(/, 'phone: the current section, not the row of sections');
  assert.match(nav, /\) : \(\s*<nav aria-label="Sections"/, 'computer: the row of sections');
  const strip = nav.slice(nav.indexOf('{isViewingAs && isPhone && ('));
  assert.ok(strip.length < nav.length && strip.length > 0, 'the View As strip is rendered only on a phone while viewing as someone');
  assert.match(strip, />Viewing As \{name \|\| email\}</, 'the name is in the strip, in full');
  assert.match(strip, /onClick=\{\(\) => setViewAs\(''\)\}/, 'and it can be stopped');
  assert.ok(nav.indexOf('</header>') < nav.indexOf('{isViewingAs && isPhone && ('), 'the strip is under the bar, not inside it');
  assert.match(nav, /<RefreshButton \/>\s*\{isViewingAs \? \(/, 'RB1');
});

test('MS29: MobileSheet is built on the app\'s dialog, which is used and not edited', waitsFor(2), () => {
  const sheet = read(SHEET);
  assert.match(sheet, /import \{[^}]*\bDialog\b[^}]*\bDialogContent\b[^}]*\bDialogTitle\b[^}]*\} from '@\/components\/ui\/dialog';/);
  assert.doesNotMatch(sheet, /@radix-ui/, 'focus, Esc and scroll lock come from ui/dialog, not from a second dialog');
  assert.match(sheet, /<DialogTitle\b/, 'a dialog without a title is unnamed to a screen reader');
  assert.match(sheet, /onOpenChange=\{next => \{ if \(!next\) onClose\(\); \}\}/);
  assert.equal(createHash('sha256').update(read(UI_DIALOG)).digest('hex'),
    '666e59075459a426bbddf8d3dd4cf020932346281da586673bb9016fc52e7969', 'src/components/ui/dialog.tsx must be byte-identical');
});

test('MS30: keepMounted keeps ONE copy of the children alive; it never renders them in two places', waitsFor(2), () => {
  const sheet = read(SHEET);
  assert.match(sheet, /keepMounted = false/, 'off unless asked for');
  assert.equal(count(sheet, /createPortal\(children, host\)/g), 1, 'kept children are rendered once, into a node the sheet owns');
  assert.match(sheet, /<div ref=\{parkRef\} hidden \/>/, 'while closed that node waits in a hidden wrapper');
  assert.match(sheet, /\{kept && host\s*\? <SheetBody host=\{host\} parkRef=\{parkRef\} \/>\s*: <div className=\{BODY\}>\{children\}<\/div>\}/,
    'kept: the node is moved into the body; not kept: ordinary children');
  assert.equal(count(sheet, /\{children\}/g), 1, 'the only other place children appear is the not-kept body');
});

test('MS31: prompt 02 files stay under 15 KB', waitsFor(2), () => {
  under15([TOPNAV, APP, MOBILE_NAV, SHEET, BOTTOM]);
});
