// Warm design system: navy top bar for the whole app + PTO Tracker restyle (Saul, 2026-10-06).
// Prompts: docs/superpowers/prompts/2026-10-06-pto-columns/04..06.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('WN1: the top bar is navy; each section keeps its own colour (nav option A)', () => {
  const nav = read('src/app/TopNav.tsx');
  assert.match(nav, /<header className="topnav-dark [^"]*bg-\[var\(--topnav\)\]/);
  assert.doesNotMatch(nav, /<header className="[^"]*bg-white/);
  assert.match(nav, /style=\{isActive \? \{ borderBottomColor: s\.color\.icon \} : undefined\}/, 'active section underlined in its own colour');
  assert.match(nav, /<s\.icon className="w-4 h-4" style=\{\{ color: s\.color\.icon \}\} \/>/, 'every section icon is always coloured');
  assert.equal((nav.match(/color: \{ icon: '#[0-9A-F]{6}', accent: '#[0-9A-F]{6}', ink: '#[0-9A-F]{6}' \}/g) ?? []).length, 6);
  assert.match(nav, /bg-warm text-warm-ink/, 'badges are orange with navy ink, never white on orange');
  assert.doesNotMatch(nav, /activeBg|subActiveBg|activeSectionDef/, 'sub-pages left the navy bar for SectionBar');
  assert.match(nav, /home: '\/attendance\/today'/);
});

test('WN3: row 2 (SectionBar) holds the section pages and the compact filters', () => {
  const app = read('src/app/app.tsx');
  assert.match(app, /<TopNav \/>\s*<SectionBar \/>/);
  assert.doesNotMatch(app, /<FilterBar \/>/);
  const sb = read('src/app/SectionBar.tsx');
  assert.match(sb, /import \{ SECTIONS, getActiveSection, BADGE \} from '@\/app\/TopNav';/);
  assert.match(sb, /<FilterBar \/>/);
  assert.match(sb, /flex flex-wrap items-center/, 'filters wrap under the tabs on a narrow window');
  assert.match(sb, /style=\{isActive \? \{ borderBottomColor: sec\.color\.accent \} : undefined\}/);
  const fb = read('src/app/FilterBar.tsx');
  assert.doesNotMatch(fb, /uppercase/, 'never ALL CAPS labels');
  assert.doesNotMatch(fb, /bg-white border-b border-slate-200 px-4/, 'FilterBar is no longer its own row');
  assert.match(fb, /<span className=\{inLabel\}>Manager<\/span>/);
  assert.match(fb, /<span className=\{inLabel\}>Title<\/span>/);
  assert.ok(Buffer.byteLength(fb) < 15000, 'FilterBar.tsx must stay under 15 KB');
});

test('WN2: keyboard focus stays visible on the navy bar', () => {
  const css = read('src/index.css');
  assert.match(css, /\.topnav-dark button:focus-visible[\s\S]{0,200}outline-color: #FFFFFF !important;/);
});

test('WP1: Title Case table header is opt-in, so un-redesigned pages keep their look', () => {
  const dt = read('src/app/components/DataTable.tsx');
  assert.match(dt, /titleCase = false/);
  assert.match(dt, /titleCase\s*\?\s*'bg-white text-\[12px\]/);
  assert.match(read('src/app/pages/pto/PtoTable.tsx'), /stickyHeader\s+titleCase/);
  // Contracts went Warm on 2026-10-07 (tests/contractsWarm.test.ts).
  for (const page of ['src/app/pages/disciplinary/DisciplinaryTable.tsx']) {
    assert.doesNotMatch(read(page), /titleCase/, `${page} is not redesigned yet`);
  }
});

test('WP2: PTO primary actions are orange with navy ink; statuses use the Excel colours', () => {
  assert.match(read('src/app/pages/PtoTracker.tsx'), /bg-warm text-warm-ink[\s\S]{0,200}Add Manually/);
  const s = read('src/app/pages/pto/PtoSubRow.tsx');
  assert.match(s, /bg-warm text-warm-ink[\s\S]{0,200}kind: 'record'/);
  assert.match(s, /bg-status-yellow-fill text-status-yellow-ink`\}>Pending/);
  assert.match(s, /bg-status-green-fill text-status-green-ink`\}>Recorded/);
  assert.match(s, /bg-status-red-fill text-status-red-ink line-through[^>]*>Withdrawn/);
  assert.doesNotMatch(read('src/app/pages/pto/PtoBreakdown.tsx'), /uppercase/, 'never ALL CAPS headers');
});

test('WP3: Coming Up keeps its emojis and groups later leave under month headings', () => {
  const c = read('src/app/pages/pto/PtoComingUp.tsx');
  assert.match(c, /Coming Up 🌴/);
  assert.match(c, /\{fh \? '⭐' : '🌴'\}/);
  assert.match(c, /<GroupHeading label="Out Now" warm \/>/);
  assert.match(c, /<GroupHeading label=\{g\.label\} count=\{g\.rows\.length\} \/>/);
  assert.ok(Buffer.byteLength(c) < 15000);
});
