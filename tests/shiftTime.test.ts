import { test } from 'node:test';
import assert from 'node:assert/strict';

// Reference implementation of the +1hr time shift used by the Phase 2 historical
// migration (1781400100). The SQL mirrors this exactly:
//   - 'H:MI AM/PM'  -> parse 12h, +1hr, format 'H:MI AM' (no leading zero)
//   - 'HH24:MI(:SS)' -> parse 24h, +1hr, format 'H:MI AM'
//   - NULL / '' / unrecognized -> unchanged
// This Node test proves the algorithm; the SQL is a translation of it (no Postgres
// available locally to run the migration itself).
function shiftTime1hr(t: string | null): string | null {
  if (t == null) return t;
  const s = t.trim();
  if (s === '') return t;
  let h: number, m: number;
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const h24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (ampm) {
    h = parseInt(ampm[1], 10);
    m = parseInt(ampm[2], 10);
    const ap = ampm[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
  } else if (h24) {
    h = parseInt(h24[1], 10);
    m = parseInt(h24[2], 10);
  } else {
    return t; // unrecognized — leave as-is
  }
  const total = (h * 60 + m + 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  const ap = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
}

const cases: [string | null, string | null][] = [
  ['8:00 AM', '9:00 AM'],
  ['8:12 AM', '9:12 AM'],
  ['11:30 AM', '12:30 PM'],   // AM -> PM boundary
  ['12:00 PM', '1:00 PM'],    // noon
  ['4:00 PM', '5:00 PM'],
  ['5:00 PM', '6:00 PM'],
  ['11:30 PM', '12:30 AM'],   // wraps past midnight (time-only)
  ['12:00 AM', '1:00 AM'],    // midnight
  ['17:00:00', '6:00 PM'],    // 24h format
  ['16:00:00', '5:00 PM'],
  ['10:50:00', '11:50 AM'],
  [null, null],
  ['', ''],
  ['Form Submitted', 'Form Submitted'], // unrecognized stays put
];

for (const [input, expected] of cases) {
  test(`shiftTime1hr(${JSON.stringify(input)}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(shiftTime1hr(input), expected);
  });
}
