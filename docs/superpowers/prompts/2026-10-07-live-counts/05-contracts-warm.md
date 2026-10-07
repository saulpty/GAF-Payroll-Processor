# Contracts: Warm look (approved mockup), step 1 of 2

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Saul approved the Contracts mockup (2026-10-07, https://claude.ai/artifact/AgVbyyhxRYFvufeR4xLFou).
Same data, logic, default sort, column sorting, loading / error / empty states and flat params.
- **Summary chips** above the table: "N Employees", then toggle chips that filter the table
  (click again to clear): Milestone in 14 Days, Milestone in 30 Days, Contract Ends in 30 Days,
  Renewed — counted from the rows the global filters show (`lib/contractChips.ts`).
- **Table:** position under the employee's name (Position column removed; its tip moves to the
  Employee header); dates like "Tue Oct 13" via `fmtDay`; tenure "11 mo" / "New"; milestones:
  passed = green check "Done", the next one = date + "in N days" in a warm box (Excel yellow when
  within 14 days), later ones grey. Contract End: Excel colours; "Renewed · was <date>".
  Title Case headers, every InfoTip kept. Export writes the rows the table shows.
- New files: `src/app/lib/contractChips.ts`, `src/app/pages/contracts/ContractsChips.tsx`,
  `src/app/pages/contracts/ContractCells.tsx`. `ContractRow` now takes `thisYear` (ContractsTable
  passes it), so both ship together.

**Only these five files may change** (each a whole file below): `src/app/lib/contractChips.ts`
(new), `src/app/pages/contracts/ContractsChips.tsx` (new), `src/app/pages/contracts/ContractCells.tsx`
(new), `src/app/pages/contracts/ContractRow.tsx`, `src/app/pages/contracts/ContractsTable.tsx`.
No other file may be touched (not `tenure.ts`, `Contracts.tsx`, any action, `DataTable.tsx`, or
`src/components/ui/*`).

## `src/app/lib/contractChips.ts` (whole file)

```ts
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
```

## `src/app/pages/contracts/ContractsChips.tsx` (whole file)

```tsx
import type { ContractChip } from '@/app/lib/contractChips';

// Summary chips above the Contracts table (Warm redesign, 2026-10-07). Counts come from the rows
// the global Employee / Manager / Title filters leave; clicking a chip filters the table to those
// rows and clicking it again clears it (DESIGN-SYSTEM.md, "Summary chips").

const CHIPS: { key: ContractChip; label: string; dot: string; tip: string }[] = [
  { key: 'ms14',    label: 'Milestone in 14 Days',     dot: 'bg-warm',      tip: 'Next tenure milestone is today or within 14 days' },
  { key: 'ms30',    label: 'Milestone in 30 Days',     dot: 'bg-yellow-500', tip: 'Next tenure milestone is today or within 30 days' },
  { key: 'end30',   label: 'Contract Ends in 30 Days', dot: 'bg-red-600',   tip: 'Contract end date is today or within 30 days' },
  { key: 'renewed', label: 'Renewed',                  dot: 'bg-green-600', tip: 'The Onboarding board marks the contract as renewed (Passed)' },
];

interface Props {
  employees: number;
  counts: Record<ContractChip, number>;
  active: ContractChip | null;
  onToggle: (c: ContractChip) => void;
}

export default function ContractsChips({ employees, counts, active, onToggle }: Props) {
  const chipCls = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring ${on ? 'border-warm bg-warm-tint text-warm-text' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`;
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-primary">
        {employees} {employees === 1 ? 'Employee' : 'Employees'}
      </span>
      {CHIPS.map(c => (
        <button
          key={c.key}
          type="button"
          aria-pressed={active === c.key}
          onClick={() => onToggle(c.key)}
          className={chipCls(active === c.key)}
          title={c.tip}
        >
          <span className={`w-2 h-2 rounded-full ${c.dot}`} aria-hidden="true" />
          {c.label} <strong className="font-bold">{counts[c.key]}</strong>
        </button>
      ))}
    </div>
  );
}
```

## `src/app/pages/contracts/ContractCells.tsx` (whole file)

```tsx
import { Check } from 'lucide-react';
import { fmtDay } from '@/app/lib/fmtDay';
import { inDaysLabel, SOON_DAYS } from '@/app/lib/contractChips';
import type { ContractRowData } from './ContractRow';

