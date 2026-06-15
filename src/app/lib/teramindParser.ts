import * as XLSX from 'xlsx';
import { teramindToPanama, normalizeName, type DstWindow } from './classificationEngine';

export interface TeramindRawRow {
  email: string;  // raw value from file — may be a name, email, or PC identifier
  timeStarted: string;
  timeFinished: string;
}

/** Parse a Teramind export file (CSV or XLSX binary ArrayBuffer) into raw rows.
 *  Uses SheetJS so both formats work identically.
 *  Column detection is fuzzy — matches common Teramind header variants.
 */
export function parseTeramindFile(buffer: ArrayBuffer, fileName: string): TeramindRawRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // Convert to array-of-arrays to preserve raw cell order
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss' });

  if (aoa.length < 2) {
    console.warn('[Teramind] Sheet has fewer than 2 rows — empty file?', fileName);
    return [];
  }

  const headerRow = (aoa[0] as string[]).map(h => String(h ?? '').toLowerCase().trim().replace(/^\uFEFF/, ''));
  console.log('[Teramind] Headers detected:', headerRow);

  // Fuzzy column matching — "employee" column contains either names or emails
  const emailIdx    = headerRow.findIndex(h => h.includes('email') || h.includes('user') || h === 'employee');
  const startIdx    = headerRow.findIndex(h => h.includes('time started') || h.includes('start time') || h.includes('started') || h.includes('login') || h.includes('first activity'));
  const endIdx      = headerRow.findIndex(h => h.includes('time finished') || h.includes('end time') || h.includes('finished') || h.includes('logout') || h.includes('last activity'));

  console.log('[Teramind] Column indices — identifier:', emailIdx, 'start:', startIdx, 'end:', endIdx);

  if (emailIdx < 0 || startIdx < 0 || endIdx < 0) {
    console.error('[Teramind] Could not find required columns in:', headerRow);
    return [];
  }

  const rows: TeramindRawRow[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i] as unknown[];
    const email    = String(row[emailIdx] ?? '').trim();
    const started  = String(row[startIdx]  ?? '').trim();
    const finished = String(row[endIdx]    ?? '').trim();
    if (email && started && finished) {
      rows.push({ email, timeStarted: started, timeFinished: finished });
    }
  }

  console.log(`[Teramind] Parsed ${rows.length} raw rows from ${fileName}`);
  return rows;
}

/**
 * Build a resolver map from employees and full alias list (with teramind_email joined).
 * Call this in ProcessPayroll where both datasets are available.
 */
export function buildFullTeramindResolver(
  employees: { display_name: string; teramind_email: string }[],
  aliases: { alias_text: string; display_name: string; employee_id: number }[],
  empList: { id: number; teramind_email: string }[]
): Map<string, string> {
  const resolver = new Map<string, string>();
  const idToEmail = new Map(empList.map(e => [e.id, e.teramind_email.toLowerCase()]));

  // display_name → teramind_email
  for (const emp of employees) {
    if (emp.teramind_email) {
      resolver.set(normalizeName(emp.display_name), emp.teramind_email.toLowerCase());
    }
  }
  // alias_text → teramind_email
  for (const alias of aliases) {
    const email = idToEmail.get(alias.employee_id);
    if (email) {
      resolver.set(normalizeName(alias.alias_text), email);
    }
  }

  return resolver;
}

/**
 * Resolve a raw Teramind identifier (name OR email or PC-style) to a teramind_email.
 * Returns null if no match found.
 */
export function resolveTeramindIdentifier(
  raw: string,
  resolver: Map<string, string>,
  knownEmails: Set<string>
): string | null {
  const lower = raw.toLowerCase().trim();

  // Already a known exact email
  if (knownEmails.has(lower)) return lower;

  // Looks like an email — check if domain matches any known email
  if (lower.includes('@')) {
    // Try direct match first
    if (knownEmails.has(lower)) return lower;
    // Match username portion (e.g. "eddy.c@eddy'smacbookpro" → find "eddy.c@...")
    const user = lower.split('@')[0];
    for (const known of knownEmails) {
      if (known.split('@')[0] === user) return known;
    }
    return null;
  }

  // It's a name — try resolver
  return resolver.get(normalizeName(raw)) ?? null;
}

/** Group rows by teramind_email → date (YYYY-MM-DD) → { entry, exit }.
 *  Pass resolver + knownEmails so name-based rows get mapped to the right email key.
 */
export function processTeramindData(
  rows: TeramindRawRow[],
  dstWindows: DstWindow[],
  resolver?: Map<string, string>,
  knownEmails?: Set<string>
): Map<string, Map<string, { entry: Date; exit: Date }>> {
  const map = new Map<string, Map<string, { entry: Date; exit: Date }>>();

  for (const row of rows) {
    if (!row.email || !row.timeStarted || !row.timeFinished) continue;

    // Resolve raw identifier to a canonical teramind_email
    let email: string;
    if (resolver && knownEmails) {
      const resolved = resolveTeramindIdentifier(row.email, resolver, knownEmails);
      if (!resolved) {
        // Log once per unresolved identifier
        continue;
      }
      email = resolved;
    } else {
      email = row.email.trim().toLowerCase();
    }

    const rawStart = new Date(row.timeStarted);
    const rawEnd   = new Date(row.timeFinished);
    if (isNaN(rawStart.getTime()) || isNaN(rawEnd.getTime())) {
      console.warn('[Teramind] Unparseable dates:', row.timeStarted, row.timeFinished);
      continue;
    }

    const panamaStart = teramindToPanama(rawStart, dstWindows);
    const panamaEnd   = teramindToPanama(rawEnd,   dstWindows);
    const dateKey = panamaStart.toISOString().slice(0, 10);

    if (!map.has(email)) map.set(email, new Map());
    const dayMap = map.get(email)!;

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { entry: panamaStart, exit: panamaEnd });
    } else {
      const cur = dayMap.get(dateKey)!;
      if (panamaStart < cur.entry) cur.entry = panamaStart;
      if (panamaEnd   > cur.exit)  cur.exit  = panamaEnd;
    }
  }

  return map;
}

/** Legacy CSV-text path (kept for compatibility, prefer parseTeramindFile) */
export function parseTeramindCsv(text: string): TeramindRawRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/^\uFEFF/, ''));
  console.log('[Teramind CSV] Headers:', header);
  const emailIdx = header.findIndex(h => h.includes('email') || h.includes('user') || h === 'employee');
  const startIdx = header.findIndex(h => h.includes('started') || h.includes('start') || h.includes('login') || h.includes('first activity'));
  const endIdx   = header.findIndex(h => h.includes('finished') || h.includes('end') || h.includes('finish') || h.includes('logout') || h.includes('last activity'));
  if (emailIdx < 0 || startIdx < 0 || endIdx < 0) {
    console.error('[Teramind CSV] Could not find columns in:', header);
    return [];
  }
  const rows: TeramindRawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]);
    const email    = cells[emailIdx]?.replace(/^"|"$/g, '').trim() || '';
    const started  = cells[startIdx]?.replace(/^"|"$/g, '').trim() || '';
    const finished = cells[endIdx]?.replace(/^"|"$/g, '').trim() || '';
    if (email && started && finished) rows.push({ email, timeStarted: started, timeFinished: finished });
  }
  return rows;
}

function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === ',' && !inQuote) { cells.push(cur); cur = ''; }
    else cur += c;
  }
  cells.push(cur);
  return cells;
}
