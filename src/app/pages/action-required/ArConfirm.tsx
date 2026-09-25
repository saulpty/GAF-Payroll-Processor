import { useEffect, useId, useRef } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtMinutes, IMPACT_DOT, impactTone } from './arLogic';
import { rowDiscount } from './arDiscount';
import type { EditState, EntryRow } from './arTypes';

const THIS_YEAR = toLocalYMD(new Date()).slice(0, 4);
const th = 'px-3 py-2 text-left text-[12px] font-semibold text-slate-600 whitespace-nowrap bg-slate-50 border-b border-slate-200';
const td = 'px-3 py-1.5 border-b border-slate-100 align-top';
const dash = <span className="text-slate-400">—</span>;

/** "Salida Temprano · ● Paid (Grace)" for one event/impact pair; nothing when both are empty. */
function Pair({ event, impact }: { event: string; impact: string }) {
  if (!event && !impact) return null;
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-slate-700">{event || dash}</span>
      <span className="text-slate-300" aria-hidden="true">·</span>
      {impact
        ? <span className="inline-flex items-center gap-1 text-slate-700"><span className={`h-2 w-2 rounded-full ${IMPACT_DOT[impactTone(impact)]}`} aria-hidden="true" />{impact}</span>
        : dash}
    </div>
  );
}

/**
 * Commit confirmation (AR-12): the last check before a payroll write, so it shows
 * everything the commit writes: both event/impact pairs and the Discount, with the
 * same maths as the row. A real dialog: Esc cancels, focus starts on Commit.
 */
export function ArConfirm({ toConfirm, getEdit, reasonFor = () => null, bulkSaving, onCancel, onConfirm }: {
  toConfirm: EntryRow[];
  getEdit: (row: EntryRow) => EditState;
  /** Why a row will be skipped (bad time, impact without event), or null. */
  reasonFor?: (row: EntryRow) => string | null;
  bulkSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const lines = toConfirm.map(row => {
    const edit = getEdit(row);
    return { row, edit, reason: reasonFor(row), ...rowDiscount(row, edit) };
  });
  const ready = lines.filter(l => l.reason === null);
  const skipped = lines.length - ready.length;
  const deducted = ready.reduce((sum, l) => sum + l.minutes, 0);

  useEffect(() => { confirmRef.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40"
      onKeyDown={e => { if (e.key === 'Escape' && !bulkSaving) { e.stopPropagation(); onCancel(); } }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="mx-4 w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id={titleId} className="text-[16px] font-semibold text-slate-900">
          Commit {ready.length} {ready.length === 1 ? 'Row' : 'Rows'} to Green
        </h2>
        <p className="mt-1 text-[13px] text-slate-600">
          {deducted > 0
            ? <>Deducts <span className="font-semibold tabular-nums text-status-red-ink">{fmtMinutes(deducted)}</span> in total.</>
            : 'Nothing is deducted.'}
          {skipped > 0 && <span className="font-medium text-status-red-ink"> {skipped} {skipped === 1 ? 'row' : 'rows'} will be skipped (shown in red).</span>}
        </p>

        <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={th}>Employee</th>
                <th className={th}>Date</th>
                <th className={th}>Event · Impact</th>
                <th className={`${th} text-right`}>Discount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(({ row, edit, reason, discount }) => (
                <tr key={row.id} className={reason ? 'bg-status-red-tint' : ''}>
                  <td className={`${td} font-medium text-slate-800`}>
                    {row.employee_name}
                    {reason && <div className="text-[11px] font-medium text-status-red-ink">Skipped: {reason}</div>}
                  </td>
                  <td className={`${td} whitespace-nowrap text-slate-700`}>{fmtDay(row.work_date.slice(0, 10), THIS_YEAR)}</td>
                  <td className={td}>
                    <Pair event={edit.event_type_1} impact={edit.pay_impact_1} />
                    <Pair event={edit.event_type_2} impact={edit.pay_impact_2} />
                    {!edit.event_type_1 && !edit.event_type_2 && !edit.pay_impact_1 && !edit.pay_impact_2 && dash}
                  </td>
                  <td className={`${td} text-right`}>
                    {reason ? dash
                      : discount.tone === 'deduct' ? <span className="whitespace-nowrap font-semibold tabular-nums text-status-red-ink">{discount.text}</span>
                      : discount.tone === 'paid' ? <span className="inline-flex items-center gap-1 font-semibold text-status-green-ink"><Check className="h-3 w-3" aria-hidden="true" />Paid</span>
                      : dash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[12px] text-slate-500">
          This writes to the payroll record. Undo is offered right after, and any row can be reverted from the Committed list.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={bulkSaving}
            className="h-8 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
            Cancel
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={bulkSaving || ready.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-warm px-3 text-[13px] font-semibold text-warm-ink hover:brightness-95 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
            {bulkSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Committing…</> : 'Commit to Green'}
          </button>
        </div>
      </div>
    </div>
  );
}
