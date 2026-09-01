import { useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useLoadAction } from '@uibakery/data';
import DataTable, { Col } from '@/app/components/DataTable';
import EmptyState from '@/app/components/EmptyState';
import ContractRow, { ContractRowData, MS_LABELS } from './ContractRow';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import loadContractMilestonesAction from '@/actions/loadContractMilestones';
import { milestones, nextMilestone, tenureLabel, contractEndState } from '@/app/lib/tenure';
import { sortRows, nextSortDir } from '@/app/lib/ptoSort';
import type { SortDir } from '@/app/lib/ptoSort';
import { useState } from 'react';

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
  has_board_row: boolean;
};

const COLUMNS: Col<ContractRowData>[] = [
  { key: 'display_name', label: 'Employee',      align: 'left' },
  { key: 'position',     label: 'Position',      align: 'left',   tip: 'From the Employee Onboarding board.' },
  { key: 'state',        label: 'State',         align: 'left',   tip: 'Region or operating entity from the Onboarding board — not employment status.' },
  { key: 'start',        label: 'Start',         align: 'left',   tip: 'The roster start date, the same one the PTO Tracker accrues from.' },
  { key: 'tenure',       label: 'Tenure',        align: 'left',   tip: 'Whole years and months since the start date.' },
  { key: 'm1',           label: MS_LABELS['1m'], align: 'center', tip: 'Start + 1 month.',  sortable: false },
  { key: 'm3',           label: MS_LABELS['3m'], align: 'center', tip: 'Start + 3 months.', sortable: false },
  { key: 'm6',           label: MS_LABELS['6m'], align: 'center', tip: 'Start + 6 months.', sortable: false },
  { key: 'y1',           label: MS_LABELS['1y'], align: 'center', tip: 'Start + 1 year.',   sortable: false },
  { key: 'y2',           label: MS_LABELS['2y'], align: 'center', tip: 'Start + 2 years.',  sortable: false },
  { key: 'contract_end', label: 'Contract end',  align: 'left',   tip: 'From the board\'s "6 Contract End Date". Most have passed — people move to an indefinite contract and the board is not updated.' },
];

interface Props {
  asOf: string;
  onRowsChange?: (rows: ContractRowData[]) => void;
  onCountsChange?: (c: { employees: number; expiring: number; offBoard: number }) => void;
  dueWithin: 30 | 60 | 90 | null;
}

// Numeric sort value for default ordering: soonest upcoming event first.
function urgencyScore(row: ContractRowData): number {
  const nextDays = row.next?.days ?? null;
  const endDays = row.endState.kind === 'future' ? row.endState.days : null;
  const candidates = [nextDays, endDays].filter((v): v is number => v !== null);
  return candidates.length > 0 ? Math.min(...candidates) : Infinity;
}

export default function ContractsTable({ asOf, onRowsChange, onCountsChange, dueWithin }: Props) {
  const { employee, role, manager } = useGlobalFilters();

  const [rawRows, loading, error, reload] = useLoadAction(
    loadContractMilestonesAction,
    [] as RawRow[],
    { manager: manager || null, employeeId: null },
  );

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

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
      return { ...r, start, end, ms, next, tenure, endState, startMismatch };
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
    if (dueWithin !== null) {
      rows = rows.filter(r =>
        (r.next && r.next.days <= dueWithin) ||
        (r.endState.kind === 'future' && r.endState.days !== null && r.endState.days <= dueWithin),
      );
    }
    return rows;
  }, [derived, employee, role, dueWithin]);

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

  // Report counts up
  useEffect(() => {
    const expiring = sorted.filter(
      r => r.endState.kind === 'future' && r.endState.days !== null && r.endState.days <= 30,
    ).length;
    const offBoard = sorted.filter(r => !r.has_board_row).length;
    onRowsChange?.(sorted);
    onCountsChange?.({ employees: sorted.length, expiring, offBoard });
  }, [sorted, onRowsChange, onCountsChange]);

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
          className="ml-auto rounded px-2 py-1 text-red-700 border border-red-300 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-primary/30 text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <DataTable
      columns={COLUMNS}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
      stickyHeader
      className="mx-6 mb-6 max-h-[calc(100vh-260px)]"
    >
      {sorted.length === 0 ? (
        <tr>
          <td colSpan={COLUMNS.length} className="p-0">
            <EmptyState
              title="No employees match"
              hint="Try clearing the search or filters."
              compact
            />
          </td>
        </tr>
      ) : (
        sorted.map(row => (
          <ContractRow key={row.employee_id} row={row} />
        ))
      )}
    </DataTable>
  );
}
