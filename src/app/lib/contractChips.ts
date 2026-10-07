// Summary chips and display labels for the Contracts page (Warm redesign, 2026-10-07).
// Pure functions, no I/O, no clock, no Date. They read the fields ContractsTable already
// derives with tenure.ts (next milestone, contract end state, renewal), so the chips and the
// table cells can never disagree about what "in 14 days" means.

import type { RenewalState } from './tenure';

export type ContractChip = 'ms14' | 'ms30' | 'end30' | 'renewed';

export const CONTRACT_CHIPS: ContractChip[] = ['ms14', 'ms30', 'end30', 'renewed'];

/** The derived fields a chip looks at; ContractRowData satisfies this. */
export interface ChipRow {
  next: { days: number } | null;
  endState: { kind: 'none' | 'ended' | 'future'; days: number | null };
  renewal: RenewalState;
}

/** Days within which a next milestone turns the Excel yellow "soon" box. */
export const SOON_DAYS = 14;

/**
 * Does a row belong under a chip?
 *   ms14    - the next milestone is 0..14 days away (today counts)
 *   ms30    - the next milestone is 0..30 days away (includes the 14-day ones)
 *   end30   - the contract end is today or within 30 days (same rule as the old
 *             "ending within 30 days" header count)
 *   renewed - the board's renewal status is Passed
 */
export function matchesChip(row: ChipRow, chip: ContractChip): boolean {
  if (chip === 'ms14') return row.next !== null && row.next.days <= SOON_DAYS;
  if (chip === 'ms30') return row.next !== null && row.next.days <= 30;
  if (chip === 'end30') {
    return row.endState.kind === 'future' && row.endState.days !== null && row.endState.days <= 30;
  }
  return row.renewal === 'renewed';
}

export function chipCounts(rows: ChipRow[]): Record<ContractChip, number> {
  const out: Record<ContractChip, number> = { ms14: 0, ms30: 0, end30: 0, renewed: 0 };
  for (const r of rows) {
    for (const c of CONTRACT_CHIPS) if (matchesChip(r, c)) out[c] += 1;
  }
  return out;
}

/** No chip = every row; otherwise only the rows under that chip. */
export function applyChip<T extends ChipRow>(rows: T[], chip: ContractChip | null): T[] {
  return chip === null ? rows : rows.filter(r => matchesChip(r, chip));
}

/** "Today", "in 1 day", "in 6 days". */
export function inDaysLabel(days: number): string {
  if (days === 0) return 'Today';
  return days === 1 ? 'in 1 day' : `in ${days} days`;
}

/**
 * tenureLabel's value ('new', '5m', '1y', '1y 5m') in the page's words:
 * 'New', '5 mo', '1 yr', '1 yr 5 mo'. Formatting only; the calculation stays in tenure.ts.
 */
export function tenureDisplay(label: string | null): string {
  if (!label) return '';
  if (label === 'new') return 'New';
  return label
    .split(' ')
    .map(p => (p.endsWith('y') ? `${p.slice(0, -1)} yr` : p.endsWith('m') ? `${p.slice(0, -1)} mo` : p))
    .join(' ');
}
