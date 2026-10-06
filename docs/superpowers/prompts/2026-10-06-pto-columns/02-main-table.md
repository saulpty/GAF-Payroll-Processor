# PTO Tracker main table: "Start Date"; Review column and "Only With Review" for superusers only

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

- The "Start" column is renamed **Start Date** (table and Excel export).
- For everyone who is not a superuser: no **Review** column, no **Only With Review** checkbox, no
  "· N to review" in the page header, no Review column in the export.
- Superusers see exactly what they see today.

**Only these three files may change:**
- `src/app/pages/pto/PtoTable.tsx`: whole file below.
- `src/app/pages/pto/PtoRow.tsx`: whole file below.
- `src/app/pages/PtoTracker.tsx`: whole file below.

No other file may be touched (not `PtoBreakdown.tsx`, `PtoSubRow.tsx`, `fmtDay.ts`,
`DataTable.tsx`, any action, or `src/components/ui/*`).

## `src/app/pages/pto/PtoTable.tsx` (whole file)

```tsx
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
  { key: 'fh_left',      label: 'FH left',  align: 'right', tip: '2 per calendar year, non-stacking, eligible 90 days after hire. Counts days, not records. Hover a value for the breakdown.' },
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
  const [onlyPending, setOnlyPending] = useState(false);
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
    if (isSuper && onlyPending) rows = rows.filter(r => r.review > 0 || r.waiting > 0);
    return rows;
  }, [derived, employee, role, onlyPending, isSuper]);

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
      <div className="flex flex-wrap items-center gap-3 px-6 pb-3">
        {isSuper && (
          <label className="flex items-center gap-1.5 text-[13px] text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={e => setOnlyPending(e.target.checked)}
              className="rounded"
            />
            Only With Review
          </label>
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
```

## `src/app/pages/pto/PtoRow.tsx` (whole file)

```tsx
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { fmtDay } from '@/app/lib/fmtDay';
import StatusChip from '@/app/components/StatusChip';

export interface PtoRowData {
  employee_id: number;
  display_name: string;
  role: string | null;
  manager: string | null;
  start_date: string | null;
  pto_start_date_override: string | null;
  paid_pto_days: number | string;
  taken_days: number | string;
  fh_allocated: number | string;
  fh_used: number | string;
  fh_sheet_used: number | string;
  wfh_days: number | string;
  birthday_days: number | string;
  start: string | null;
  accrued: number | null;
  available: number | null;
  fh_left: number;
  fh_eligible_from: string | null;
  review: number;
  waiting: number;
}

interface Props {
  row: PtoRowData;
  expanded: boolean;
  onToggle: () => void;
  thisYear: string;
  /** Review column: superusers only (Saul, 2026-10-06). */
  showReview: boolean;
  children?: ReactNode;
}

const muted = <span className="text-slate-300">—</span>;

function fmt2(v: number | null): ReactNode {
  if (v === null) return muted;
  return v.toFixed(2);
}

function fmtInt(v: number | string | null | undefined): ReactNode {
  if (v === null || v === undefined || v === '') return muted;
  const n = Number(v);
  if (Number.isNaN(n)) return muted;
  return String(n);
}

export default function PtoRow({ row, expanded, onToggle, thisYear, showReview, children }: Props) {
  const available = row.available;
  const negativeAvail = available !== null && available < 0;
  const fhUsed = Number(row.fh_used) || 0;
  const fhAllocated = Number(row.fh_allocated) || 2;
  const fhSheetUsed = Number(row.fh_sheet_used) || 0;

  let fhCell: ReactNode;
  if (row.fh_left === 0 && row.fh_eligible_from) {
    fhCell = (
      <span
        className="text-slate-400"
        title={`Eligible ${fmtDay(row.fh_eligible_from, thisYear)} — 90 days after hire`}
      >
        0
      </span>
    );
  } else if (row.fh_left === 0) {
    fhCell = (
      <span
        title={`Used ${fhUsed} of ${fhAllocated} this year · August sheet said ${fhSheetUsed}`}
      >
        {fmtInt(row.fh_left)}
      </span>
    );
  } else {
    fhCell = (
      <span
        title={`Used ${fhUsed} of ${fhAllocated} this year · August sheet said ${fhSheetUsed}`}
      >
        {fmtInt(row.fh_left)}
      </span>
    );
  }

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-slate-50/80 transition-colors duration-100"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {/* Employee */}
        <td className="px-3 py-2 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <ChevronRight
              className="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150"
              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              aria-hidden="true"
            />
            <div>
              <div className="font-medium text-slate-900">{row.display_name}</div>
              {!row.start && (
                <div className="text-[11px] text-amber-600">no start date</div>
              )}
            </div>
          </div>
        </td>
        {/* Title */}
        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.role ?? muted}</td>
        {/* Start Date */}
        <td className="px-3 py-2 tabular-nums whitespace-nowrap">
          {row.start ? fmtDay(row.start, thisYear) : muted}
        </td>
        {/* Accrued */}
        <td className="px-3 py-2 text-right tabular-nums">{fmt2(row.accrued)}</td>
        {/* Taken */}
        <td className="px-3 py-2 text-right tabular-nums">{fmt2(Number(row.taken_days) || null)}</td>
        {/* Available */}
        <td className={`px-3 py-2 text-right tabular-nums ${negativeAvail ? 'text-red-600 font-semibold' : ''}`}>
          {fmt2(available)}
        </td>
        {/* Paid PTO */}
        <td className="px-3 py-2 text-right tabular-nums">{fmtInt(row.paid_pto_days)}</td>
        {/* FH left */}
        <td className="px-3 py-2 text-right tabular-nums">{fhCell}</td>
        {/* WFH */}
        <td className="px-3 py-2 text-right tabular-nums">{fmtInt(row.wfh_days)}</td>
        {/* Birthday */}
        <td className="px-3 py-2 text-right tabular-nums">{fmtInt(row.birthday_days)}</td>
        {/* Review: superusers only */}
        {showReview && (
          <td className="px-3 py-2 text-center">
            {row.review === 0 && row.waiting === 0
              ? muted
              : (
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  {row.review > 0
                    ? <StatusChip tone="amber">{row.review}</StatusChip>
                    : muted}
                  {row.waiting > 0 && (
                    <span className="ml-1 text-[11px] text-slate-400 whitespace-nowrap">{row.waiting} not yet</span>
                  )}
                </div>
              )}
          </td>
        )}
      </tr>
      {expanded && children && (
        <tr>
          <td colSpan={showReview ? 11 : 10} className="bg-slate-50/60 p-0">
            {children}
          </td>
        </tr>
      )}
    </>
  );
}
```

