import { useState, useMemo, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useLoadAction } from '@uibakery/data';
import DataTable, { Col } from '@/app/components/DataTable';
import EmptyState from '@/app/components/EmptyState';
import PtoRow, { PtoRowData } from './PtoRow';
import PtoBreakdown from './PtoBreakdown';
import type { DialogMode } from './RecordApprovalDialog';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import loadPtoBalancesInputsAction from '@/actions/loadPtoBalancesInputs';
import loadPeriodsAction from '@/actions/loadPeriods';
import { accruedPto, fhEligibleDate, fhRemaining } from '@/app/lib/ptoAccrual';
import { sortRows, nextSortDir } from '@/app/lib/ptoSort';
import type { SortDir } from '@/app/lib/ptoSort';
import type { PeriodRow } from '@/app/lib/ptoPayrollMatch';

interface Props {
  asOf: string;
  today: string;
  refreshKey: number;
  onOpenDialog: (m: DialogMode) => void;
  onRowsChange?: (rows: PtoRowData[]) => void;
  onCountsChange?: (counts: { employees: number; review: number }) => void;
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
  review_count: number | string;
  waiting_count: number | string;
  fh_allocated: number | string;
  fh_used: number | string;
  fh_sheet_used: number | string;
  wfh_days: number | string;
  birthday_days: number | string;
};

const COLUMNS: Col<PtoRowData>[] = [
  { key: 'display_name', label: 'Employee' },
  { key: 'role',         label: 'Title' },
  { key: 'start',        label: 'Start Date' },
  { key: 'accrued',      label: 'Accrued',  align: 'right', tip: 'DAYS360(start, as-of) ÷ 11 — the sheet\'s formula. About 1 day per 11 calendar days.' },
  { key: 'taken_days',   label: 'Taken',    align: 'right', tip: 'Sum of recorded PTO days. Withdrawn rows don\'t count.' },
  { key: 'available',    label: 'Available', align: 'right', tip: 'Accrued − Taken. Red when negative.' },
  { key: 'paid_pto_days',label: 'Paid PTO', align: 'right', tip: 'Days already paid in advance (CSS two-week blocks). Manual.' },
  { key: 'fh_left',      label: 'FH Left',  align: 'right', tip: '2 per calendar year, non-stacking, eligible 90 days after hire. Counts days, not records. Hover a value for the breakdown.' },
  { key: 'wfh_days',     label: 'WFH',      align: 'right', tip: 'Approved Work-From-Home requests on Monday this year.' },
  { key: 'birthday_days',label: 'Birthday', align: 'right', tip: 'Birthday day-off requests on Monday this year.' },
  { key: 'review',       label: 'Review',   align: 'center', tip: 'Requests you can record now — the return date has passed and payroll for those days is processed. "N not yet" are future or not yet in payroll.' },
];

export default function PtoTable({ asOf, today, refreshKey, onOpenDialog, onRowsChange, onCountsChange }: Props) {
  const { employee, role, manager } = useGlobalFilters();
  const { viewAs, isSuper } = useViewer();
  // Review is a superuser task: everyone else gets the table without it (Saul, 2026-10-06).
  const columns = isSuper ? COLUMNS : COLUMNS.filter(c => c.key !== 'review');

  const year = asOf.slice(0, 4);
  const [rawRows, loading, error, reload] = useLoadAction(
    loadPtoBalancesInputsAction,
    [] as RawRow[],
    { year, manager: manager || null, today, viewAs },
  );

  const [periods] = useLoadAction(loadPeriodsAction, [] as PeriodRow[]);

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
        review: Number(r.review_count) || 0,
        waiting: Number(r.waiting_count) || 0,
      };
    });
  }, [rawRows, asOf]);

  // Local controls
  // Superuser filter chips (replace the old Only With Review checkbox): click to filter, click again to clear.
  const [chip, setChip] = useState<'review' | 'waiting' | null>(null);
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

  // Filter: search + title first (the chip counts come from these), then the chip.
  const base = useMemo(() => {
    let rows = derived;
    if (employee) rows = rows.filter(r =>
      String(r.employee_id) === employee || r.display_name.toLowerCase().includes(employee.toLowerCase())
    );
    if (role) rows = rows.filter(r => (r.role ?? '').toLowerCase().includes(role.toLowerCase()));
    return rows;
  }, [derived, employee, role]);

  const filtered = useMemo(() => {
    if (isSuper && chip === 'review') return base.filter(r => r.review > 0);
    if (isSuper && chip === 'waiting') return base.filter(r => r.waiting > 0);
    return base;
  }, [base, chip, isSuper]);

  const reviewTotal = base.reduce((s, r) => s + r.review, 0);
  const waitingTotal = base.reduce((s, r) => s + r.waiting, 0);
  const chipCls = (on: boolean) =>
    `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors ${on ? 'border-warm bg-warm-tint text-warm-text' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`;

  const sorted = useMemo(
    () => sortRows(filtered, sortKey as keyof PtoRowData | null, sortDir, 'display_name'),
    [filtered, sortKey, sortDir],
  );

  const totalReview = sorted.reduce((s, r) => s + r.review, 0);

  useEffect(() => {
    onRowsChange?.(sorted);
    onCountsChange?.({ employees: sorted.length, review: totalReview });
  }, [sorted, onRowsChange, onCountsChange, totalReview]);

  const thisYear = today.slice(0, 4);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Controls strip */}
      <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-primary">
          {sorted.length} {sorted.length === 1 ? 'Employee' : 'Employees'}
        </span>
        {isSuper && (
          <>
            <button
              type="button"
              aria-pressed={chip === 'review'}
              onClick={() => setChip(c => (c === 'review' ? null : 'review'))}
              className={chipCls(chip === 'review')}
              title="Requests you can record now: the return date has passed and payroll for those days is processed"
            >
              To Review <strong className="font-semibold">{reviewTotal}</strong>
            </button>
            <button
              type="button"
              aria-pressed={chip === 'waiting'}
              onClick={() => setChip(c => (c === 'waiting' ? null : 'waiting'))}
              className={chipCls(chip === 'waiting')}
              title="Requests still in the future or not yet in a processed payroll"
            >
              Not Yet <strong className="font-semibold">{waitingTotal}</strong>
            </button>
          </>
        )}
        {loading && (rawRows as RawRow[]).length > 0 && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
        )}
      </div>

      {/* Table */}
      {loading && (rawRows as RawRow[]).length === 0 ? (
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
          columns={columns}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          stickyHeader
          titleCase
          className="mx-6 mb-6 max-h-[calc(100vh-260px)]"
        >
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <EmptyState
                  title="No Employees Match"
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
                thisYear={thisYear}
                showReview={isSuper}
              >
                {expanded.has(row.employee_id) && (
                  <PtoBreakdown
                    key={String(row.employee_id)}
                    row={row}
                    year={year}
                    today={today}
                    periods={periods as PeriodRow[]}
                    onOpenDialog={onOpenDialog}
                    onChanged={handleChanged}
                    refreshToken={detailKey}
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
