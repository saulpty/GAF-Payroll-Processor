// Pure helpers for ds/Combobox. No React here — keep this file importable
// from plain node:test files too.

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Case- and accent-insensitive substring match. Prefix matches sort first
 * (in their original order), then other substring matches (also in their
 * original order). An empty/blank query returns all options, unchanged.
 */
export function filterOptions(options: string[], query: string): string[] {
  const q = normalize(query.trim());
  if (q === '') return options.slice();

  const prefixMatches: string[] = [];
  const otherMatches: string[] = [];

  for (const opt of options) {
    const n = normalize(opt);
    if (n.startsWith(q)) {
      prefixMatches.push(opt);
    } else if (n.includes(q)) {
      otherMatches.push(opt);
    }
  }

  return [...prefixMatches, ...otherMatches];
}

/**
 * Next list index for ArrowUp/ArrowDown, wrapping around both ends.
 * Returns -1 when the list is empty.
 */
export function nextIndex(current: number, delta: 1 | -1, length: number): number {
  if (length <= 0) return -1;
  let n = (current + delta) % length;
  if (n < 0) n += length;
  return n;
}