## `src/app/pages/PtoTracker.tsx` (whole file)

```tsx
import { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import PageHeader from '@/app/components/PageHeader';
import PtoTable from './pto/PtoTable';
import RecordApprovalDialog from './pto/RecordApprovalDialog';
import type { DialogMode } from './pto/RecordApprovalDialog';
import type { PtoRowData } from './pto/PtoRow';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';

export default function PtoTracker() {
  const { bumpPtoVersion } = useGlobalFilters();
  const { isSuper } = useViewer();
  const [asOf, setAsOf] = useState(() => toLocalYMD(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [rows, setRows] = useState<PtoRowData[]>([]);
  const [counts, setCounts] = useState<{ employees: number; review: number } | null>(null);

  const handleExport = () => {
    const wsData = [
      ['Employee', 'Title', 'Start Date', 'Accrued', 'Taken', 'Available', 'Paid PTO', 'FH left', 'WFH', 'Birthday',
        ...(isSuper ? ['Review'] : [])],
      ...rows.map(r => [
        r.display_name,
        r.role ?? '',
        r.start ?? '',
        r.accrued !== null ? +r.accrued.toFixed(2) : '',
        +(Number(r.taken_days) || 0).toFixed(2),
        r.available !== null ? +r.available.toFixed(2) : '',
        Number(r.paid_pto_days) || 0,
        r.fh_left !== null ? r.fh_left : '',
        Number(r.wfh_days) || 0,
        Number(r.birthday_days) || 0,
        ...(isSuper ? [r.review] : []),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PTO Tracker');
    XLSX.writeFile(wb, `pto-tracker-${asOf}.xlsx`);
  };

  const actions = (
    <>
      {counts !== null && (
        <span className="text-[12px] text-slate-400 mr-1">
          {counts.employees} {counts.employees === 1 ? 'employee' : 'employees'}{isSuper && ` · ${counts.review} to review`}
        </span>
      )}
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        As of
        <input
          type="date"
          value={asOf}
          onChange={e => setAsOf(e.target.value)}
          className="h-8 px-2.5 text-[13px] font-normal normal-case tracking-normal border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>
      {isSuper && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogMode({ kind: 'manual' })}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Manually
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={handleExport}
        disabled={rows.length === 0}
      >
        <Download className="w-3.5 h-3.5 mr-1" />
        Export
      </Button>
    </>
  );

  const today = toLocalYMD(new Date());

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="PTO Tracker"
        subtitle="Accrual, approvals and floating holidays — one row per employee"
        actions={actions}
      />
      <div className="flex-1 min-h-0 flex flex-col">
        <PtoTable
          asOf={asOf}
          today={today}
          refreshKey={refreshKey}
          onOpenDialog={setDialogMode}
          onRowsChange={setRows}
          onCountsChange={setCounts}
        />
      </div>
      {isSuper && (
        <RecordApprovalDialog
          mode={dialogMode}
          today={today}
          onClose={() => setDialogMode(null)}
          onSaved={() => { setDialogMode(null); setRefreshKey(k => k + 1); bumpPtoVersion(); }}
        />
      )}
    </div>
  );
}
```

## Report
- Byte size of the three files; confirm no other file changed and the PTO Tracker renders with
  no console errors.
