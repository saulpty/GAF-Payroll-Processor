import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { fmtDate } from '@/app/lib/fmtDate';
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
  pending_count: number | string;
  fh_allocated: number | string;
  fh_used: number | string;
  wfh_days: number | string;
  birthday_days: number | string;
  start: string | null;
  accrued: number | null;
  available: number | null;
  fh_left: number;
  fh_eligible_from: string | null;
  pending: number;
}

interface Props {
  row: PtoRowData;
  expanded: boolean;
  onToggle: () => void;
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

export default function PtoRow({ row, expanded, onToggle, children }: Props) {
  const available = row.available;
  const negativeAvail = available !== null && available < 0;

  let fhCell: ReactNode;
  if (row.fh_left === 0 && row.fh_eligible_from) {
    fhCell = (
      <span
        className="text-slate-400"
        title={`Eligible ${fmtDate(row.fh_eligible_from)} — 90 days after hire`}
      >
        0
      </span>
    );
  } else {
    fhCell = fmtInt(row.fh_left);
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
        {/* Start */}
        <td className="px-3 py-2 tabular-nums whitespace-nowrap">{row.start ? fmtDate(row.start) : muted}</td>
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
        {/* Pending */}
        <td className="px-3 py-2 text-center">
          {row.pending === 0
            ? muted
            : <StatusChip tone="amber">{row.pending}</StatusChip>}
        </td>
      </tr>
      {expanded && children && (
        <tr>
          <td colSpan={11} className="bg-slate-50/60 p-0">
            {children}
          </td>
        </tr>
      )}
    </>
  );
}
