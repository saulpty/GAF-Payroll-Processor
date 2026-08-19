import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutateAction } from '@uibakery/data';
import { Clock } from 'lucide-react';
import upsertPtoEmployeeAction from '@/actions/upsertPtoEmployee';
import { accruedPto, fhRemaining, fhEligibleDate, days360 } from '@/app/lib/ptoAccrual';

export type PtoRow = {
  employee_id: number;
  display_name: string;
  role: string;
  manager: string;
  start_date: string | null;
  pto_start_date_override: string | null;
  paid_pto_days: number;
  taken_days: number;
  pending_count: number;
  fh_allocated: number;
  fh_used: number;
  wfh_days: number;
  birthday_days: number;
  tft_hours: number;
};

interface Props {
  row: PtoRow;
  asOf: string;
  onSaved: () => void;
}

export default function BalancesRow({ row, asOf, onSaved }: Props) {
  const navigate = useNavigate();
  const [upsert] = useMutateAction(upsertPtoEmployeeAction);

  const [paidEdit, setPaidEdit] = useState<string>(String(row.paid_pto_days ?? 0));
  const [saving, setSaving] = useState(false);

  const start = (row.pto_start_date_override || row.start_date || '').slice(0, 10);
  const taken = Number(row.taken_days) || 0;
  const pending = Number(row.pending_count) || 0;

  let accrued: number | null = null;
  let available: number | null = null;
  if (start && start <= asOf) {
    accrued = accruedPto(start, asOf);
    available = accrued - taken;
  }

  const fhElig = start ? fhEligibleDate(start) : '';
  const fhEligible = fhElig !== '' && fhElig <= asOf;
  const fhLeft = fhRemaining(row.fh_allocated, row.fh_used);

  const showPaidWarning = start && days360(start, asOf) >= 180 && (Number(row.paid_pto_days) || 0) === 0;

  const handlePaidBlur = async () => {
    const val = parseFloat(paidEdit);
    if (isNaN(val) || val < 0) { setPaidEdit(String(row.paid_pto_days ?? 0)); return; }
    setSaving(true);
    try {
      await upsert({
        employee_id: row.employee_id,
        paid_pto_days: val,
        pto_start_date_override: row.pto_start_date_override ?? '',
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b hover:bg-slate-50 text-sm">
      <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{row.display_name}</td>
      <td className="px-3 py-2 text-slate-500 text-xs">{row.role || '—'}</td>
      <td className="px-3 py-2 font-mono text-xs text-slate-500">{start || '—'}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {accrued !== null
          ? accrued.toFixed(2)
          : <span title="No start date" className="text-amber-500 cursor-help">⚠️ —</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{taken.toFixed(2)}</td>
      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${available !== null && available < 0 ? 'text-red-600' : ''}`}>
        {available !== null ? available.toFixed(2) : '—'}
      </td>
      {/* Paid PTO */}
      <td className="px-3 py-2 text-right relative">
        {showPaidWarning && (
          <span
            className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 cursor-help"
            title="6 months reached — CSS advance not recorded"
          />
        )}
        <input
          type="number"
          min="0"
          step="0.5"
          value={paidEdit}
          onChange={e => setPaidEdit(e.target.value)}
          onBlur={handlePaidBlur}
          disabled={saving}
          className="w-16 text-right border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
        />
      </td>
      {/* FH remaining */}
      <td className="px-3 py-2 text-right tabular-nums">
        <span
          className={fhEligible ? '' : 'text-slate-400'}
          title={fhEligible ? `${fhLeft} of ${row.fh_allocated} remaining` : `Eligible from ${fhElig || '—'}`}
        >
          {fhLeft}
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{Number(row.wfh_days) || 0}</td>
      <td className="px-3 py-2 text-right tabular-nums">{Number(row.birthday_days) || 0}</td>
      <td className="px-3 py-2 text-right tabular-nums">{Number(row.tft_hours) || 0}</td>
      {/* Pending */}
      <td className="px-3 py-2 text-center">
        {pending > 0 ? (
          <button
            onClick={() => navigate(`/pto?tab=approvals&employee=${row.employee_id}`)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium hover:bg-amber-200 transition-colors"
          >
            <Clock className="w-3 h-3" />
            {pending}
          </button>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}