// Milestone and Contract End cells for ContractRow (Warm redesign, 2026-10-07).
// Excel status colours: green = done / renewed, yellow = soon or pending, red = ending / not renewed.

const muted = <span className="text-slate-300">—</span>;

const MS_TIPS: Record<string, string> = {
  '1m': 'Start + 1 month.', '3m': 'Start + 3 months.', '6m': 'Start + 6 months.',
  '1y': 'Start + 1 year.',  '2y': 'Start + 2 years.',
};

const pill = 'inline-flex items-center rounded-full px-2 py-px text-[11px] font-semibold whitespace-nowrap';

export function MilestoneCells({ row, thisYear }: { row: ContractRowData; thisYear: string }) {
  const { ms, next } = row;
  if (!ms) {
    return <>{['1m', '3m', '6m', '1y', '2y'].map(k => <td key={k} className="px-3 py-2">{muted}</td>)}</>;
  }
  return (
    <>
      {ms.map(m => {
        const isPast = next ? m.date < next.date : true;
        const isNext = next?.key === m.key;
        if (isNext) {
          const soon = next.days <= SOON_DAYS;
          const box = soon
            ? 'bg-status-yellow-fill border-status-yellow-fill'
            : 'bg-warm-tint border-warm-ring';
          return (
            <td key={m.key} className="px-3 py-2 whitespace-nowrap">
              <span className={`inline-flex flex-col items-start gap-px rounded-md border px-2 py-0.5 ${box}`} title={MS_TIPS[m.key]}>
                <span className="text-[12px] font-semibold text-slate-900 tabular-nums">{fmtDay(m.date, thisYear)}</span>
                <span className={`text-[11px] font-semibold ${soon ? 'text-status-yellow-ink' : 'text-warm-text'}`}>{inDaysLabel(next.days)}</span>
              </span>
            </td>
          );
        }
        if (isPast) {
          return (
            <td key={m.key} className="px-3 py-2 whitespace-nowrap" title={`${MS_TIPS[m.key]} Reached ${fmtDay(m.date, thisYear)}.`}>
              <span className="inline-flex items-center gap-1.5 font-medium text-status-green-ink">
                <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={2.4} aria-hidden="true" />
                Done
              </span>
            </td>
          );
        }
        return (
          <td key={m.key} className="px-3 py-2 text-slate-400 tabular-nums whitespace-nowrap" title={MS_TIPS[m.key]}>
            {fmtDay(m.date, thisYear)}
          </td>
        );
      })}
    </>
  );
}

