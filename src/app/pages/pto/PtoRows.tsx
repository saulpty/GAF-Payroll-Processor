import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import MobileRow from '@/app/components/mobile/MobileRow';
import MobileSheet from '@/app/components/mobile/MobileSheet';
import { useViewer } from '@/app/context/ViewerContext';
import { fmtDay } from '@/app/lib/fmtDay';
import type { PeriodRow } from '@/app/lib/ptoPayrollMatch';
import { fhBreakdownText } from '@/app/lib/ptoPhone';
import PtoBreakdown from './PtoBreakdown';
import type { PtoRowData } from './PtoRow';
import type { DialogMode } from './RecordApprovalDialog';

/** What PtoBreakdown needs besides the row. The same values the table hands it. */
interface DetailProps {
  year: string;
  today: string;
  periods: PeriodRow[];
  onOpenDialog: (m: DialogMode) => void;
  onChanged: () => void;
  refreshToken: number;
}

interface Props extends DetailProps {
  /** The list PtoTable already filtered and sorted: the same one the table shows. */
  rows: PtoRowData[];
  /** First load, nothing to show yet. */
  loading: boolean;
  /** The line for an empty list. It names the filters that are on. */
  emptyText: string;
  /** Which employees are open in place: PtoTable's own state, shared with the table. */
  expanded: Set<number>;
  onToggle: (id: number) => void;
}

const two = (v: number | null): string => (v === null ? '—' : v.toFixed(2));

function count(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return Number.isNaN(n) ? '—' : String(n);
}

function Line({ label, value, note, red = false }: { label: string; value: ReactNode; note?: string; red?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className={cn('text-right font-medium tabular-nums', red ? 'text-red-600' : 'text-slate-900')}>
        {value}
        {note && <span className="block text-[12px] font-normal text-slate-500">{note}</span>}
      </dd>
    </div>
  );
}

/** Everything the row itself does not show: the other balances written out, then the requests. */
function PtoDetail({ row, thisYear, full = false, ...detail }: DetailProps & { row: PtoRowData; thisYear: string; full?: boolean }) {
  return (
    <div className="bg-slate-50 text-[13px]">
      <dl className="px-4 py-3">
        {full && (
          <>
            <Line label="Available" value={two(row.available)} red={row.available !== null && row.available < 0} />
            <Line label="Accrued" value={two(row.accrued)} />
            <Line label="Taken" value={(Number(row.taken_days) || 0).toFixed(2)} />
          </>
        )}
        <Line label="Start Date" value={row.start ? fmtDay(row.start, thisYear) : '—'} />
        <Line label="FH Left" value={count(row.fh_left)} note={fhBreakdownText(row, d => fmtDay(d, thisYear))} />
        <Line label="Paid PTO" value={count(row.paid_pto_days)} />
        <Line label="WFH" value={count(row.wfh_days)} />
        <Line label="Birthday" value={count(row.birthday_days)} />
      </dl>
      <h3 className="px-4 pb-2 text-[12px] font-semibold text-slate-600">Requests</h3>
      <PtoBreakdown key={String(row.employee_id)} row={row} phone {...detail} />
    </div>
  );
}

/** PTO Tracker on a phone: one row per employee. PtoTable renders this instead of the table. */
export default function PtoRows({ rows, loading, emptyText, expanded, onToggle, ...detail }: Props) {
  const { isSuper } = useViewer();
  // Super users: the employee whose sheet is open.
  const [opened, setOpened] = useState<PtoRowData | null>(null);
  const thisYear = detail.today.slice(0, 4);
  // Prefer the fresh row after a reload; keep the last one if a filter has since hidden it.
  const sheetRow = opened ? rows.find(r => r.employee_id === opened.employee_id) ?? opened : null;

  if (loading) {
    return (
      <div className="shrink-0 border-t border-slate-200 bg-white" aria-busy="true">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-[60px] border-b border-slate-200 bg-white px-4 py-3 animate-pulse">
            <div className="h-3.5 w-40 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-56 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white">
      {rows.length === 0 && (
        <p className="border-b border-slate-200 px-4 py-8 text-center text-[13px] text-slate-500">{emptyText}</p>
      )}
      {rows.map(row => {
        const open = !isSuper && expanded.has(row.employee_id);
        const negative = row.available !== null && row.available < 0;
        return (
          <MobileRow
            key={row.employee_id}
            title={row.display_name}
            sub={row.role || !row.start ? (
              <>
                {row.role}
                {!row.start && <span className="block text-amber-700">no start date</span>}
              </>
            ) : undefined}
            right={
              <span className="flex flex-col items-end">
                <span className={cn('text-[20px] font-bold leading-6 tabular-nums', negative ? 'text-red-600' : 'text-slate-900')}>
                  {two(row.available)}
                </span>
                <span className="text-[12px] leading-4 text-slate-500">Available</span>
              </span>
            }
            facts={
              <>
                <span>{two(row.accrued)} accrued</span>
                <span>{(Number(row.taken_days) || 0).toFixed(2)} taken</span>
                {isSuper && row.review > 0 && (
                  <span className="inline-flex items-center rounded-full bg-status-yellow-fill px-2 py-0.5 text-[12px] font-medium text-status-yellow-ink">
                    {row.review} to review
                  </span>
                )}
                {isSuper && row.waiting > 0 && <span>{row.waiting} not yet</span>}
              </>
            }
            chevron={isSuper ? 'right' : open ? 'up' : 'down'}
            expanded={isSuper ? undefined : open}
            onClick={() => (isSuper ? setOpened(row) : onToggle(row.employee_id))}
          >
            {open && <PtoDetail row={row} thisYear={thisYear} {...detail} />}
          </MobileRow>
        );
      })}
      <MobileSheet
        open={isSuper && sheetRow !== null}
        onClose={() => setOpened(null)}
        title={sheetRow?.display_name ?? ''}
        subtitle={sheetRow?.role ?? undefined}
        size="full"
      >
        {sheetRow && <PtoDetail row={sheetRow} thisYear={thisYear} full {...detail} />}
      </MobileSheet>
    </div>
  );
}
