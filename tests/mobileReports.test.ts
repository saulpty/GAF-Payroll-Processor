// 2026-10-13 — phone view M14: Attendance → Reports, day tiles two across and the day sheet
// (prompt 2026-10-13-mobile-rows/16-reports-tiles.md). Unit tests for reportDayText plus source
// guards. Lives in tests/ once the prompt is sent; it fails until the export lands.
//
// MR4 is the "a computer is untouched" proof for the page and the table: take the prompt's edits
// back out and each file must be, byte for byte, what it was on 2026-10-13. If one of them is
// changed on purpose before this prompt is sent, re-pin its hash (and re-check the anchors) first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import type { ReportRow } from '../src/app/lib/attendanceReportTypes.ts';

const TEXT = '../src/app/lib/reportDayText.ts';
const lib = (): Promise<typeof import('../src/app/lib/reportDayText.ts')> => import(TEXT);

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

const A = 'src/app/pages/attendance/';
const PAGE = A + 'AttendanceReport.tsx';
const STRIPS = A + 'AttendanceReportStrips.tsx';
const TABLE = A + 'AttendanceReportTable.tsx';
const SHEET = A + 'ReportDaySheet.tsx';
const LIB = 'src/app/lib/reportDayText.ts';

type Flags = ReportRow['flags'];
const flags = (o: Partial<Flags> = {}): Flags => ({
  multipleForms: false, recordedUnexplainedButFormOnFile: false,
  formEmailUnrecognised: false, excusedInPayrollNoRequest: false, ...o,
});

// The sentences as the day tiles showed them on 2026-10-13 (mouse-over text).
const RECORDED = 'Recorded as an unjustified absence even though a form was filed.';
const EMAIL = 'Form submitted by a different email';
const NO_REQUEST = 'Excused in payroll, no Monday request found';
const MULTIPLE = 'Multiple forms submitted';
const BEFORE_SHIFT = 'Form sent before the shift';
const AFTER_SHIFT = 'Form sent after the shift';

test('MR1: infoNote is the tile\'s old rule — the first of the three that applies, in the same order', async () => {
  const { infoNote } = await lib();
  // What AttendanceReportStrips.tsx had inline before the prompt (shown only when one of the three is set).
  const old = (f: Flags) => (f.recordedUnexplainedButFormOnFile ? RECORDED : f.formEmailUnrecognised ? EMAIL : NO_REQUEST);
  for (let bits = 1; bits < 8; bits++) {
    for (const multipleForms of [false, true]) {
      const f = flags({
        recordedUnexplainedButFormOnFile: !!(bits & 1), formEmailUnrecognised: !!(bits & 2),
        excusedInPayrollNoRequest: !!(bits & 4), multipleForms,
      });
      assert.equal(infoNote(f), old(f), JSON.stringify(f));
    }
  }
  assert.equal(infoNote(flags()), '');
  assert.equal(infoNote(flags({ multipleForms: true })), '', 'the copy mark has its own text');
});

test('MR2: flagNotes writes out every flag on the day, none twice, none invented', async () => {
  const { flagNotes, FLAG_NOTE } = await lib();
  assert.deepEqual(flagNotes(flags()), []);
  assert.deepEqual(flagNotes(flags({ multipleForms: true })), [MULTIPLE]);
  assert.deepEqual(flagNotes(flags({ formEmailUnrecognised: true })), [EMAIL]);
  assert.deepEqual(flagNotes(flags({ excusedInPayrollNoRequest: true })), [NO_REQUEST]);
  assert.deepEqual(flagNotes(flags({ recordedUnexplainedButFormOnFile: true })), [RECORDED]);
  // The tile's ⓘ shows one of these; the sheet shows all of them.
  assert.deepEqual(
    flagNotes({ multipleForms: true, recordedUnexplainedButFormOnFile: true, formEmailUnrecognised: true, excusedInPayrollNoRequest: true }),
    [RECORDED, EMAIL, NO_REQUEST, MULTIPLE],
  );
  assert.deepEqual({ ...FLAG_NOTE }, { recorded: RECORDED, email: EMAIL, noRequest: NO_REQUEST, multiple: MULTIPLE });
  const f = flags({ formEmailUnrecognised: true, multipleForms: true });
  const copy = { ...f };
  flagNotes(f);
  assert.deepEqual(f, copy, 'the flags are not changed');
});