export function ContractEndCell({ row, thisYear }: { row: ContractRowData; thisYear: string }) {
  const { end, endState, renewal } = row;
  if (!row.has_board_row || endState.kind === 'none' || !end) return muted;
  const day = fmtDay(end, thisYear);

  if (endState.kind === 'ended') {
    if (renewal === 'renewed') {
      return (
        <span title={`Board status Passed. Fixed term ended on ${day}.`}>
          <span className={`${pill} bg-status-green-fill text-status-green-ink`}>Renewed · was {day}</span>
        </span>
      );
    }
    if (renewal === 'not_renewed') {
      return (
        <span title="Board status Failed — still on the active roster.">
          <span className={`${pill} bg-status-red-fill text-status-red-ink`}>Not Renewed</span>
          <div className="text-[11px] text-slate-500 mt-0.5">ended {day}</div>
        </span>
      );
    }
    return (
      <span title="Fixed term ended and the board has no renewal decision yet.">
        <span className={`${pill} bg-status-yellow-fill text-status-yellow-ink`}>Pending Review</span>
        <div className="text-[11px] text-slate-500 mt-0.5">ended {day}</div>
      </span>
    );
  }

  // future
  const days = endState.days ?? 0;
  const label = `${day} · ${inDaysLabel(days)}`;
  let main: React.ReactNode;
  if (days <= 30) main = <span className={`${pill} bg-status-red-fill text-status-red-ink`}>{label}</span>;
  else if (days <= 60) main = <span className={`${pill} bg-status-yellow-fill text-status-yellow-ink`}>{label}</span>;
  else main = <span className="whitespace-nowrap tabular-nums">{day}</span>;
  return (
    <span className="inline-flex flex-col items-start">
      {main}
      {renewal === 'renewed' && (
        <span className={`${pill} mt-0.5 bg-status-green-fill text-status-green-ink`}>Renewed</span>
      )}
      {renewal === 'not_renewed' && (
        <span className={`${pill} mt-0.5 bg-status-red-fill text-status-red-ink`}>Not Renewed</span>
      )}
    </span>
  );
}
```

## `src/app/pages/contracts/ContractRow.tsx` (whole file)

```tsx
import { fmtDay } from '@/app/lib/fmtDay';
import { tenureDisplay } from '@/app/lib/contractChips';
import StatusChip from '@/app/components/StatusChip';
import type { RenewalState } from '@/app/lib/tenure';
import { MilestoneCells, ContractEndCell } from './ContractCells';

export interface ContractRowData {
  employee_id: number;
  display_name: string;
  role: string | null;
  manager: string | null;
  roster_start: string | null;
  board_start: string | null;
  position: string | null;
  state: string | null;
  contract_end: string | null;
  has_board_row: boolean;
  // derived
  start: string | null;
  end: string | null;
  ms: { key: string; date: string }[] | null;
  next: { key: string; date: string; days: number } | null;
  tenure: string | null;
  endState: { kind: 'none' | 'ended' | 'future'; days: number | null };
  startMismatch: boolean;
  renewal: RenewalState;
}

interface Props { row: ContractRowData; thisYear: string }

const muted = <span className="text-slate-300">—</span>;

// Warm redesign (2026-10-07): position under the name, weekday dates (fmtDay),
// tenure as "11 mo" / "New", Excel status colours in ContractCells.
export default function ContractRow({ row, thisYear }: Props) {
  const { start, tenure, startMismatch } = row;
  const position = row.has_board_row ? row.position : null;

  // ── Employee cell: name, then position ─────────────────────────────────
  const nameCell = (
    <div>
      <div className="font-medium text-slate-900 whitespace-nowrap">
        {row.display_name}
        {!row.has_board_row && (
          <span className="ml-1.5">
            <StatusChip tone="slate">Not on Onboarding Board</StatusChip>
          </span>
        )}
      </div>
      {position && <div className="text-[12px] text-slate-500 whitespace-nowrap">{position}</div>}
    </div>
  );

  // ── Start cell ──────────────────────────────────────────────────────────
  let startCell: React.ReactNode;
  if (!start) {
    startCell = (
      <span className="inline-flex items-center gap-1">
        {muted}
        <span className="inline-flex items-center rounded-full px-2 py-px text-[11px] font-semibold bg-status-yellow-fill text-status-yellow-ink">
          No Start Date
        </span>
      </span>
    );
  } else {
    startCell = (
      <span className="whitespace-nowrap">
        {fmtDay(start, thisYear)}
        {startMismatch && (
          <span
            className="ml-1 text-amber-500 cursor-help"
            title={`Roster start: ${fmtDay(start, thisYear)} · Board start: ${fmtDay(row.board_start, thisYear)}`}
          >
            ⚠
          </span>
        )}
      </span>
    );
  }

  return (
    <tr className="hover:bg-slate-100 transition-colors duration-100">
      {/* Employee (+ position) */}
      <td className="px-3 py-2">{nameCell}</td>
      {/* State */}
      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
        {row.has_board_row ? (row.state || muted) : muted}
      </td>
      {/* Start */}
      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{startCell}</td>
      {/* Tenure */}
      <td className="px-3 py-2 tabular-nums text-slate-600 whitespace-nowrap">{tenure ? tenureDisplay(tenure) : muted}</td>
      {/* Contract end */}
      <td className="px-3 py-2 tabular-nums whitespace-nowrap">
        <ContractEndCell row={row} thisYear={thisYear} />
      </td>
      {/* Milestones */}
      <MilestoneCells row={row} thisYear={thisYear} />
    </tr>
  );
}
```

## `src/app/pages/contracts/ContractsTable.tsx` (whole file)

```tsx
import { useMemo, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLoadAction } from '@uibakery/data';
import DataTable, { Col } from '@/app/components/DataTable';
import EmptyState from '@/app/components/EmptyState';
import ContractRow, { ContractRowData } from './ContractRow';
import ContractsChips from './ContractsChips';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import loadContractMilestonesAction from '@/actions/loadContractMilestones';
import { milestones, nextMilestone, tenureLabel, contractEndState, renewalState } from '@/app/lib/tenure';
import { sortRows, nextSortDir } from '@/app/lib/ptoSort';
import type { SortDir } from '@/app/lib/ptoSort';
import { applyChip, chipCounts } from '@/app/lib/contractChips';
import type { ContractChip } from '@/app/lib/contractChips';

