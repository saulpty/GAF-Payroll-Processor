// 2026-10-13 — phone view, prompt 2026-10-13-mobile/04 (plan step M3): Payroll and Admin stay
// computer-sized inside DesktopCanvas, page headers wrap, the ⓘ opens on a tap. Source guards.
// Written to live in the repository's tests/ folder; it waits beside the prompt until the prompt
// is sent, and fails until that export lands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const url = (p: string) => new URL(`../${p}`, import.meta.url);
const read = (p: string) => readFileSync(url(p), 'utf8');

const NEW_OR_EDITED = [
  'src/app/components/mobile/DesktopCanvas.tsx',
  'src/app/app.tsx',
  'src/app/pages/admin/AdminLayout.tsx',
  'src/app/components/PageHeader.tsx',
  'src/app/components/InfoTip.tsx',
  'src/app/components/AccessGate.tsx',
];

const PAYROLL_ROUTES: [string, string][] = [
  ['/process', 'ProcessPayroll'],
  ['/action-required', 'ActionRequired'],
  ['/payroll-master', 'PayrollMaster'],
  ['/period-log', 'PeriodLog'],
  ['/hrk-summary', 'HrkSummary'],
];

// The payroll files this prompt wraps but must never edit. sha256 of the text with CRLF turned
// into LF (exports arrive with either), recorded 2026-10-13 against main at 204c348.
// When Saul asks for a payroll change on purpose, re-record the line for that file.
const UNTOUCHED: Record<string, string> = {
  'src/app/pages/ProcessPayroll.tsx': 'eabe1ce1122c1a1b3af573718578d85766224249882d717f830db23e5f33513f',
  'src/app/pages/PayrollMaster.tsx': '658945bbff6090cdf5c8a6818a0b8832865e0942a0fd7c70afbcad9dbba20845',
  'src/app/pages/ActionRequired.tsx': '8cf58cfb3a7a1d0b3759c4df289cba5fdae786aa5641b15cf79ee666834e8b10',
  'src/app/lib/classificationEngine.ts': '0ede6351f328c4f31e173df26f4580104d92c822a517790d3f71526b76a257b0',
  'src/app/pages/admin/AdminLookups.tsx': '9cbbf295a1708dcb9f31298d2e0ba0b985a203a98ebb73b62bd8c5e8c2960750',
  'src/app/lib/teramindParser.ts': '4c3e4ce1d3f48b35a3793fcac872f4d786b67a78e6556b8dd7b77f8fdc270bc6',
};

test('MC1: each Payroll route puts its page in DesktopCanvas, inside RequireSuper', () => {
  const app = read('src/app/app.tsx');
  assert.match(app, /^import DesktopCanvas from '@\/app\/components\/mobile\/DesktopCanvas';$/m);
  const lines = app.split('\n');
  for (const [path, page] of PAYROLL_ROUTES) {
    const line = lines.find(l => l.includes(`path="${path}"`));
    assert.ok(line, `route ${path} not found`);
    assert.ok(
      line!.includes(`element={<RequireSuper><DesktopCanvas><${page} /></DesktopCanvas></RequireSuper>}`),
      `route ${path}: expected <RequireSuper><DesktopCanvas><${page} /></DesktopCanvas></RequireSuper> on one line`,
    );
  }
});

test('MC2: only the five Payroll routes are wrapped in app.tsx; manager pages are left alone', () => {
  const app = read('src/app/app.tsx');
  assert.equal((app.match(/<DesktopCanvas>/g) ?? []).length, PAYROLL_ROUTES.length);
  for (const path of ['/contracts', '/disciplinary', '/pto', '/attendance/*', '/admin']) {
    const line = app.split('\n').find(l => l.includes(`path="${path}"`));
    assert.ok(line, `route ${path} not found`);
    assert.doesNotMatch(line!, /DesktopCanvas/, `route ${path} must not be wrapped here`);
  }
});

test('MC3: Admin pages get the canvas once, inside AdminLayout\'s own scroll area', () => {
  const layout = read('src/app/pages/admin/AdminLayout.tsx');
  assert.match(layout, /import DesktopCanvas from '@\/app\/components\/mobile\/DesktopCanvas';/);
  assert.match(
    layout,
    /<div className="h-full overflow-auto">\s*<DesktopCanvas>\s*<Outlet \/>\s*<\/DesktopCanvas>\s*<\/div>/,
    'the scrolling div stays outside the canvas, so it is the area that slides',
  );
});

