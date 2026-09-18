// QA (2026-09-18): the punches the Process page captured from the Teramind saved copy
// (loadTeramindPunchDays rows, saved as JSON) vs the Time Records export file for the same
// dates, both folded with the real parser. Read-only; writes nothing.
//
//   node tools/qa-compare-capture-vs-file.mjs <punchdays.json> <export.csv>
import fs from 'node:fs';
import { punchDaysToRawRows } from '../src/app/lib/teramindPunches.ts';
// teramindParser.ts imports `xlsx` (not installed outside UIB), so the two pieces used here are
// mirrored verbatim: parseWallClock's 24h/AM-PM regex and processTeramindData's fold
// (earliest start / latest finish per email per START date). parseTeramindCsv is trivial.

const [,, punchPath, csvPath] = process.argv;
const punchDays = JSON.parse(fs.readFileSync(punchPath, 'utf8'));
const csvText = fs.readFileSync(csvPath, 'utf8');

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function parseWallClock(s) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?/i);
  if (!m) return null;
  const [, yr, mo, dy, hhRaw, mi, , ampm] = m;
  let hh = +hhRaw;
  if (ampm) { const ap = ampm.toUpperCase(); if (ap === 'PM' && hh !== 12) hh += 12; if (ap === 'AM' && hh === 12) hh = 0; }
  return { date: `${yr}-${mo}-${dy}`, min: hh * 60 + +mi, key: `${yr}-${mo}-${dy} ${hhmm(hh * 60 + +mi)}` };
}
const fold = (rows) => {
  const out = new Map();
  for (const r of rows) {
    const s = parseWallClock(r.timeStarted), e = parseWallClock(r.timeFinished);
    if (!s || !e) continue;
    const k = `${r.email.trim().toLowerCase()}|${s.date}`;
    const cur = out.get(k);
    if (!cur) out.set(k, { entry: s, exit: e });
    else { if (s.key < cur.entry.key) cur.entry = s; if (e.key > cur.exit.key) cur.exit = e; }
  }
  for (const [k, v] of out) out.set(k, { entry: v.entry.min, exit: v.exit.min, exitDate: v.exit.date });
  return out;
};
function splitCsvRow(line) {
  const cells = []; let cur = ''; let q = false;
  for (const c of line) { if (c === '"') q = !q; else if (c === ',' && !q) { cells.push(cur); cur = ''; } else cur += c; }
  cells.push(cur); return cells;
}
function parseTeramindCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const header = splitCsvRow(lines[0]).map(h => h.trim().replace(/^﻿/, '').toLowerCase());
  const ei = header.findIndex(h => h.includes('email') || h.includes('user') || h === 'employee');
  const si = header.findIndex(h => h.includes('started') || h.includes('start'));
  const fi = header.findIndex(h => h.includes('finished') || h.includes('end') || h.includes('finish'));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvRow(lines[i]);
    const email = (c[ei] ?? '').trim(), timeStarted = (c[si] ?? '').trim(), timeFinished = (c[fi] ?? '').trim();
    if (email && timeStarted && timeFinished) rows.push({ email, timeStarted, timeFinished });
  }
  return rows;
}

// API side: emails already canonical
const api = fold(punchDaysToRawRows(punchDays).rows);

// File side: rows carry the display name; map name -> email by "first.initial@" against the
// emails the API side knows (good enough for QA; unmatched names are listed, not guessed).
const emails = [...new Set(punchDays.map(r => String(r.teramind_email).toLowerCase()))];
const localOf = (e) => e.split('@')[0];
const fileRows = parseTeramindCsv(csvText);
const names = [...new Set(fileRows.map(r => r.email))];
const nameToEmail = new Map();
const unmatched = [];
for (const name of names) {
  const parts = name.trim().toLowerCase().split(/\s+/);
  const first = parts[0], lastInit = parts[parts.length - 1]?.[0] ?? '';
  const cands = emails.filter(e => {
    const l = localOf(e);
    return l === `${first}.${lastInit}` || l.startsWith(`${first}.${lastInit}`) || l === first || l.replace(/[^a-z]/g, '').startsWith(first + lastInit);
  });
  if (cands.length === 1) nameToEmail.set(name, cands[0]);
  else unmatched.push({ name, cands });
}
const mapped = fileRows.filter(r => nameToEmail.has(r.email)).map(r => ({ ...r, email: nameToEmail.get(r.email) }));
const file = fold(mapped);

let same = 0, diff = 0, apiOnly = 0, fileOnly = 0;
const diffs = [];
for (const [k, a] of api) {
  const f = file.get(k);
  if (!f) { apiOnly++; diffs.push(`API only   ${k}  ${hhmm(a.entry)}–${hhmm(a.exit)}`); continue; }
  if (f.entry === a.entry && f.exit === a.exit) same++;
  else { diff++; diffs.push(`DIFF       ${k}  api ${hhmm(a.entry)}–${hhmm(a.exit)}  file ${hhmm(f.entry)}–${hhmm(f.exit)}`); }
}
for (const k of file.keys()) if (!api.has(k)) { fileOnly++; const f = file.get(k); diffs.push(`FILE only  ${k}  ${hhmm(f.entry)}–${hhmm(f.exit)}`); }

console.log(`file rows: ${fileRows.length}, names: ${names.length}, mapped names: ${nameToEmail.size}, unmatched names: ${unmatched.length}`);
console.log(`employee-days  api: ${api.size}  file: ${file.size}`);
console.log(`identical: ${same}  different: ${diff}  api-only: ${apiOnly}  file-only: ${fileOnly}`);
for (const u of unmatched) console.log(`unmatched name: ${u.name}  candidates: ${u.cands.join(', ') || '-'}`);
if (process.env.SHOW_MAP) for (const [n, e] of nameToEmail) console.log(`map  ${n}  ->  ${e}`);
for (const d of diffs) console.log(d);
