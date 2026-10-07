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