type RawRow = {
  employee_id: number;
  display_name: string;
  role: string | null;
  manager: string | null;
  roster_start: string | null;
  board_start: string | null;
  position: string | null;
  state: string | null;
  contract_end: string | null;
  renewal_status: string | null;
  has_board_row: boolean;
};

// Warm redesign (2026-10-07): Title Case headers; the position moved under the name.
const COLUMNS: Col<ContractRowData>[] = [
  { key: 'display_name', label: 'Employee',      align: 'left',   tip: 'The position under the name is from the Employee Onboarding board.' },
  { key: 'state',        label: 'State',         align: 'left',   tip: 'Region or operating entity from the Onboarding board — not employment status.' },
  { key: 'start',        label: 'Start Date',    align: 'left',   tip: 'The roster start date, the same one the PTO Tracker accrues from.' },
  { key: 'tenure',       label: 'Tenure',        align: 'left',   tip: 'Whole years and months since the start date.' },
  { key: 'contract_end', label: 'Contract End',  align: 'left',   tip: "From the board's 6 Contract End Date. Renewed / Not renewed comes from the board's renewal status; Pending review means no decision recorded yet." },
  { key: 'm1',           label: '1 Month',       align: 'left',   tip: 'Start + 1 month.',  sortable: false },
  { key: 'm3',           label: '3 Months',      align: 'left',   tip: 'Start + 3 months.', sortable: false },
  { key: 'm6',           label: '6 Months',      align: 'left',   tip: 'Start + 6 months.', sortable: false },
  { key: 'y1',           label: '1 Year',        align: 'left',   tip: 'Start + 1 year.',   sortable: false },
  { key: 'y2',           label: '2 Years',       align: 'left',   tip: 'Start + 2 years.',  sortable: false },
];

interface Props {
  asOf: string;
  onRowsChange?: (rows: ContractRowData[]) => void;
  onCountsChange?: (c: { employees: number; expiring: number; offBoard: number }) => void;
}

// Numeric sort value for default ordering: soonest upcoming event first.
function urgencyScore(row: ContractRowData): number {
  const nextDays = row.next?.days ?? null;
  const endDays = row.endState.kind === 'future' ? row.endState.days : null;
  const candidates = [nextDays, endDays].filter((v): v is number => v !== null);
  return candidates.length > 0 ? Math.min(...candidates) : Infinity;
}

