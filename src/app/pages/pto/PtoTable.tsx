import { useState, useMemo, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useLoadAction } from '@uibakery/data';
import DataTable, { Col } from '@/app/components/DataTable';
import EmptyState from '@/app/components/EmptyState';
import PtoRow, { PtoRowData } from './PtoRow';
import PtoBreakdown from './PtoBreakdown';
import type { DialogMode } from './RecordApprovalDialog';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import loadPtoBalancesInputsAction from '@/actions/loadPtoBalancesInputs';
import { accruedPto, fhEligibleDate, fhRemaining } from '@/app/lib/ptoAccrual';
import { sortRows, nextSortDir } from '@/app/lib/ptoSort';
import type { SortDir } from '@/app/lib/ptoSort';

interface Props {
  asOf: string;
  refreshKey: number;
  onOpenDialog: (m: DialogMode) => void;
  onRowsChange?: (rows: PtoRowData[]) => void;
  onCountsChange?: (counts: { employees: number; pending: number }) => void;
}

type RawRow = {
  employee_id: number;
  display_name: string;
  role: string | null;
  manager: string | null;
  start_date: string | null;
  pto_start_date_override: string | null;
  paid_pto_days: number | string;
  taken_days: number | string;
  pending_count: number | string;
  fh_allocated: number | string;
  fh_used: number | string;
  wfh_days: number | string;
  birthday_days: number | string;
};

const COLUMNS: Col<PtoRowData>[] = [
  { key: 'display_name', label: 'Employee' },
  { key: 'role',         label: 'Title' },
  { key: 'start',        label: 'Start' },
  { key: 'accrued',      label: 'Accrued',  align: 'right', tip: 'DAYS360(start, as-of) ÷ 11 — the sheet\'s formula. About 1 day per 11 calendar days.' },
  { key: 'taken_days',   label: 'Taken',    align: 'right', tip: 'Sum of recorded PTO days. Withdrawn rows don\'t count.' },
  { key: 'available',    label: 'Available', align: 'right', tip: 'Accrued − Taken. Red when negative.' },
  { key: 'paid_pto_days',label: 'Paid PTO', align: 'right', tip: 'Days already paid in advance (CSS two-week blocks). Manual.' },
  { key: 'fh_left',      label: 'FH left',  align: 'right', tip: '2 per calendar year, non-stacking, eligible 90 days after hire.' },
  { key: 'wfh_days',     label: 'WFH',      align: 'right', tip: 'Approved Work-From-Home requests on Monday this year.' },
  { key: 'birthday_days',label: 'Birthday', align: 'right', tip: 'Birthday day-off requests on Monday this year.' },
  { key: 'pending',      label: 'Pending',  align: 'center', tip: 'Monday PTO requests not yet recorded.' },
];

export default function PtoTable({ asOf, refreshKey, onOpenDialog, onRowsChange, onCountsChange }: Props) {
  const { employee, role, manager } = useGlobalFilters();

  const year = asOf.slice(0, 4);
  const [rawRows, loading, error, reload] = useLoadAction(
    loadPtoBalancesInputsAction,
    [] as RawRow[],
    { year, manager: manager || null },
  );

  // detailKey: bumped on dialog save or breakdown write, forces breakdown refetch
  const [detailKey, setDetailKey] = useState(0);

  // When refreshKey changes (dialog saved from parent), reload balances + bump detailKey
  const refreshRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshRef.current !== refreshKey) {
      refreshRef.current = refreshKey;
      setDetailKey(k => k + 1);
      reload();
    }
  }, [refreshKey, reload]);

  // Derive computed fields
  const derived = useMemo((): PtoRowData[] => {
    return (rawRows as RawRow[]).map(r => {
      const start = r.pto_start_date_override || r.start_date || null;
      const accrued = start && start <= asOf ? accruedPto(start, asOf) : null;
      const taken = Number(r.taken_days) || 0;
      const available = accrued === null ? null : accrued - taken;
      const fhEligFrom = start ? fhEligibleDate(start) : null;
      const fhEligible = fhEligFrom ? fhEligFrom <= asOf : false;
      const fh_left = fhEligible ? fhRemaining(Number(r.fh_allocated), Number(r.fh_used)) : 0;
      return {
        ...r,
        start,
        accrued,
        available,
        fh_left,
        fh_eligible_from: !fhEligible && fhEligFrom ? fhEligFrom : null,
        pending: Number(r.pending_count) || 0,
      };
    });
  }, [rawRows, asOf]);

  // Local controls
  const [onlyPending, setOnlyPending] = useState(false);
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

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

  const handleToggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleChanged = () => {
    setDetailKey(k => k + 1);
    reload();
  };

  // Filter
  const filtered = useMemo(() => {
    let rows = derived;
    if (employee) rows = rows.filter(r =>
      String(r.employee_id) === employee || r.display_name.toLowerCase().includes(employee.toLowerCase())
    );
    if (role) rows = rows.filter(r => (r.role ?? '').toLowerCase().includes(role.toLowerCase()));
    if (onlyPending) rows = rows.filter(r => r.pending > 0);
    return rows;
  }, [derived, employee, role, onlyPending]);

  const sorted = useMemo(
    () => sortRows(filtered, sortKey as keyof PtoRowData | null, sortDir, 'display_name'),
    [filtered, sortKey, sortDir],
  );

  const totalPending = sorted.reduce((s, r) => s + r.pending, 0);

  useEffect(() => {
    onRowsChange?.(sorted);
    onCountsChange?.({ employees: sorted.length, pending: totalPending });
  }, [sorted, onRowsChange, onCountsChange, totalPending]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Controls strip */}
      <div className="flex flex-wrap items-center gap-3 px-6 pb-3">
        <label className="flex items-center gap-1.5 text-[13px] text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={e => setOnlyPending(e.target.checked)}
            className="rounded"
          />
          Only with pending
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showWithdrawn}
            onChange={e => setShowWithdrawn(e.target.checked)}
            className="rounded"
          />
          Show withdrawn
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : error ? (
        <div className="mx-6 mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load PTO balances — loadPtoBalancesInputs
        </div>
      ) : (
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
              <td colSpan={11} className="p-0">
                <EmptyState
                  title="No employees match"
                  hint="Try clearing the search or filters."
                  compact
                />
              </td>
            </tr>
          ) : (
            sorted.map(row => (
              <PtoRow
                key={row.employee_id}
                row={row}
                expanded={expanded.has(row.employee_id)}
                onToggle={() => handleToggle(row.employee_id)}
              >
                {expanded.has(row.employee_id) && (
                  <PtoBreakdown
                    key={`${row.employee_id}-${detailKey}`}
                    row={row}
                    year={year}
                    showWithdrawn={showWithdrawn}
                    onOpenDialog={onOpenDialog}
                    onChanged={handleChanged}
                    detailKey={detailKey}
                  />
                )}
              </PtoRow>
            ))
          )}
        </DataTable>
      )}
    </div>
  );
}
