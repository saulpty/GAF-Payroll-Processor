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

// ── Phone rows (2026-10-13) ──────────────────────────────────────────────────────────────────
// The words the phone rows show. The same rules as the table cells in
// pages/contracts/ContractCells.tsx, as plain values, so the rows and the table cannot disagree
// (tests/mobileContracts.test.ts checks these against that file). Dates arrive already
// formatted, or with the formatter passed in: this file still has no clock and no Date.

export const MILESTONE_LABELS: Record<string, string> = {
  '1m': '1 Month', '3m': '3 Months', '6m': '6 Months', '1y': '1 Year', '2y': '2 Years',
};

export interface MilestoneLine {
  key: string;
  label: string;
  date: string;
  /** done = already reached; next = the one coming up; later = after the next one. */
  state: 'done' | 'next' | 'later';
  /** Days until it. Only the next one has a number. */
  days: number | null;
  /** The next one, 14 days away or less (the table's yellow box). */
  soon: boolean;
}

/** The five milestones with their state, decided exactly as MilestoneCells decides it. */
export function milestoneLines(
  ms: { key: string; date: string }[] | null,
  next: { key: string; date: string; days: number } | null,
): MilestoneLine[] {
  if (!ms) return [];
  return ms.map(m => {
    const isNext = next !== null && next.key === m.key;
    const isPast = next !== null ? m.date < next.date : true;
    return {
      key: m.key,
      label: MILESTONE_LABELS[m.key] ?? m.key,
      date: m.date,
      state: isNext ? 'next' : isPast ? 'done' : 'later',
      days: isNext ? next.days : null,
      soon: isNext && next.days <= SOON_DAYS,
    };
  });
}

/**
 * The next milestone in words: "6 Months · Mon Oct 19 · in 7 days". `lead` and `when` are the two
 * halves, so the row can emphasise the last part. null when all five have passed or there is no
 * start date.
 */
export function nextMilestoneLine(
  next: { key: string; date: string; days: number } | null,
  fmt: (ymd: string) => string,
): { lead: string; when: string; soon: boolean; text: string } | null {
  if (!next) return null;
  const lead = `${MILESTONE_LABELS[next.key] ?? next.key} · ${fmt(next.date)}`;
  const when = inDaysLabel(next.days);
  return { lead, when, soon: next.days <= SOON_DAYS, text: `${lead} · ${when}` };
}

export type EndTone = 'none' | 'green' | 'yellow' | 'red';

/** The fields the Contract End pill reads; ContractRowData satisfies this. */
export interface EndRow extends ChipRow {
  has_board_row: boolean;
  end: string | null;
}

export interface ContractEndView {
  /** The pill's words. With tone 'none' it is a plain date (more than 60 days away), not a pill. */
  pill: string;
  tone: EndTone;
  /** A second pill under the first: the board's decision on a contract that has not ended yet. */
  second: { text: string; tone: EndTone } | null;
  /** The small grey line under the pill ("ended Mon Oct 5"), or ''. */
  note: string;
  /** The sentence the table only shows on hover, or ''. */
  explain: string;
  /** Whole-row wash on the phone: red = ends within 30 days; yellow = within 60, or pending review. */
  wash: 'none' | 'yellow' | 'red';
}

/**
 * What the Contract End cell says, as values. `day` is the end date already formatted with
 * fmtDay. null = the table's dash (not on the board, or no end date).
 */
export function contractEndView(row: EndRow, day: string): ContractEndView | null {
  const { end, endState, renewal } = row;
  if (!row.has_board_row || endState.kind === 'none' || !end) return null;

  if (endState.kind === 'ended') {
    if (renewal === 'renewed') {
      return {
        pill: `Renewed · was ${day}`, tone: 'green', second: null, note: '',
        explain: `Board status Passed. Fixed term ended on ${day}.`, wash: 'none',
      };
    }
    if (renewal === 'not_renewed') {
      return {
        pill: 'Not Renewed', tone: 'red', second: null, note: `ended ${day}`,
        explain: 'Board status Failed — still on the active roster.', wash: 'none',
      };
    }
    return {
      pill: 'Pending Review', tone: 'yellow', second: null, note: `ended ${day}`,
      explain: 'Fixed term ended and the board has no renewal decision yet.', wash: 'yellow',
    };
  }

  // future
  const days = endState.days ?? 0;
  const tone: EndTone = days <= 30 ? 'red' : days <= 60 ? 'yellow' : 'none';
  const second: ContractEndView['second'] =
    renewal === 'renewed' ? { text: 'Renewed', tone: 'green' }
    : renewal === 'not_renewed' ? { text: 'Not Renewed', tone: 'red' }
    : null;
  return {
    pill: tone === 'none' ? day : `${day} · ${inDaysLabel(days)}`,
    tone, second, note: '', explain: '',
    wash: tone === 'red' ? 'red' : tone === 'yellow' ? 'yellow' : 'none',
  };
}

/** The one line an empty phone list shows; it names whatever is narrowing the list. */
export function noMatchLine(
  chipLabel: string | null,
  f: { employee?: string; role?: string; manager?: string },
): string {
  const parts: string[] = [];
  if (chipLabel) parts.push(chipLabel);
  if (f.employee) parts.push(`Employee: ${f.employee}`);
  if (f.manager) parts.push(`Manager: ${f.manager}`);
  if (f.role) parts.push(`Title: ${f.role}`);
  return parts.length === 0 ? 'No employees to show.' : `No employees match ${parts.join(' · ')}`;
}