export default function ContractsTable({ asOf, onRowsChange, onCountsChange }: Props) {
  const { employee, role, manager } = useGlobalFilters();
  const { viewAs } = useViewer();

  const [rawRows, loading, error, reload] = useLoadAction(
    loadContractMilestonesAction,
    [] as RawRow[],
    { manager: manager || null, employeeId: null, viewAs },
  );

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [chip, setChip] = useState<ContractChip | null>(null);

  const handleSort = (k: string) => {
    if (k === sortKey) {
      const d = nextSortDir(sortDir);
      setSortDir(d);
      if (d === null) setSortKey(null);
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  // Derive computed fields
  const derived = useMemo((): ContractRowData[] => {
    return (rawRows as RawRow[]).map(r => {
      const start = r.roster_start ? r.roster_start.slice(0, 10) : null;
      const end   = r.contract_end ? r.contract_end.slice(0, 10) : null;
      const ms    = start ? milestones(start) : null;
      const next  = start ? nextMilestone(start, asOf) : null;
      const tenure = start ? tenureLabel(start, asOf) : null;
      const endState = contractEndState(end, asOf);
      const startMismatch = !!(start && r.board_start && r.board_start.slice(0, 10) !== start);
      const renewal = renewalState(r.renewal_status);
      return { ...r, start, end, ms, next, tenure, endState, startMismatch, renewal };
    });
  }, [rawRows, asOf]);

  // Filter
  const filtered = useMemo(() => {
    let rows = derived;
    if (employee) {
      rows = rows.filter(r =>
        String(r.employee_id) === employee ||
        r.display_name.toLowerCase().includes(employee.toLowerCase()),
      );
    }
    if (role) {
      rows = rows.filter(r => (r.role ?? '').toLowerCase().includes(role.toLowerCase()));
    }
    return rows;
  }, [derived, employee, role]);

  // Sort — default: urgency score asc, then name
  const sorted = useMemo(() => {
    if (sortKey === null || sortDir === null) {
      return [...filtered].sort((a, b) => {
        const diff = urgencyScore(a) - urgencyScore(b);
        return diff !== 0 ? diff : a.display_name.localeCompare(b.display_name);
      });
    }
    return sortRows(filtered, sortKey as keyof ContractRowData, sortDir, 'display_name');
  }, [filtered, sortKey, sortDir]);

  // Chip counts follow the global filters; the active chip only narrows what the table shows.
  const counts = useMemo(() => chipCounts(sorted), [sorted]);
  const shown = useMemo(() => applyChip(sorted, chip), [sorted, chip]);

  // Report counts up (employees / expiring / offBoard ignore the chip; the export gets what is shown)
  useEffect(() => {
    const offBoard = sorted.filter(r => !r.has_board_row).length;
    onRowsChange?.(shown);
    onCountsChange?.({ employees: sorted.length, expiring: counts.end30, offBoard });
  }, [sorted, shown, counts, onRowsChange, onCountsChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-6 mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-3">
        <span>Couldn&apos;t load contracts — loadContractMilestones</span>
        <button
          type="button"
          onClick={reload}
          className="ml-auto rounded px-2 py-1 text-red-700 border border-red-300 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-warm-ring text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  const thisYear = asOf.slice(0, 4);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ContractsChips
        employees={sorted.length}
        counts={counts}
        active={chip}
        onToggle={c => setChip(prev => (prev === c ? null : c))}
      />
      <DataTable
        columns={COLUMNS}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        stickyHeader
        titleCase
        className="mx-6 mb-6 max-h-[calc(100vh-300px)]"
      >
        {shown.length === 0 ? (
          <tr>
            <td colSpan={COLUMNS.length} className="p-0">
              <EmptyState
                title="No Employees Match"
                hint={chip ? 'Click the highlighted chip again to clear it, or clear the search or filters.' : 'Try clearing the search or filters.'}
                compact
              />
            </td>
          </tr>
        ) : (
          shown.map(row => (
            <ContractRow key={row.employee_id} row={row} thisYear={thisYear} />
          ))
        )}
      </DataTable>
    </div>
  );
}
```

## Report
- Byte size of the five files; confirm no other file changed; Contracts renders, chips filter the table, no console errors.
