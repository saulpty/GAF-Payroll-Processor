# PTO Tracker: Warm look — header, filter chips, Coming Up card, Title Case table header

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Saul approved the PTO Tracker mockup in the Warm design system (2026-10-06). This prompt does the
page shell; the opened-employee rows come in the next prompt.

- **Header:** "Add Manually" is the orange primary button (`bg-warm text-warm-ink`); Export stays
  outline; "As Of" in Title Case. The "N employees · N to review" text leaves the header.
- **Chips above the table:** `N Employees` for everyone. Superusers also get **To Review N** and
  **Not Yet N** toggle chips that filter the table (click again to clear). They replace the
  "Only With Review" checkbox.
- **Coming Up:** one white card with the navy title "Coming Up 🌴", month names as headings
  **above** their cards, "Out Now" cards on the warm tint with an orange-outlined "Back …" chip.
  The 🌴 / ⭐ emojis stay. Same data, same loader.
- **Table header:** Title Case, 12px semibold, white (no ALL CAPS) — via a new optional
  `titleCase` prop on `DataTable`. Off by default, so **Contracts, Disciplinary and Attendance
  tables do not change.** "FH left" becomes "FH Left".
- The Review count chip in a row uses the Excel yellow (`bg-status-yellow-fill
  text-status-yellow-ink`).

**Only these five files may change:**
- `src/app/components/DataTable.tsx`
- `src/app/pages/pto/PtoTable.tsx`
- `src/app/pages/pto/PtoRow.tsx`
- `src/app/pages/PtoTracker.tsx`
- `src/app/pages/pto/PtoComingUp.tsx`

Each is a whole file below. No other file may be touched (not `PtoBreakdown.tsx`,
`PtoSubRow.tsx`, `TopNav.tsx`, `PageHeader.tsx`, `StatusChip.tsx`, any action, or
`src/components/ui/*`).

## `src/app/components/DataTable.tsx` (whole file)