test('MR2b: formTiming says when the form was sent', async () => {
  const { formTiming } = await lib();
  assert.equal(formTiming(true), BEFORE_SHIFT);
  assert.equal(formTiming(false), AFTER_SHIFT);
});

test('MR3: each sentence exists in exactly one place in the app', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(`${dir}/${e.name}`);
    }
  };
  walk('src');
  const all = files.map(f => [f, read(f)] as const);
  for (const sentence of [RECORDED, EMAIL, NO_REQUEST, MULTIPLE, BEFORE_SHIFT, AFTER_SHIFT]) {
    const where = all.filter(([, src]) => src.includes(sentence));
    assert.deepEqual(where.map(([f]) => f), [LIB], `"${sentence}" should be in ${LIB} only`);
    assert.equal(count(where[0][1], sentence), 1, `"${sentence}" is written once`);
  }
  // The tiles and the table read them from there.
  const strips = read(STRIPS);
  assert.match(strips, /import \{ FLAG_NOTE, formTiming, infoNote \} from '@\/app\/lib\/reportDayText';/);
  assert.match(strips, /<Info className="w-3 h-3 text-slate-400" title=\{infoNote\(row\.flags\)\} \/>/);
  assert.match(strips, /<Copy className="w-3 h-3 text-slate-400" title=\{FLAG_NOTE\.multiple\} \/>/);
  assert.match(strips, /title=\{formTiming\(row\.form\.onTime\)\}/);
  // The ⓘ is still drawn only when one of its three flags is set.
  assert.match(strips, /\{\(row\.flags\.recordedUnexplainedButFormOnFile \|\| row\.flags\.formEmailUnrecognised \|\| row\.flags\.excusedInPayrollNoRequest\) && \(/);
  assert.match(read(TABLE), /title=\{FLAG_NOTE\.recorded\} \/>/);
  // The pure file stays pure.
  const libSrc = read(LIB);
  assert.deepEqual([...libSrc.matchAll(/^import .*$/gm)].map(m => m[0]), ["import type { ReportRow } from './attendanceReportTypes';"]);
  assert.doesNotMatch(libSrc, /new Date\s*\(|toISOString/);
});

// sha256 as each file was on 2026-10-13 (LF), and the prompt's edits as [now, before].
const EDITS: Record<string, { before: string; undo: Array<[string, string]> }> = {
  [PAGE]: {
    before: '1d0c45be744528651305f367105159ac9805e397d0915ec3a491b97875fc51a5',
    undo: [
      ["import ReportDaySheet from './ReportDaySheet';\nimport { useIsPhone } from '@/app/lib/useIsPhone';\n", ''],
      ["  // A phone shows the Cards view only; tapping a day's tile opens that day in a sheet.\n  const isPhone = useIsPhone();\n  const [openDay, setOpenDay] = useState<ReportRow | null>(null);\n  const shown: View = isPhone ? 'strips' : view;\n", ''],
      ['{/* View toggle (not on a phone: Cards only there) */}\n            {!isPhone && <div className="flex justify-end mb-3">', '{/* View toggle */}\n            <div className="flex justify-end mb-3">'],
      ['            </div>}\n\n            {/* Unmatched forms notice */}', '            </div>\n\n            {/* Unmatched forms notice */}'],
      ["shown === 'strips' && (", "view === 'strips' && ("],
      [' onPickDay={isPhone ? setOpenDay : undefined} />', ' />'],
      ["shown === 'table' && (", "view === 'table' && ("],
      ['      {isPhone && <ReportDaySheet row={openDay} onClose={() => setOpenDay(null)} />}\n', ''],
      // 2026-10-16, international-agents 06b: employees outside payroll use the wide window.
      ["import { liveWindow, liveReportWithOutside } from '@/app/lib/liveAttendance';", "import { liveWindow, liveReport } from '@/app/lib/liveAttendance';"],
      ["  // 2026-10-16: employees outside payroll never get payroll rows, so the whole range is live\n  // for them (wide). Teramind is loaded for the wide range; payroll employees still use `win`.\n  const anyOutside = ((rawEmps as ReportEmployee[]) ?? []).some(e => e.in_payroll === false);\n  const wide = useMemo(\n    () => (anyOutside ? liveWindow([], safeFrom, safeTo, tmToday) : null),\n    [anyOutside, safeFrom, safeTo, tmToday],\n  );\n  const tmWin = wide ?? win;\n", ''],
      ['{ dateFrom: tmWin?.from ?? NO_LIVE.from, dateTo: tmWin?.to ?? NO_LIVE.to, viewAs }', '{ dateFrom: win?.from ?? NO_LIVE.from, dateTo: win?.to ?? NO_LIVE.to, viewAs }'],
      ["const winKey = tmWin ? `${tmWin.from}|${tmWin.to}` : '';", "const winKey = win ? `${win.from}|${win.to}` : '';"],
      ['(tmWin !== null && (loadingTm', '(win !== null && (loadingTm'],
      ['if (!tmWin || errTm) return main;\n    return liveReportWithOutside({\n      input, main, window: win, wide, today: tmToday,', 'if (!win || errTm) return main;\n    return liveReport({\n      input, main, window: win, today: tmToday,'],
      ['win, errTm, wide, tmWin, rawTm', 'win, errTm, rawTm'],
    ],
  },
  [TABLE]: {
    before: '9613abf1a7d525fc22ef72493308578538cb65b3f72197e18b4dbceb839ab0ce',
    undo: [
      ["import { FLAG_NOTE } from '@/app/lib/reportDayText';\n", ''],
      ['title={FLAG_NOTE.recorded} />', `title="${RECORDED}" />`],
    ],
  },
};

test('MR4: on a computer the page and the table are what they were — Cards | Table, both views', () => {
  for (const [path, { before, undo }] of Object.entries(EDITS)) {
    let src = read(path);
    for (const [now, was] of undo) {
      assert.equal(count(src, now), 1, `${path}: expected exactly one ${JSON.stringify(now.trim().slice(0, 60))}`);
      src = src.replace(now, () => was);
    }
    assert.equal(sha(src), before, `${path}: something other than the prompt's edits changed`);
  }
  const page = read(PAGE);
  // The switch and both of its buttons are inside the "not a phone" branch, and nowhere else.
  const from = page.indexOf('{!isPhone && <div className="flex justify-end mb-3">');
  const to = page.indexOf('</div>}', from);
  assert.ok(from > 0 && to > from);
  const toggle = page.slice(from, to);
  assert.match(toggle, /<button onClick=\{\(\) => setView\('strips'\)\} className=\{toggleCls\(view === 'strips'\)\}>/);
  assert.match(toggle, /<button onClick=\{\(\) => setView\('table'\)\} className=\{toggleCls\(view === 'table'\) \+ ' border-l'\}>/);
  assert.equal(count(page, 'setView('), 2);
  // A phone is always on Cards, whatever the switch was left on; a computer follows the switch.
  assert.match(page, /const shown: View = isPhone \? 'strips' : view;/);
  assert.match(page, /\{rows\.length > 0 && shown === 'table' && \(\n\s+<AttendanceReportTable rows=\{rows\} \/>/);
  assert.doesNotMatch(page, /&& view === '(strips|table)' &&/, 'what is drawn follows `shown`, not `view`');
  assert.equal(count(page, 'useIsPhone()'), 1, 'the page asks once');
  assert.equal((page.match(/useLoadAction\(/g) ?? []).length, 8, 'no loader added');
});

test('MR5: a tile can be tapped only on a phone, and then it is a button', () => {
  const page = read(PAGE), strips = read(STRIPS);
  // Only a phone hands the tiles something to call, and only a phone mounts the sheet.
  assert.match(page, /onPickDay=\{isPhone \? setOpenDay : undefined\}/);
  assert.match(page, /\{isPhone && <ReportDaySheet row=\{openDay\} onClose=\{\(\) => setOpenDay\(null\)\} \/>\}/);
  // The call travels page → cards → tile untouched.
  assert.match(strips, /export function AttendanceReportStrips\(\{ rows, perEmployee, onPickDay \}: Props\) \{/);
  assert.match(strips, /thisYear=\{thisYear\}\n\s+onPick=\{onPickDay\}/);
  assert.match(strips, /<DayTile key=\{r\.date \+ r\.employeeId\} row=\{r\} thisYear=\{thisYear\} onPick=\{onPick\} \/>/);
  // Without it (a computer) the tile gets no role, no tab stop, no click.
  assert.match(strips, /\{\.\.\.\(onPick \? tappable\(\(\) => onPick\(row\)\) : \{\}\)\}/);
  assert.match(strips, /aria-label=\{onPick \? `[^`]+` : undefined\}/);
  assert.equal(count(strips, 'onClick'), 1, 'the only click handler is the one inside tappable()');
  const tappable = strips.slice(strips.indexOf('const tappable ='), strips.indexOf('type TileProps'));
  assert.match(tappable, /role: 'button', tabIndex: 0, onClick: go,/);
  assert.match(tappable, /e\.key === 'Enter' \|\| e\.key === ' '/);
  // The strips file does not import the sheet (the page owns it), so there is no import loop.
  assert.doesNotMatch(strips, /ReportDaySheet|useIsPhone|useState/);
});

test('MR6: the sheet writes the day out with the tiles\' own words and formatters — no second copy', () => {
  const sheet = read(SHEET), strips = read(STRIPS);
  assert.match(sheet, /import \{ VERDICT_LABEL, fmtMins, time \} from '\.\/AttendanceReportStrips';/);
  assert.match(sheet, /import \{ flagNotes, formTiming \} from '@\/app\/lib\/reportDayText';/);
  assert.match(sheet, /import MobileSheet from '@\/app\/components\/mobile\/MobileSheet';/);
  for (const name of ['VERDICT_LABEL', 'fmtMins', 'time']) {
    assert.match(strips, new RegExp(`^export const ${name}\\b`, 'm'), `${name} is exported from the strips file`);
  }
  // Full verdict wording (the tile shows the short one), times, how late, the form and its reason, every flag.
  assert.match(sheet, /\{VERDICT_LABEL\[row\.verdict\]\}/);
  assert.doesNotMatch(sheet, /CARD_LABEL/);
  assert.match(sheet, /\{time\(row\.entryTime\)\} → \{time\(row\.exitTime\)\}/);
  assert.match(sheet, /\{row\.minutesLate > 0 \? fmtMins\(row\.minutesLate\) : '—'\}/);
  assert.match(sheet, /\{row\.form \? row\.form\.type : '—'\}/);
  assert.match(sheet, /\{formTiming\(row\.form\.onTime\)\}/);
  assert.match(sheet, /\{row\.form && row\.form\.reason && <Line label="Reason">\{row\.form\.reason\}<\/Line>\}/);
  assert.match(sheet, /const notes = row \? flagNotes\(row\.flags\) : \[\];/);
  assert.match(sheet, /\{notes\.map\(n => \(/);
  // No word list, time maths or date maths of its own; nothing that needs a mouse; reading only.
  assert.doesNotMatch(sheet, /Record<Verdict|on_time|fmtTime\(|fmtDuration\(|new Date\s*\(|toISOString|toLocale/);
  assert.doesNotMatch(sheet, /\stitle="|onMouse|<button|<input|<a\s|useLoadAction|@\/actions\//);
  assert.match(sheet, /open=\{row !== null\}/);
  assert.match(sheet, /title=\{row \? fmtDayLong\(row\.date\) : ''\}/);
  assert.match(sheet, /subtitle=\{row \? row\.employeeName : undefined\}/);
});

test('MR7: every new or edited file stays under 15,000 bytes; no forbidden pieces', () => {
  for (const f of [LIB, SHEET, PAGE, STRIPS, TABLE]) {
    const raw = readFileSync(new URL(`../${f}`, import.meta.url));
    assert.ok(Buffer.byteLength(raw) < 15000, `${f} is ${Buffer.byteLength(raw)} bytes`);
    const src = read(f);
    assert.doesNotMatch(src, /(^|[\s"'`])(max|min)-(sm|md|lg|xl|2xl|phone|\[[^\]\s]*\]):/, `${f}: max-*: / min-*: variants do not work in this app`);
    assert.doesNotMatch(src, /window\.location\.reload|pushState|replaceState/, f);
  }
  for (const f of [SHEET, STRIPS]) {
    assert.doesNotMatch(read(f), /(^|[\s"'`])(sm|md|lg|xl):/, `${f}: the phone switch is the hook or phone:, never sm:/md:`);
  }
});
