// 2026-10-13 — phone white bar: tabs or filter chips, plus the Filters button and sheet
// (prompt 2026-10-13-mobile/03-tabs-and-filters.md, plan step M2). Source guards.
//
// The one thing that must never regress: on a phone FilterBar stays mounted while the sheet is
// closed. FilterBar loads the periods and owns the effects that pick the default period and set
// Periods/Dates per route; unmounted, Attendance → List opens with no period and shows nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

const MOBILE = 'src/app/components/mobile/MobileFilters.tsx';
const BAR = 'src/app/SectionBar.tsx';
const FB = 'src/app/FilterBar.tsx';
const PMS = 'src/app/components/PeriodMultiSelect.tsx';
const ESI = 'src/app/components/EmployeeSearchInput.tsx';
const ARC = 'src/app/components/AttendanceRangeControls.tsx';
const ALL = [MOBILE, BAR, FB, PMS, ESI, ARC];

test('MR1: filterRoutes.ts is byte-identical to 2026-10-13 (the prompt imports it, never edits it)', () => {
  // Line endings normalised, as tools/check-baseline.mjs does: exports arrive with either.
  const sha = createHash('sha256').update(read('src/app/lib/filterRoutes.ts').replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(sha, '2a665d5231cd77241d503905e0004c29cb727b4a3bf928a58f012c764fa96156');
});

test('MR2: every new or edited file is under 15 KB', () => {
  for (const f of ALL) {
    const bytes = Buffer.byteLength(read(f));
    assert.ok(bytes < 15000, `${f} is ${bytes} bytes; the limit is 15,000`);
  }
});

test('MR3: FilterBar keeps its three loaders and both period effects, and only gained optional props', () => {
  const fb = read(FB);
  assert.equal(count(fb, /useLoadAction\(/g), 3, 'exactly the three loaders it had');
  assert.match(fb, /useLoadAction\(loadPeriodsAction, \[\] as PeriodRow\[\]\)/);
  assert.match(fb, /useLoadAction\(loadAttendanceEmployeesAction, \[\] as EmpInfo\[\], \{ viewAs \}\)/);
  assert.match(fb, /loadActionRequiredCountsAction,\s*\[\] as CountsRow\[\],\s*\{ periodName: period \},/);
  // The default-period effect, word for word.
  assert.match(fb, /if \(cfg\?\.periods && attendanceMode === 'periods' && attendancePeriods\.length === 0 && def\) \{\s*setAttendancePeriods\(\[def\], rangeOf\(\[def\]\)\);\s*\}/);
  assert.match(fb, /\}, \[cfg\?\.periods, attendanceMode, periodPick\.defaultName, attendancePeriods\.length\]\);/);
  // The Periods/Dates reset per route.
  assert.match(fb, /if \(routeKey !== null && routeKey !== prevRouteRef\.current\) \{\s*prevRouteRef\.current = routeKey;\s*setAttendanceMode\(ATTENDANCE_SWITCH_ROUTES\[routeKey\]!\);/);
  assert.match(fb, /\{hasVisibleFilter\(cfg, \{/, 'Clear Filters still uses the rule');
  assert.match(fb, /const prevRouteRef = useRef<string \| null>\(null\);/);
  assert.equal(count(fb, /useEffect\(/g), 6, 'the five effects it had, plus the one that reports the default period');
  assert.match(fb, /export default function FilterBar\(\{ stacked = false, onDefaultPeriod \}: Props\)/);
  assert.match(fb, /stacked\?: boolean;/);
  assert.match(fb, /onDefaultPeriod\?: \(name: string\) => void;/);
});

test('MR4: on a phone FilterBar lives inside a keepMounted sheet and is never behind a condition', () => {
  const mf = read(MOBILE);
  assert.match(mf, /<MobileSheet\b[^>]*\bkeepMounted\b[^>]*>[\s\S]*<FilterBar stacked\b[^>]*\/>[\s\S]*<\/MobileSheet>/,
    'FilterBar must be a child of <MobileSheet keepMounted>');
  assert.equal(count(mf, /<FilterBar\b/g), 1, 'one FilterBar: two would run every loader and effect twice');
  assert.doesNotMatch(mf, /(&&|\?)\s*\(?\s*<FilterBar\b/, 'FilterBar must not be rendered conditionally');
  assert.doesNotMatch(mf, /(&&|\?)\s*\(?\s*<MobileSheet\b/, 'the sheet itself must not be rendered conditionally');
  assert.doesNotMatch(mf, /keepMounted=\{/, 'keepMounted is always on, not computed');
  assert.match(mf, />\s*Done\s*<\/button>/);
});

test('MR5: the dot uses the Clear Filters rule with every input, and repeats no query', () => {
  const mf = read(MOBILE);
  assert.match(mf, /import \{ getConfig, hasVisibleFilter \} from '@\/app\/lib\/filterRoutes';/);
  const call = mf.match(/hasVisibleFilter\(getConfig\(pathname\), \{([\s\S]*?)\}\)/);
  assert.ok(call, 'MobileFilters must call hasVisibleFilter(getConfig(pathname), {...})');
  // Every field of FilterState, read from filterRoutes.ts itself, must be handed to the rule.
  const state = read('src/app/lib/filterRoutes.ts').match(/export interface FilterState \{([\s\S]*?)\n\}/);
  assert.ok(state);
  const fields = [...state[1].matchAll(/^\s{2}(\w+):/gm)].map(m => m[1]);
  assert.ok(fields.length >= 8);
  for (const f of fields) assert.match(call[1], new RegExp(`\\b${f}\\b`), `the dot ignores "${f}"`);
  assert.doesNotMatch(mf, /useLoadAction|@\/actions\//, 'the default period comes from FilterBar, not from a second loader');
  // FilterBar hands up the one fact only it knows.
  assert.match(mf, /<FilterBar stacked onDefaultPeriod=\{setDefaultPeriod\}/);
  assert.match(read(FB), /useEffect\(\(\) => \{\s*if \(periodPick\.defaultName\) onDefaultPeriod\?\.\(periodPick\.defaultName\);\s*\}, \[periodPick\.defaultName, onDefaultPeriod\]\);/);
});

test('MR6: the phone bar is for manager sections only; Payroll and Admin keep the computer bar', () => {
  const sb = read(BAR);
  assert.match(sb, /if \(isPhone && sec && sec\.id !== 'payroll' && sec\.id !== 'admin'\) \{/);
  assert.match(sb, /\{cfg && <MobileFilters \/>\}/);
  assert.equal(count(sb, /<MobileFilters\b/g), 1);
  assert.match(sb, /<FilterBar \/>/, 'the computer bar still renders FilterBar directly');
  assert.equal(count(sb, /useLoadAction\(/g), 1, 'the chips come from the filter context, not from a new query');
  // Hooks first: the phone branch returns early, so every hook must sit above the first return.
  const firstReturn = sb.indexOf('return null;');
  for (const hook of ['useIsPhone()', 'useViewer()', 'useGlobalFilters()', 'useLoadAction(', 'useEffect(']) {
    const at = sb.indexOf(hook);
    assert.ok(at > 0 && at < firstReturn, `${hook} must be called before the first return`);
  }
  // Chips: the three filters a manager page shows, Manager only for a super user.
  assert.match(sb, /cfg\?\.employee && employee \? `Employee: \$\{employee\}` : ''/);
  assert.match(sb, /cfg\?\.manager && isSuper && manager \? `Manager: \$\{manager\}` : ''/);
  assert.match(sb, /cfg\?\.role && role \? `Title: \$\{role\}` : ''/);
});

test('MR7: no suggestion list on a phone; the period list opens in place only when asked', () => {
  assert.match(read(ESI), /const showList = !isPhone && open && suggestions\.length > 0;/);
  const pms = read(PMS);
  assert.match(pms, /export default function PeriodMultiSelect\(\{ periods, selected, onChange, inline = false \}: Props\)/);
  const list = pms.match(/\{open && \(\s*<div className=\{inline\s*\? '([^']*)'\s*: '([^']*)'\}>/);
  assert.ok(list, 'the list container must choose its classes by `inline`');
  assert.doesNotMatch(list[1], /\babsolute\b/, 'inline: the list must not float');
  assert.equal(list[2], 'absolute left-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-auto min-w-[260px]',
    'the computer popover is unchanged');
  assert.match(read(ARC), /<PeriodMultiSelect\s+periods=\{periods\}\s+inline=\{stacked\}/);
  assert.equal(count(read(FB), /\bstacked=\{stacked\}/g), 2, 'FilterBar passes stacked to the range controls and the employee search');
});

test('MR8: the computer side of every changed class string is the old text', () => {
  const fb = read(FB);
  for (const old of [
    "const inputCls = 'h-8 px-2.5 text-[13px] border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-warm-ring' + (stacked ? ",
    "const boxCls   = 'h-8 flex items-center gap-1.5 pl-2.5 pr-1 border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-warm-ring' + (stacked ? ",
    "const bareSel  = 'h-full max-w-[130px] bg-transparent text-[13px] text-slate-900 focus:outline-none' + (stacked ? ",
    "<div className={stacked ? 'flex flex-col gap-3' : 'flex items-center justify-end gap-2 flex-wrap py-2 min-w-0 phone:",
    "'flex items-center gap-1 text-[12px] text-slate-400 hover:text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded px-1' + (stacked ? ",
  ]) assert.ok(fb.includes(old), `FilterBar.tsx lost or changed: ${old}`);
  const sb = read(BAR);
  assert.ok(sb.includes("cn('shrink-0 bg-white border-b border-slate-200 px-5 min-h-[48px] flex flex-wrap items-center gap-x-3 z-30 no-scrollbar phone:flex-nowrap phone:overflow-x-auto', (sec?.id === 'payroll' || sec?.id === 'admin') && 'desktop-canvas')"), 'the Payroll/Admin bar carries desktop-canvas so touch rules skip its text boxes');
  assert.ok(sb.includes('"flex items-center gap-2 h-12 min-w-0 max-w-full phone:shrink-0 phone:max-w-none"'));
  const arc = read(ARC);
  assert.ok(arc.includes("const box  = stacked ? BOX + ' phone:h-11 w-full' : BOX;"));
  assert.ok(arc.includes("const bare = stacked ? BARE + ' flex-1 min-w-0' : BARE;"));
  assert.ok(read(ESI).includes("className={stacked ? cn(className, 'phone:w-full') : className}"));
  assert.ok(read(PMS).includes("className={inline ? btnCls + ' phone:h-11 w-full' : btnCls}"));
});

test('MR9: no browser reload, no history writes, no wrapped action params in any of the six files', () => {
  for (const f of ALL) {
    const src = read(f);
    assert.doesNotMatch(src, /location\.(reload|assign|href)/, `${f}: the app lives in an iframe`);
    assert.doesNotMatch(src, /pushState|replaceState/, `${f}: the host frame owns history`);
    assert.doesNotMatch(src, /\{\s*params\s*:/, `${f}: action params go flat`);
  }
});