```tsx
import type { ReactNode } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import InfoTip from './InfoTip';

export type Col<T> = { key: keyof T | string; label: string; align?: 'left' | 'right' | 'center'; tip?: string; sortable?: boolean; width?: string };

// titleCase: the Warm design system's header (Title Case labels, 12px semibold, never ALL CAPS).
// Off by default so pages that are not redesigned yet keep their current look.
export default function DataTable<T>({ columns, sortKey, sortDir, onSort, children, stickyHeader = true, dense = false, className = '', titleCase = false }: {
  columns: Col<T>[]; sortKey: string | null; sortDir: 'asc' | 'desc' | null; onSort: (key: string) => void;
  children: ReactNode; stickyHeader?: boolean; dense?: boolean; className?: string; titleCase?: boolean;
}) {
  const pad = dense ? 'px-3 py-1.5' : 'px-3 py-2';
  const headLook = titleCase
    ? 'bg-white text-[12px] tracking-[0.02em] text-slate-600'
    : 'bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500';
  return (
    <div className={`overflow-auto rounded-xl border border-slate-200 bg-white shadow-card ${className}`}>
      <table className="w-full text-[13px] text-slate-700">
        <thead className={`${stickyHeader ? 'sticky top-0 z-10' : ''} ${headLook}`}>
          <tr className="border-b border-slate-200">
            {columns.map(c => {
              const k = String(c.key);
              const active = sortKey === k && sortDir !== null;
              const al = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
              const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={k} style={c.width ? { width: c.width } : undefined}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`${pad} font-semibold ${al} whitespace-nowrap`}>
                  {c.sortable === false ? (
                    <span>{c.label}{c.tip && <InfoTip text={c.tip} />}</span>
                  ) : (
                    <button type="button" onClick={() => onSort(k)}
                      className={`inline-flex items-center gap-1 rounded px-1 -mx-1 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${active ? 'text-slate-900' : ''}`}>
                      {c.label}{c.tip && <InfoTip text={c.tip} />}
                      <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} aria-hidden="true" />
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
```

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
```

## `src/app/pages/pto/PtoRow.tsx` (whole file)

```tsx
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { fmtDay } from '@/app/lib/fmtDay';

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
                    ? <span className="inline-flex items-center rounded-full bg-status-yellow-fill px-2 py-0.5 text-[11px] font-medium text-status-yellow-ink">{row.review}</span>
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
import PtoComingUp from './pto/PtoComingUp';
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

  const handleExport = () => {
    const wsData = [
      ['Employee', 'Title', 'Start Date', 'Accrued', 'Taken', 'Available', 'Paid PTO', 'FH Left', 'WFH', 'Birthday',
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

  // Warm design system (2026-10-06): the primary action is orange with navy ink;
  // the employee and review counts moved to chips above the table.
  const actions = (
    <>
      <label className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
        As Of
        <input
          type="date"
          value={asOf}
          onChange={e => setAsOf(e.target.value)}
          className="h-8 px-2.5 text-[13px] font-normal text-slate-900 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-warm-ring"
        />
      </label>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExport}
        disabled={rows.length === 0}
      >
        <Download className="w-3.5 h-3.5 mr-1" />
        Export
      </Button>
      {isSuper && (
        <Button
          size="sm"
          className="bg-warm text-warm-ink hover:bg-warm hover:brightness-95 font-semibold"
          onClick={() => setDialogMode({ kind: 'manual' })}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Manually
        </Button>
      )}
    </>
  );

  const today = toLocalYMD(new Date());

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="PTO Tracker"
        subtitle="Accrual, requests and floating holidays, one row per employee."
        actions={actions}
      />
      <PtoComingUp today={today} refreshKey={refreshKey} />
      <div className="flex-1 min-h-0 flex flex-col">
        <PtoTable
          asOf={asOf}
          today={today}
          refreshKey={refreshKey}
          onOpenDialog={setDialogMode}
          onRowsChange={setRows}
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

## `src/app/pages/pto/PtoComingUp.tsx` (whole file)

```tsx
import { useEffect, useRef } from 'react';
import { useLoadAction } from '@uibakery/data';
import EmptyState from '@/app/components/EmptyState';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import loadPtoUpcomingAction from '@/actions/loadPtoUpcoming';
import { fmtDay, fmtLeaveDates } from '@/app/lib/fmtDay';

// "Coming Up" on the PTO Tracker (manager meeting, 2026-10-06): who is out now,
// then who is out for the rest of the year, grouped by month. Read-only.
// Warm look (Saul approved the mockup 2026-10-06): one white card, month headings
// above their cards, "Out Now" cards on the warm tint with a Back chip.
export interface UpcomingRow {
  employee_id: number;
  display_name: string;
  leave_type: 'pto' | 'floating_holiday';
  leave_on: string;
  return_on: string;
  total_days: number | string | null;
  status: 'pending' | 'recorded';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function LeaveCard({ r, out, thisYear }: { r: UpcomingRow; out: boolean; thisYear: string }) {
  const days = Number(r.total_days) || 0;
  const fh = r.leave_type === 'floating_holiday';
  return (
    <div
      className={`shrink-0 w-56 rounded-lg border p-3 flex flex-col gap-1 ${out ? 'border-orange-200 bg-warm-tint' : 'border-slate-200 bg-white'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-slate-900" title={r.display_name}>{r.display_name}</span>
        <span aria-hidden="true">{fh ? '⭐' : '🌴'}</span>
      </div>
      <div className="text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
        {fmtLeaveDates(r.leave_on, r.return_on, thisYear)}
      </div>
      <div className="text-[12px] text-slate-500 whitespace-nowrap">
        {fh ? 'Floating Holiday' : 'PTO'}{days > 0 ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}
        {r.status === 'pending' ? ' · Pending' : ''}
      </div>
      {out ? (
        <span className="self-start mt-0.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-warm-text ring-1 ring-inset ring-orange-200 whitespace-nowrap">
          Back {fmtDay(r.return_on, thisYear)}
        </span>
      ) : (
        <div className="text-[12px] text-slate-500 whitespace-nowrap">Back {fmtDay(r.return_on, thisYear)}</div>
      )}
    </div>
  );
}

function GroupHeading({ label, count, warm }: { label: string; count?: number; warm?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 whitespace-nowrap">
      {warm && <span className="w-2 h-2 rounded-full bg-warm" aria-hidden="true" />}
      {label}
      {count !== undefined && <span className="font-medium text-slate-400">{count}</span>}
    </div>
  );
}

export default function PtoComingUp({ today, refreshKey }: { today: string; refreshKey: number }) {
  const { manager } = useGlobalFilters();
  const { viewAs } = useViewer();
  const thisYear = today.slice(0, 4);
  const until = `${thisYear}-12-31`;

  const [raw, loading, error, reload] = useLoadAction(
    loadPtoUpcomingAction,
    [] as UpcomingRow[],
    { today, until, manager: manager || null, viewAs },
  );

  const refreshRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshRef.current !== refreshKey) {
      refreshRef.current = refreshKey;
      reload();
    }
  }, [refreshKey, reload]);

  const rows = ((raw as UpcomingRow[]) ?? []).map(r => ({
    ...r,
    leave_on: String(r.leave_on ?? '').slice(0, 10),
    return_on: String(r.return_on ?? '').slice(0, 10),
  }));
  // The loader only returns leave whose return is after today, so starting on/before today = out now.
  const outNow = rows.filter(r => r.leave_on <= today);
  const later = rows.filter(r => r.leave_on > today);

  // Group the later ones by the month they start in (rows arrive sorted by leave_on).
  const groups: { month: string; label: string; rows: UpcomingRow[] }[] = [];
  for (const r of later) {
    const month = r.leave_on.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.month !== month) {
      g = { month, label: MONTHS[Number(month.slice(5, 7)) - 1] ?? month, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }

  return (
    <section aria-labelledby="pto-coming-up" className="mx-6 mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-baseline gap-3 mb-3">
        <h2 id="pto-coming-up" className="text-[16px] leading-[22px] font-semibold text-primary">Coming Up 🌴</h2>
        {rows.length > 0 && (
          <span className="text-[13px] text-slate-500">
            {outNow.length} out now · {later.length} later this year
          </span>
        )}
      </div>
      {loading && rows.length === 0 ? (
        <div className="flex gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="shrink-0 w-56 h-[104px] rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-[12px] text-red-600">Couldn&apos;t load upcoming time off — loadPtoUpcoming</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No One Is Out for the Rest of the Year" compact />
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-1">
          {outNow.length > 0 && (
            <div className="flex flex-col gap-2 shrink-0">
              <GroupHeading label="Out Now" warm />
              <div className="flex gap-2">
                {outNow.map(r => (
                  <LeaveCard key={`n-${r.status}-${r.employee_id}-${r.leave_on}`} r={r} out thisYear={thisYear} />
                ))}
              </div>
            </div>
          )}
          {outNow.length > 0 && groups.length > 0 && <div className="w-px bg-slate-200 shrink-0" />}
          {groups.map(g => (
            <div key={g.month} className="flex flex-col gap-2 shrink-0">
              <GroupHeading label={g.label} count={g.rows.length} />
              <div className="flex gap-2">
                {g.rows.map(r => (
                  <LeaveCard key={`l-${r.status}-${r.employee_id}-${r.leave_on}`} r={r} out={false} thisYear={thisYear} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

## Report
- Byte size of the five files; confirm no other file changed, the PTO Tracker renders with no
  console errors, and the Contracts table header still looks exactly as before.