test('MC4: DesktopCanvas always renders the same one div, so a size flip never remounts the page', () => {
  const src = read('src/app/components/mobile/DesktopCanvas.tsx');
  assert.match(src, /import \{ useIsPhone \} from '@\/app\/lib\/useIsPhone';/);
  assert.match(src, /export default function DesktopCanvas\(\{ children \}: \{ children: ReactNode \}\)/);
  assert.doesNotMatch(src, /matchMedia|innerWidth|PHONE_QUERY/, 'the query is written once, in useIsPhone');
  const code = src.replace(/^\s*\/\/.*$/gm, ''); // the comments explain the trap; only the code is checked
  // Process Payroll keeps an unsaved run in page state: a wrapper that comes and goes would lose it.
  assert.equal((code.match(/\breturn\b/g) ?? []).length, 1, 'one return: no second code path');
  assert.equal((code.match(/<div/g) ?? []).length, 1, 'one wrapper element');
  assert.doesNotMatch(code, /<>|<Fragment|return children|return \(?\s*\{?children/, 'never bare children');
  assert.match(
    code,
    /return <div className=\{isPhone \? 'desktop-canvas h-full min-w-\[1024px\]' : 'desktop-canvas contents'\}>\{children\}<\/div>;/,
    'desktop-canvas at every size (index.css keys on it, tablets included); computer: display: contents, no box',
  );
  assert.doesNotMatch(code, /@\/actions\/|useLoadAction/, 'layout only: no data');
});

test('MC5: the ⓘ keeps its hover text, opens on a click or tap, and never sorts the column', () => {
  const tip = read('src/app/components/InfoTip.tsx');
  assert.match(tip, /export default function InfoTip\(\{ text \}: \{ text: string \}\)/, 'callers are not edited: props stay the same');
  assert.match(tip, /title=\{/, 'hover still shows the browser tooltip');
  assert.match(tip, /aria-label=\{text\}/);
  assert.match(tip, /tabIndex=\{0\}/);
  const code = tip.replace(/^\s*\/\/.*$/gm, ''); // comments may mention <button>; the markup may not use one
  assert.doesNotMatch(code, /<button/, 'DataTable renders it inside the sort <button>: a button in a button is invalid');
  const onClick = tip.slice(tip.indexOf('function onClick('), tip.indexOf('function onKeyDown('));
  assert.match(onClick, /e\.stopPropagation\(\);/, 'a click on the ⓘ must not reach the header\'s sort handler');
  assert.match(onClick, /toggle\(\);/);
  assert.match(tip, /e\.key === 'Escape'/, 'Esc closes it');
  assert.match(tip, /addEventListener\('pointerdown'/, 'a tap elsewhere closes it');
  assert.equal(
    (tip.match(/addEventListener\(/g) ?? []).length,
    (tip.match(/removeEventListener\(/g) ?? []).length,
    'every listener is removed again',
  );
  assert.doesNotMatch(tip, /useIsPhone/, 'works at every width: a tablet has no hover either');
  // DataTable still hands it the text from inside the sort button; that file is not edited.
  assert.match(read('src/app/components/DataTable.tsx'), /\{c\.label\}\{c\.tip && <InfoTip text=\{c\.tip\} \/>\}\s*<Icon/);
});

test('MC6: PageHeader and AccessGate change by styling only', () => {
  const ph = read('src/app/components/PageHeader.tsx');
  assert.match(ph, /export default function PageHeader\(\{ title, subtitle, actions \}: \{ title: string; subtitle\?: string; actions\?: ReactNode \}\)/);
  assert.doesNotMatch(ph, /useIsPhone/, 'one header, restyled with phone: classes, never rendered twice');
  assert.match(ph, /\{actions && <div className="[^"]*">\{actions\}<\/div>\}/);
  const gate = read('src/app/components/AccessGate.tsx');
  assert.match(gate, /if \(status === 'ready'\) return <>\{children\}<\/>;/, 'a signed-in user still gets the app with no wrapper');
  assert.doesNotMatch(gate, /useIsPhone/);
});

test('MC7: the payroll files are wrapped from outside, not edited', () => {
  for (const [file, sha] of Object.entries(UNTOUCHED)) {
    const got = createHash('sha256').update(read(file).replace(/\r\n/g, '\n')).digest('hex');
    assert.equal(got, sha, `${file} changed`);
  }
});

test('MC8: every file of this prompt is under 15 KB and never reloads or rewrites history', () => {
  for (const f of NEW_OR_EDITED) {
    const size = statSync(url(f)).size;
    assert.ok(size < 15 * 1024, `${f} is ${size} bytes`);
    assert.doesNotMatch(read(f), /location\.reload|history\.(pushState|replaceState)/, f);
  }
});
